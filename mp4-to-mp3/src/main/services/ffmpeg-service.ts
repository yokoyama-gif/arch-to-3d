import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { ConversionOptions } from '../../shared/types';

export interface FFmpegProgress {
  percent: number;
  time: string;
}

export interface FFmpegResult {
  success: boolean;
  outputPath: string;
  errorMessage: string | null;
}

export class FFmpegService {
  private currentProcess: ChildProcess | null = null;
  private cancelled = false;

  /**
   * FFmpegのパスを解決する。
   * 1. PATHに存在すればそのまま使う
   * 2. アプリ同梱の場合は assets/ffmpeg を探す
   */
  static getFFmpegPath(): string {
    // まずPATHから探す
    return 'ffmpeg';
  }

  static getFFprobePath(): string {
    return 'ffprobe';
  }

  /**
   * FFmpegが利用可能か確認
   */
  static async checkAvailability(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn(FFmpegService.getFFmpegPath(), ['-version'], {
        stdio: 'pipe',
        shell: true,
      });
      proc.on('close', (code) => resolve(code === 0));
      proc.on('error', () => resolve(false));
    });
  }

  /**
   * ffprobeで音声の長さ（秒）を取得
   */
  static async getDuration(inputPath: string): Promise<number | null> {
    return new Promise((resolve) => {
      const args = [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'csv=p=0',
        inputPath,
      ];
      const proc = spawn(FFmpegService.getFFprobePath(), args, {
        stdio: 'pipe',
        shell: true,
      });
      let output = '';
      proc.stdout.on('data', (data) => { output += data.toString(); });
      proc.on('close', (code) => {
        if (code !== 0) return resolve(null);
        const duration = parseFloat(output.trim());
        resolve(isNaN(duration) ? null : duration);
      });
      proc.on('error', () => resolve(null));
    });
  }

  /**
   * MP4→MP3変換を実行
   */
  async convert(
    inputPath: string,
    outputPath: string,
    options: ConversionOptions,
    speed: number | null,
    onProgress?: (progress: FFmpegProgress) => void,
  ): Promise<FFmpegResult> {
    this.cancelled = false;

    // 出力ディレクトリを確認・作成
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 総再生時間を取得（進捗計算用）
    const totalDuration = await FFmpegService.getDuration(inputPath);

    // FFmpegコマンド構築
    const args = this.buildArgs(inputPath, outputPath, options, speed);

    return new Promise((resolve) => {
      const proc = spawn(FFmpegService.getFFmpegPath(), args, {
        stdio: 'pipe',
        shell: true,
      });
      this.currentProcess = proc;

      let stderrOutput = '';

      proc.stderr?.on('data', (data: Buffer) => {
        const line = data.toString();
        stderrOutput += line;

        // 進捗をパース
        if (totalDuration && onProgress) {
          const timeMatch = line.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
          if (timeMatch) {
            const hours = parseInt(timeMatch[1]);
            const minutes = parseInt(timeMatch[2]);
            const seconds = parseInt(timeMatch[3]);
            const currentTime = hours * 3600 + minutes * 60 + seconds;
            const percent = Math.min(100, Math.round((currentTime / totalDuration) * 100));
            onProgress({ percent, time: `${hours}:${minutes}:${seconds}` });
          }
        }
      });

      proc.on('close', (code) => {
        this.currentProcess = null;

        if (this.cancelled) {
          // キャンセル時は中間ファイルを削除
          this.cleanupFile(outputPath);
          resolve({
            success: false,
            outputPath,
            errorMessage: 'キャンセルされました',
          });
          return;
        }

        if (code !== 0) {
          this.cleanupFile(outputPath);
          // エラーメッセージを抽出
          const errorMsg = this.extractErrorMessage(stderrOutput);
          resolve({
            success: false,
            outputPath,
            errorMessage: errorMsg,
          });
          return;
        }

        resolve({
          success: true,
          outputPath,
          errorMessage: null,
        });
      });

      proc.on('error', (err) => {
        this.currentProcess = null;
        this.cleanupFile(outputPath);
        resolve({
          success: false,
          outputPath,
          errorMessage: `FFmpegの実行に失敗しました: ${err.message}`,
        });
      });
    });
  }

  /**
   * 現在の処理をキャンセル
   */
  cancel(): void {
    this.cancelled = true;
    if (this.currentProcess && !this.currentProcess.killed) {
      this.currentProcess.kill('SIGTERM');
    }
  }

  /**
   * FFmpegの引数を組み立てる
   */
  private buildArgs(
    inputPath: string,
    outputPath: string,
    options: ConversionOptions,
    speed: number | null,
  ): string[] {
    const args: string[] = [
      '-i', inputPath,
      '-vn', // 映像を除外
      '-y',  // 上書き確認なし（命名で競合回避済み）
    ];

    // オーディオフィルタを構築
    const filters: string[] = [];

    // 音量均一化
    if (options.normalize) {
      filters.push('loudnorm=I=-16:TP=-1.5:LRA=11');
    }

    // 無音カット
    if (options.silenceRemove) {
      const threshold = `${options.silenceThreshold}dB`;
      const minDuration = options.silenceMinDuration;
      // silenceremove: 先頭と末尾の無音を除去し、中間の長い無音も短縮
      filters.push(
        `silenceremove=stop_periods=-1:stop_duration=${minDuration}:stop_threshold=${threshold}`
      );
    }

    // 倍速
    if (speed !== null && speed !== 1.0) {
      // atempoは0.5〜2.0の範囲。2.0超はチェインする
      if (speed <= 2.0) {
        filters.push(`atempo=${speed}`);
      } else {
        // 例: 3.0x → atempo=2.0,atempo=1.5
        filters.push(`atempo=2.0`);
        filters.push(`atempo=${speed / 2.0}`);
      }
    }

    if (filters.length > 0) {
      args.push('-af', filters.join(','));
    }

    // ビットレート
    args.push('-b:a', `${options.bitrate}k`);

    // 出力形式
    args.push('-codec:a', 'libmp3lame');

    args.push(outputPath);

    return args;
  }

  private cleanupFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // 削除失敗は無視
    }
  }

  private extractErrorMessage(stderr: string): string {
    // よくあるエラーパターンを抽出
    if (stderr.includes('No such file or directory')) {
      return '入力ファイルが見つかりません';
    }
    if (stderr.includes('Invalid data found')) {
      return 'ファイルが壊れているか、対応していない形式です';
    }
    if (stderr.includes('does not contain any stream') || stderr.includes('Output file does not contain any stream')) {
      return 'このファイルには音声が含まれていません';
    }
    if (stderr.includes('Permission denied')) {
      return '出力先への書き込み権限がありません';
    }
    // 最後の数行からエラーを取る
    const lines = stderr.trim().split('\n');
    const lastLines = lines.slice(-3).join(' ').trim();
    return lastLines.length > 200 ? lastLines.substring(0, 200) + '...' : lastLines || '変換中にエラーが発生しました';
  }
}
