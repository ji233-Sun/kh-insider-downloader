import * as cheerio from 'cheerio';
import RNFS from 'react-native-fs';

// ---- 类型定义 ----

export type FileStatusType = 'pending' | 'downloading' | 'retrying' | 'done' | 'failed';

export interface FileStatus {
  index: number;
  name: string;
  status: FileStatusType;
  size: number;
  retryCount?: number;
  error?: string;
}

export interface ProgressData {
  phase: 'parsing' | 'parsed' | 'downloading' | 'done' | 'cancelled';
  message?: string;
  albumTitle?: string;
  totalFiles?: number;
  completedFiles?: number;
  failedFiles?: number;
  totalBytes?: number;
  speed?: number;
  elapsed?: number;
  files?: FileStatus[];
}

export interface DownloadOptions {
  albumUrl: string;
  targetDir: string;
  concurrency?: number;
  maxRetries?: number;
  onProgress: (data: ProgressData) => void;
}

// ---- 内部状态 ----

let cancelFlag = false;
let abortController: AbortController | null = null;

export function cancel(): void {
  cancelFlag = true;
  abortController?.abort();
}

// ---- HTTP 工具 ----

const UA = 'Mozilla/5.0';

async function httpGet(url: string): Promise<string> {
  const controller = new AbortController();
  abortController = controller;
  const res = await fetch(url, {
    headers: {'User-Agent': UA},
    signal: controller.signal as any,
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.text();
}

// ---- 页面解析（cheerio 纯 JS，直接复用） ----

async function parseAlbumPage(
  albumUrl: string,
): Promise<{title: string; songLinks: string[]}> {
  const html = await httpGet(albumUrl);
  const $ = cheerio.load(html);

  const title = $('h2').first().text().trim() || 'Unknown Album';

  const songLinks: string[] = [];
  $('table#songlist tr').each((_, tr) => {
    const anchor = $(tr).find('td.clickable-row a').first();
    if (anchor.length) {
      const href = anchor.attr('href');
      if (href && !songLinks.includes(href)) {
        songLinks.push(href);
      }
    }
  });

  return {title, songLinks: [...new Set(songLinks)]};
}

async function parseSongPage(
  songPageUrl: string,
): Promise<{downloadUrl: string | null; fileName: string | null}> {
  const fullUrl = songPageUrl.startsWith('http')
    ? songPageUrl
    : `https://downloads.khinsider.com${songPageUrl}`;

  const html = await httpGet(fullUrl);
  const $ = cheerio.load(html);

  let downloadUrl: string | null = null;

  const mp3Link = $('a[href*=".mp3"]').first();
  const flacLink = $('a[href*=".flac"]').first();

  if (flacLink.length) {
    downloadUrl = flacLink.attr('href') ?? null;
  }
  if (!downloadUrl && mp3Link.length) {
    downloadUrl = mp3Link.attr('href') ?? null;
  }
  if (!downloadUrl) {
    const audio = $('audio source').first();
    if (audio.length) {
      downloadUrl = audio.attr('src') ?? null;
    }
  }

  const fileName = downloadUrl
    ? decodeURIComponent(downloadUrl.split('/').pop()!)
    : null;

  return {downloadUrl, fileName};
}

// ---- 文件下载（RNFS 替代 Node fs） ----

async function downloadFile(
  url: string,
  destPath: string,
): Promise<{bytesWritten: number}> {
  const result = await RNFS.downloadFile({
    fromUrl: url,
    toFile: destPath,
    headers: {'User-Agent': UA},
    progressInterval: 500,
  }).promise;

  if (result.statusCode !== 200) {
    // 清理失败文件
    const exists = await RNFS.exists(destPath);
    if (exists) {
      await RNFS.unlink(destPath);
    }
    throw new Error(`HTTP ${result.statusCode} for ${url}`);
  }

  return {bytesWritten: result.bytesWritten};
}

// ---- 工具函数 ----

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---- 主下载流程 ----

export async function downloadAlbum({
  albumUrl,
  targetDir,
  concurrency = 3,
  maxRetries = 5,
  onProgress,
}: DownloadOptions): Promise<void> {
  cancelFlag = false;

  // 1. 解析专辑页面
  onProgress({phase: 'parsing', message: '正在解析专辑页面...'});
  const {title, songLinks} = await parseAlbumPage(albumUrl);

  if (songLinks.length === 0) {
    throw new Error('未找到任何歌曲链接，请检查 URL 是否正确');
  }

  onProgress({
    phase: 'parsed',
    albumTitle: title,
    totalFiles: songLinks.length,
    message: `找到 ${songLinks.length} 首歌曲`,
  });

  // 2. 创建目标目录
  await RNFS.mkdir(targetDir);

  // 3. 并发 worker 池（逻辑完全保留）
  const totalFiles = songLinks.length;
  let completedFiles = 0;
  let failedFiles = 0;
  let totalBytes = 0;
  const startTime = Date.now();

  const fileStatuses: FileStatus[] = songLinks.map((_, i) => ({
    index: i,
    name: `歌曲 ${i + 1}`,
    status: 'pending' as FileStatusType,
    size: 0,
  }));

  function emitProgress(): void {
    const elapsed = (Date.now() - startTime) / 1000;
    const speed = elapsed > 0 ? totalBytes / elapsed : 0;
    onProgress({
      phase: 'downloading',
      totalFiles,
      completedFiles,
      failedFiles,
      totalBytes,
      speed,
      elapsed,
      files: fileStatuses,
    });
  }

  let currentIndex = 0;

  async function worker(): Promise<void> {
    while (currentIndex < songLinks.length) {
      if (cancelFlag) {
        return;
      }

      const idx = currentIndex++;
      const songPageUrl = songLinks[idx];

      fileStatuses[idx].status = 'downloading';
      fileStatuses[idx].retryCount = 0;
      emitProgress();

      let lastError: string = '';

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (cancelFlag) {
          return;
        }

        // 重试前等待递增延时（3s, 6s, 9s...）
        if (attempt > 0) {
          fileStatuses[idx].status = 'retrying';
          fileStatuses[idx].retryCount = attempt;
          fileStatuses[idx].error = `第 ${attempt}/${maxRetries} 次重试，等待 ${attempt * 3}s...`;
          emitProgress();
          await delay(attempt * 3000);
          if (cancelFlag) {
            return;
          }
          fileStatuses[idx].status = 'downloading';
          fileStatuses[idx].error = undefined;
          emitProgress();
        }

        try {
          const {downloadUrl, fileName} = await parseSongPage(songPageUrl);
          if (!downloadUrl) {
            throw new Error('未找到下载链接');
          }

          fileStatuses[idx].name = fileName || `track_${idx + 1}.mp3`;
          emitProgress();

          const destPath = `${targetDir}/${fileStatuses[idx].name}`;

          // 跳过已存在的文件
          const exists = await RNFS.exists(destPath);
          if (exists) {
            const stat = await RNFS.stat(destPath);
            if (Number(stat.size) > 0) {
              fileStatuses[idx].status = 'done';
              fileStatuses[idx].size = Number(stat.size);
              fileStatuses[idx].retryCount = attempt;
              completedFiles++;
              totalBytes += Number(stat.size);
              emitProgress();
              lastError = '';
              break;
            }
          }

          const {bytesWritten} = await downloadFile(downloadUrl, destPath);
          fileStatuses[idx].status = 'done';
          fileStatuses[idx].size = bytesWritten;
          fileStatuses[idx].retryCount = attempt;
          completedFiles++;
          totalBytes += bytesWritten;
          lastError = '';
          break;
        } catch (err: any) {
          lastError = err.message;
          // 最后一次尝试也失败，标记为 failed
          if (attempt === maxRetries) {
            fileStatuses[idx].status = 'failed';
            fileStatuses[idx].error = `${lastError}（已重试 ${maxRetries} 次）`;
            fileStatuses[idx].retryCount = attempt;
            failedFiles++;
          }
        }
      }

      emitProgress();
    }
  }

  const workers: Promise<void>[] = [];
  for (let i = 0; i < concurrency; i++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  if (cancelFlag) {
    onProgress({phase: 'cancelled', message: '下载已取消'});
    return;
  }

  const elapsed = (Date.now() - startTime) / 1000;
  onProgress({
    phase: 'done',
    totalFiles,
    completedFiles,
    failedFiles,
    totalBytes,
    elapsed,
    message: `下载完成！${completedFiles}/${totalFiles} 成功，耗时 ${elapsed.toFixed(1)}s`,
  });
}
