import React, { useState, useCallback } from 'react';

interface Props {
  onAddFiles: () => void;
  onAddFolder: () => void;
  onDrop: (paths: string[]) => void;
}

export default function FileDropZone({ onAddFiles, onAddFolder, onDrop }: Props) {
  const [dragging, setDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(false);

      const files = Array.from(e.dataTransfer.files);
      const paths = files
        .filter((f) => f.name.toLowerCase().endsWith('.mp4'))
        .map((f) => f.path);
      if (paths.length > 0) {
        onDrop(paths);
      }
    },
    [onDrop]
  );

  return (
    <div
      className={`drop-zone ${dragging ? 'dragging' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="drop-zone-label">
        MP4ファイルをドラッグ＆ドロップ、またはボタンで追加
      </div>
      <div className="drop-zone-buttons">
        <button className="btn btn-primary" onClick={onAddFiles}>
          ファイルを追加
        </button>
        <button className="btn btn-outline" onClick={onAddFolder}>
          フォルダから追加
        </button>
      </div>
    </div>
  );
}
