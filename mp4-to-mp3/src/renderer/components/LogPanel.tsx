import React, { useRef, useEffect } from 'react';
import { LogEntry } from '../../shared/types';

interface Props {
  logs: LogEntry[];
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString('ja-JP', { hour12: false });
}

export default function LogPanel({ logs }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  return (
    <div className="log-panel">
      {logs.length === 0 ? (
        <div className="log-empty">ログがここに表示されます</div>
      ) : (
        logs.map((entry, i) => (
          <div key={i} className={`log-entry ${entry.level}`}>
            <span className="log-time">{formatTime(entry.timestamp)}</span>
            {entry.message}
          </div>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  );
}
