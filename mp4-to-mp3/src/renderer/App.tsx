import React, { useReducer, useEffect, useCallback } from 'react';
import {
  ConversionJob,
  AppSettings,
  DEFAULT_SETTINGS,
  LogEntry,
  JobStatus,
} from '../shared/types';
import Header from './components/Header';
import FileDropZone from './components/FileDropZone';
import JobList from './components/JobList';
import SettingsPanel from './components/SettingsPanel';
import ActionButtons from './components/ActionButtons';
import LogPanel from './components/LogPanel';

// ===== State =====

interface AppState {
  jobs: ConversionJob[];
  settings: AppSettings;
  logs: LogEntry[];
  isConverting: boolean;
}

type AppAction =
  | { type: 'ADD_FILES'; paths: string[] }
  | { type: 'REMOVE_JOB'; id: string }
  | { type: 'CLEAR_JOBS' }
  | { type: 'SET_SETTINGS'; settings: AppSettings }
  | { type: 'SET_CONVERTING'; value: boolean }
  | { type: 'UPDATE_JOB_STATUS'; id: string; status: JobStatus }
  | { type: 'UPDATE_JOB_PROGRESS'; id: string; progress: number }
  | { type: 'JOB_COMPLETED'; id: string; outputFiles: string[] }
  | { type: 'JOB_FAILED'; id: string; errorMessage: string }
  | { type: 'MARK_ALL_QUEUED' }
  | { type: 'ADD_LOG'; entry: LogEntry }
  | { type: 'CLEAR_LOGS' };

let jobCounter = 0;
function generateJobId(): string {
  return `job-${Date.now()}-${++jobCounter}`;
}

function extractFileName(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || filePath;
}

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'ADD_FILES': {
      const existingPaths = new Set(state.jobs.map((j) => j.inputPath));
      const newJobs: ConversionJob[] = action.paths
        .filter((p) => !existingPaths.has(p))
        .map((p) => ({
          id: generateJobId(),
          inputPath: p,
          fileName: extractFileName(p),
          duration: null,
          status: 'pending' as JobStatus,
          progress: 0,
          outputFiles: [],
          errorMessage: null,
        }));
      return { ...state, jobs: [...state.jobs, ...newJobs] };
    }
    case 'REMOVE_JOB':
      return { ...state, jobs: state.jobs.filter((j) => j.id !== action.id) };
    case 'CLEAR_JOBS':
      return { ...state, jobs: [], isConverting: false };
    case 'SET_SETTINGS':
      return { ...state, settings: action.settings };
    case 'SET_CONVERTING':
      return { ...state, isConverting: action.value };
    case 'UPDATE_JOB_STATUS':
      return {
        ...state,
        jobs: state.jobs.map((j) =>
          j.id === action.id ? { ...j, status: action.status } : j
        ),
      };
    case 'UPDATE_JOB_PROGRESS':
      return {
        ...state,
        jobs: state.jobs.map((j) =>
          j.id === action.id ? { ...j, progress: action.progress, status: 'processing' } : j
        ),
      };
    case 'JOB_COMPLETED':
      return {
        ...state,
        jobs: state.jobs.map((j) =>
          j.id === action.id
            ? { ...j, status: 'completed', progress: 100, outputFiles: action.outputFiles }
            : j
        ),
      };
    case 'JOB_FAILED':
      return {
        ...state,
        jobs: state.jobs.map((j) =>
          j.id === action.id
            ? { ...j, status: 'failed', errorMessage: action.errorMessage }
            : j
        ),
      };
    case 'MARK_ALL_QUEUED':
      return {
        ...state,
        jobs: state.jobs.map((j) =>
          j.status === 'pending' ? { ...j, status: 'queued' } : j
        ),
      };
    case 'ADD_LOG':
      return { ...state, logs: [...state.logs, action.entry] };
    case 'CLEAR_LOGS':
      return { ...state, logs: [] };
    default:
      return state;
  }
}

const initialState: AppState = {
  jobs: [],
  settings: { ...DEFAULT_SETTINGS },
  logs: [],
  isConverting: false,
};

