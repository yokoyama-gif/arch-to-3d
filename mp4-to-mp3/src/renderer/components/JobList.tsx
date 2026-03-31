import React from 'react';
import { ConversionJob } from '../../shared/types';

interface Props {
  jobs: ConversionJob[];
  onRemoveJob: (id: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
  pending: '待機中',
  queued: 'キュー',
  processing: '変換中',
  completed: '完了',
  failed: 'エラー',
  cancelled: 'キャンセル',
};

export default function JobList({ jobs, onRemoveJob }: Props) {
  if (jobs.length === 0) {
    return (
      <div className="job-list">
        <div className="job-list-empty">
          ファイルを追加すると、ここに一覧が表示されます
        </div>
      </div>
    );
  }

  return (
    <div className="job-list">
      <div className="job-list-header">
        ファイル一覧（{jobs.length}件）
      </div>
      {jobs.map((job) => (
        <div key={job.id} className="job-item">
          <span className="job-name" title={job.inputPath}>
            {job.fileName}
          </span>
          {job.status === 'processing' && (
            <div className="job-progress-bar">
              <div
                className="job-progress-fill"
                style={{ width: `${job.progress}%` }}
              />
            </div>
          )}
          <span className={`job-status ${job.status}`}>
            {STATUS_LABELS[job.status] ?? job.status}
            {job.status === 'processing' && ` ${job.progress}%`}
          </span>
          {job.status === 'completed' && job.outputFiles.length > 0 && (
            <span className="job-status completed" title={job.outputFiles.join('\n')}>
              {job.outputFiles.length}ファイル
            </span>
          )}
          {job.errorMessage && (
            <span className="job-error" title={job.errorMessage}>
              {job.errorMessage}
            </span>
          )}
          <button
            className="job-remove"
            onClick={() => onRemoveJob(job.id)}
            title="削除"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
