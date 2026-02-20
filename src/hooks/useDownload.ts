import {useState, useCallback, useRef} from 'react';
import RNFS from 'react-native-fs';
import {
  downloadAlbum,
  cancel as cancelService,
  ProgressData,
  FileStatus,
} from '../services/DownloadService';
import {extractSlug} from '../utils';

export interface DownloadState {
  isDownloading: boolean;
  phase: string;
  statusTitle: string;
  albumTitle: string;
  files: FileStatus[];
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  totalBytes: number;
  speed: number;
  elapsed: number;
  progress: number; // 0-100
  doneMessage: string;
  targetDir: string;
  error: string;
}

const initialState: DownloadState = {
  isDownloading: false,
  phase: '',
  statusTitle: '',
  albumTitle: '',
  files: [],
  totalFiles: 0,
  completedFiles: 0,
  failedFiles: 0,
  totalBytes: 0,
  speed: 0,
  elapsed: 0,
  progress: 0,
  doneMessage: '',
  targetDir: '',
  error: '',
};

export function useDownload() {
  const [state, setState] = useState<DownloadState>(initialState);
  const stateRef = useRef<DownloadState>(initialState);
  const lastUpdateRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 节流更新：立即计算最新状态到 ref，但限制 setState 频率
  const flushState = useCallback(() => {
    lastUpdateRef.current = Date.now();
    setState(stateRef.current);
  }, []);

  const scheduleFlush = useCallback(() => {
    if (!timerRef.current) {
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        flushState();
      }, 200);
    }
  }, [flushState]);

  const handleProgress = useCallback(
    (data: ProgressData) => {
      const prev = stateRef.current;
      const next = {...prev};

      if (data.phase === 'parsing') {
        next.statusTitle = data.message ?? '解析中...';
      }

      if (data.phase === 'parsed') {
        next.albumTitle = data.albumTitle ?? '';
        next.statusTitle = data.albumTitle ?? '';
        next.totalFiles = data.totalFiles ?? 0;
      }

      if (data.phase === 'downloading') {
        next.phase = 'downloading';
        next.totalFiles = data.totalFiles ?? 0;
        next.completedFiles = data.completedFiles ?? 0;
        next.failedFiles = data.failedFiles ?? 0;
        next.totalBytes = data.totalBytes ?? 0;
        next.speed = data.speed ?? 0;
        next.elapsed = data.elapsed ?? 0;
        next.files = data.files ? data.files.map(f => ({...f})) : prev.files;
        next.progress =
          next.totalFiles > 0
            ? ((next.completedFiles + next.failedFiles) / next.totalFiles) * 100
            : 0;
      }

      if (data.phase === 'done') {
        next.phase = 'done';
        next.isDownloading = false;
        next.progress = 100;
        next.statusTitle = '下载完成';
        next.completedFiles = data.completedFiles ?? 0;
        next.failedFiles = data.failedFiles ?? 0;
        next.elapsed = data.elapsed ?? 0;
        next.doneMessage = data.message ?? '';
        next.files = data.files ? data.files.map(f => ({...f})) : prev.files;
      }

      if (data.phase === 'cancelled') {
        next.phase = 'cancelled';
        next.isDownloading = false;
        next.statusTitle = '已取消';
      }

      stateRef.current = next;

      // done/cancelled/parsing/parsed 立即刷新，downloading 节流
      if (data.phase !== 'downloading') {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        flushState();
      } else {
        const now = Date.now();
        if (now - lastUpdateRef.current >= 200) {
          flushState();
        } else {
          scheduleFlush();
        }
      }
    },
    [flushState, scheduleFlush],
  );

  const startDownload = useCallback(
    async (url: string, savePath: string, concurrency: number) => {
      const slug = extractSlug(url);
      const targetDir = `${savePath}/${slug}`;

      const init = {
        ...initialState,
        isDownloading: true,
        phase: 'parsing',
        statusTitle: '准备中...',
        targetDir,
      };
      stateRef.current = init;
      setState(init);

      try {
        await downloadAlbum({
          albumUrl: url,
          targetDir,
          concurrency,
          onProgress: handleProgress,
        });
      } catch (err: any) {
        const errState = {
          ...stateRef.current,
          isDownloading: false,
          phase: 'error',
          error: err.message,
        };
        stateRef.current = errState;
        setState(errState);
      }
    },
    [handleProgress],
  );

  const cancelDownload = useCallback(() => {
    cancelService();
  }, []);

  const reset = useCallback(() => {
    stateRef.current = initialState;
    setState(initialState);
  }, []);

  const defaultSavePath = RNFS.DownloadDirectoryPath;

  return {state, startDownload, cancelDownload, reset, defaultSavePath};
}