export default function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // 起動時に設定を読み込む
  useEffect(() => {
    window.electronAPI?.getSettings().then((settings) => {
      if (settings) {
        dispatch({ type: 'SET_SETTINGS', settings });
      }
    });
  }, []);

  // IPC イベントリスナー
  useEffect(() => {
    if (!window.electronAPI) return;

    const unsubProgress = window.electronAPI.onJobProgress((event) => {
      dispatch({ type: 'UPDATE_JOB_PROGRESS', id: event.jobId, progress: event.progress });
    });

    const unsubCompleted = window.electronAPI.onJobCompleted((event) => {
      dispatch({ type: 'JOB_COMPLETED', id: event.jobId, outputFiles: event.outputFiles });
    });

    const unsubFailed = window.electronAPI.onJobFailed((event) => {
      dispatch({ type: 'JOB_FAILED', id: event.jobId, errorMessage: event.errorMessage });
    });

    const unsubLog = window.electronAPI.onLogMessage((entry) => {
      dispatch({ type: 'ADD_LOG', entry });
    });

    return () => {
      unsubProgress();
      unsubCompleted();
      unsubFailed();
      unsubLog();
    };
  }, []);

  // ファイル追加
  const handleAddFiles = useCallback(async () => {
    const paths = await window.electronAPI.selectFiles();
    if (paths.length > 0) {
      dispatch({ type: 'ADD_FILES', paths });
    }
  }, []);

  // フォルダ追加
  const handleAddFolder = useCallback(async () => {
    const paths = await window.electronAPI.selectFolder();
    if (paths.length > 0) {
      dispatch({ type: 'ADD_FILES', paths });
    }
  }, []);

  // ドロップ
  const handleDrop = useCallback((paths: string[]) => {
    const mp4Paths = paths.filter((p) => /\.mp4$/i.test(p));
    if (mp4Paths.length > 0) {
      dispatch({ type: 'ADD_FILES', paths: mp4Paths });
    }
  }, []);

  // 出力先選択
  const handleSelectOutputFolder = useCallback(async () => {
    const folder = await window.electronAPI.selectOutputFolder();
    if (folder) {
      const newSettings = { ...state.settings, outputDir: folder, outputToSameDir: false };
      dispatch({ type: 'SET_SETTINGS', settings: newSettings });
      await window.electronAPI.saveSettings(newSettings);
    }
  }, [state.settings]);

  // 設定変更
  const handleSettingsChange = useCallback(async (settings: AppSettings) => {
    dispatch({ type: 'SET_SETTINGS', settings });
    await window.electronAPI?.saveSettings(settings);
  }, []);

  // 変換開始
  const handleStartConversion = useCallback(async () => {
    const pendingJobs = state.jobs.filter(
      (j) => j.status === 'pending' || j.status === 'failed'
    );
    if (pendingJobs.length === 0) return;

    dispatch({ type: 'SET_CONVERTING', value: true });
    dispatch({ type: 'MARK_ALL_QUEUED' });

    try {
      await window.electronAPI.startConversion({
        jobs: pendingJobs.map((j) => ({ id: j.id, inputPath: j.inputPath })),
        options: state.settings,
      });
    } finally {
      dispatch({ type: 'SET_CONVERTING', value: false });
    }
  }, [state.jobs, state.settings]);

  // 停止
  const handleStop = useCallback(async () => {
    await window.electronAPI.cancelAll();
    dispatch({ type: 'SET_CONVERTING', value: false });
  }, []);

  // クリア
  const handleClear = useCallback(() => {
    dispatch({ type: 'CLEAR_JOBS' });
    dispatch({ type: 'CLEAR_LOGS' });
  }, []);

  // ジョブ削除
  const handleRemoveJob = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_JOB', id });
  }, []);

  // 出力先を開く
  const handleOpenOutput = useCallback(async () => {
    if (state.settings.outputDir) {
      await window.electronAPI.openFolder(state.settings.outputDir);
    } else {
      // 最初の完了ジョブの出力先を開く
      const completed = state.jobs.find((j) => j.status === 'completed' && j.outputFiles.length > 0);
      if (completed) {
        const filePath = completed.outputFiles[0];
        const folder = filePath.replace(/\\/g, '/').split('/').slice(0, -1).join('/');
        await window.electronAPI.openFolder(folder);
      }
    }
  }, [state.settings.outputDir, state.jobs]);

  const pendingCount = state.jobs.filter(
    (j) => j.status === 'pending' || j.status === 'queued'
  ).length;
  const completedCount = state.jobs.filter((j) => j.status === 'completed').length;

  return (
    <div className="app">
      <Header />
      <div className="app-body">
        <div className="main-area">
          <FileDropZone
            onAddFiles={handleAddFiles}
            onAddFolder={handleAddFolder}
            onDrop={handleDrop}
          />
          <JobList jobs={state.jobs} onRemoveJob={handleRemoveJob} />
          <ActionButtons
            onStart={handleStartConversion}
            onStop={handleStop}
            onClear={handleClear}
            onOpenOutput={handleOpenOutput}
            isConverting={state.isConverting}
            hasJobs={state.jobs.length > 0}
            pendingCount={pendingCount}
            completedCount={completedCount}
          />
          <LogPanel logs={state.logs} />
        </div>
        <div className="sidebar">
          <SettingsPanel
            settings={state.settings}
            onChange={handleSettingsChange}
            onSelectOutputFolder={handleSelectOutputFolder}
          />
        </div>
      </div>
    </div>
  );
}
