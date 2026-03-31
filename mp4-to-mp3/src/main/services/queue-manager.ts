import { BrowserWindow } from 'electron';
import path from 'path';
import { ConversionOptions, IPC_CHANNELS } from '../../shared/types';
import { FFmpegService } from './ffmpeg-service';

interface QueueJob {
  id: string;
  inputPath: string;
}

export class QueueManager {
  private window: BrowserWindow;
  private options: ConversionOptions;
  private queue: QueueJob[] = [];
  private currentService: FFmpegService | null = null;
  private cancelledJobs = new Set<string>();
  private allCancelled = false;

  constructor(window: BrowserWindow, options: ConversionOptions) {
    this.window = window;
    this.options = options;
  }

  async start(jobs: QueueJob[]): Promise<void> {
    this.queue = [...jobs];
    this.cancelledJobs.clear();
    this.allCancelled = false;

    for (const job of this.queue) {
      if (this.allCancelled || this.cancelledJobs.has(job.id)) {
        this.sendEvent(IPC_CHANNELS.JOB_FAILED, {
          jobId: job.id,
          errorMessage: 'キャンセルされました',
        });
        continue;
      }

      await this.processJob(job);
    }
  }

  cancelJob(jobId: string): void {
    this.cancelledJobs.add(jobId);
    if (this.currentService) {
      this.currentService.cancel();
    }
  }

  cancelAll(): void {
    this.allCancelled = true;
    if (this.currentService) {
      this.currentService.cancel();
    }
  }

  private async processJob(job: QueueJob): Promise<void> {
    const service = new FFmpegService();
    this.currentService = service;

    // 生成すべき速度リストを決定
    const speedList: Array<number | null> = [null]; // null = 通常速度
    if (this.options.speedUp && this.options.speeds.length > 0) {
      for (const s of this.options.speeds) {
        speedList.push(s);
      }
    }

    const outputFiles: string[] = [];
    let hasError = false;
    let lastError = '';

    for (const speed of speedList) {
      if (this.allCancelled || this.cancelledJobs.has(job.id)) {
        this.sendEvent(IPC_CHANNELS.JOB_FAILED, {
          jobId: job.id,
          errorMessage: 'キャンセルされました',
        });
        this.currentService = null;
        return;
      }

      const outputPath = this.buildOutputPath(job.inputPath, speed);

      this.sendLog('info', `変換開始: ${path.basename(job.inputPath)}${speed ? ` (${speed}x)` : ''}`);

      const result = await service.convert(
        job.inputPath,
        outputPath,
        this.options,
        speed,
        (progress) => {
          // 複数速度の場合、全体進捗を計算
          const speedIndex = speedList.indexOf(speed);
          const basePercent = (speedIndex / speedList.length) * 100;
          const segmentPercent = (progress.percent / speedList.length);
          const totalPercent = Math.round(basePercent + segmentPercent);

          this.sendEvent(IPC_CHANNELS.JOB_PROGRESS, {
            jobId: job.id,
            progress: totalPercent,
          });
        },
      );

      if (result.success) {
        outputFiles.push(result.outputPath);
        this.sendLog('info', `完了: ${path.basename(result.outputPath)}`);
      } else {
        hasError = true;
        lastError = result.errorMessage ?? '不明なエラー';
        this.sendLog('error', `エラー: ${path.basename(job.inputPath)} - ${lastError}`);
        break; // このジョブの残りの速度はスキップ
      }
    }

    this.currentService = null;

    if (hasError) {
      this.sendEvent(IPC_CHANNELS.JOB_FAILED, {
        jobId: job.id,
        errorMessage: lastError,
      });
    } else {
      this.sendEvent(IPC_CHANNELS.JOB_COMPLETED, {
        jobId: job.id,
        outputFiles,
      });
    }
  }

  /**
   * 出力ファイルパスを構築する
   * suffix: _normalized, _trimmed, _1.5x など
   */
  private buildOutputPath(inputPath: string, speed: number | null): string {
    const baseName = path.basename(inputPath, path.extname(inputPath));
    const suffixes: string[] = [];

    if (this.options.normalize) {
      suffixes.push('normalized');
    }
    if (this.options.silenceRemove) {
      suffixes.push('trimmed');
    }
    if (speed !== null) {
      suffixes.push(`${speed}x`);
    }

    const suffix = suffixes.length > 0 ? `_${suffixes.join('_')}` : '';
    const fileName = `${baseName}${suffix}.mp3`;

    // 出力先を決定
    let outputDir: string;
    if (this.options.outputToSameDir) {
      outputDir = path.dirname(inputPath);
    } else if (this.options.outputDir) {
      outputDir = this.options.outputDir;
    } else {
      outputDir = path.dirname(inputPath);
    }

    let outputPath = path.join(outputDir, fileName);

    // 同名ファイルが存在する場合は連番を付ける
    const fs = require('fs');
    if (fs.existsSync(outputPath)) {
      let counter = 1;
      while (fs.existsSync(outputPath)) {
        outputPath = path.join(outputDir, `${baseName}${suffix}_${counter}.mp3`);
        counter++;
      }
    }

    return outputPath;
  }

  private sendEvent(channel: string, data: unknown): void {
    if (!this.window.isDestroyed()) {
      this.window.webContents.send(channel, data);
    }
  }

  private sendLog(level: 'info' | 'warn' | 'error', message: string): void {
    this.sendEvent(IPC_CHANNELS.LOG_MESSAGE, {
      timestamp: Date.now(),
      level,
      message,
    });
  }
}
