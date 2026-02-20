import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  StatusBar,
  Clipboard,
} from 'react-native';
import {pickDirectory} from '@react-native-documents/picker';
import {useDownload} from '../hooks/useDownload';
import {ProgressBar} from '../components/ProgressBar';
import {FileListItem} from '../components/FileListItem';
import {Colors, Radius} from '../theme';
import {formatSize, formatSpeed, formatTime} from '../utils';
import type {FileStatus} from '../services/DownloadService';

const CONCURRENCY_OPTIONS = [1, 2, 3, 4, 5, 6, 8];
const ITEM_HEIGHT = 34; // 固定行高，FlatList 优化

export function HomeScreen() {
  const {state, startDownload, cancelDownload, reset, defaultSavePath} =
    useDownload();
  const [url, setUrl] = useState('');
  const [savePath, setSavePath] = useState(defaultSavePath);
  const [concurrency, setConcurrency] = useState(3);

  const handleBrowse = useCallback(async () => {
    try {
      const result = await pickDirectory();
      if (result?.uri) {
        setSavePath(result.uri);
      }
    } catch {
      // 用户取消
    }
  }, []);

  const handleStart = useCallback(() => {
    const trimmed = url.trim();
    if (!trimmed) {
      return;
    }
    if (!trimmed.includes('downloads.khinsider.com/game-soundtracks/album/')) {
      Alert.alert('提示', '请输入有效的 KHInsider 专辑链接');
      return;
    }
    startDownload(trimmed, savePath, concurrency);
  }, [url, savePath, concurrency, startDownload]);

  const handleOpenFolder = useCallback(() => {
    Clipboard.setString(state.targetDir);
    Alert.alert('已复制', `路径已复制到剪贴板：\n${state.targetDir}`);
  }, [state.targetDir]);

  const renderItem = useCallback(
    ({item}: {item: FileStatus}) => <FileListItem file={item} />,
    [],
  );

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    [],
  );

  const keyExtractor = useCallback(
    (item: FileStatus) => String(item.index),
    [],
  );

  const isActive = state.isDownloading;
  const showStatus = isActive || state.phase === 'done';
  const showFiles = state.files.length > 0;
  const showDone = state.phase === 'done';

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={Colors.bg} barStyle="light-content" />

      {/* 标题 */}
      <Text style={styles.title}>KHInsider Downloader</Text>

      {/* URL 输入 */}
      <TextInput
        style={styles.input}
        placeholder="粘贴 KHInsider 专辑链接..."
        placeholderTextColor={Colors.textDim}
        value={url}
        onChangeText={setUrl}
        editable={!isActive}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {/* 保存路径 */}
      <View style={styles.pathRow}>
        <Text style={styles.label}>保存到</Text>
        <Text style={styles.pathText} numberOfLines={1}>
          {savePath}
        </Text>
        <TouchableOpacity
          style={styles.btnSecondary}
          onPress={handleBrowse}
          disabled={isActive}>
          <Text style={styles.btnSecondaryText}>浏览</Text>
        </TouchableOpacity>
      </View>

      {/* 并发选择器 + 操作按钮 */}
      <View style={styles.settingsRow}>
        <Text style={styles.label}>线程</Text>
        <View style={styles.concurrencyGroup}>
          {CONCURRENCY_OPTIONS.map(n => (
            <TouchableOpacity
              key={n}
              style={[
                styles.concurrencyBtn,
                concurrency === n && styles.concurrencyBtnActive,
              ]}
              onPress={() => setConcurrency(n)}
              disabled={isActive}>
              <Text
                style={[
                  styles.concurrencyText,
                  concurrency === n && styles.concurrencyTextActive,
                ]}>
                {n}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.actions}>
          {!isActive ? (
            <TouchableOpacity style={styles.btnPrimary} onPress={handleStart}>
              <Text style={styles.btnPrimaryText}>开始下载</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.btnCancel}
              onPress={cancelDownload}>
              <Text style={styles.btnPrimaryText}>取消</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 状态栏 */}
      {showStatus && (
        <View style={styles.statusBar}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusTitle}>{state.statusTitle}</Text>
          </View>
          <View style={styles.statsRow}>
            <Text style={styles.statLabel}>
              进度{' '}
              <Text style={styles.statValue}>
                {state.completedFiles}/{state.totalFiles}
                {state.failedFiles > 0 && ` (${state.failedFiles} 失败)`}
              </Text>
            </Text>
            <Text style={styles.statLabel}>
              速度 <Text style={styles.statValue}>{formatSpeed(state.speed)}</Text>
            </Text>
            <Text style={styles.statLabel}>
              已下载{' '}
              <Text style={styles.statValue}>
                {formatSize(state.totalBytes)}
              </Text>
            </Text>
            <Text style={styles.statLabel}>
              耗时{' '}
              <Text style={styles.statValue}>
                {formatTime(state.elapsed)}
              </Text>
            </Text>
          </View>
          <ProgressBar
            progress={state.progress}
            isDone={state.phase === 'done'}
          />
        </View>
      )}

      {/* 文件列表 */}
      {showFiles && (
        <View style={styles.fileListContainer}>
          <Text style={styles.fileListHeader}>
            文件列表 ({state.totalFiles} 首)
          </Text>
          <FlatList
            data={state.files}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            getItemLayout={getItemLayout}
            style={styles.fileList}
            initialNumToRender={20}
            maxToRenderPerBatch={10}
            windowSize={5}
          />
        </View>
      )}

      {/* 完成消息 */}
      {showDone && (
        <View style={styles.doneMessage}>
          <Text style={styles.doneText}>{state.doneMessage}</Text>
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={handleOpenFolder}>
            <Text style={styles.btnPrimaryText}>复制文件夹路径</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    padding: 16,
    paddingTop: 8,
  },
  title: {
    fontSize: 16,
    color: Colors.textDim,
    textAlign: 'center',
    marginBottom: 12,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surface2,
    borderRadius: Radius,
    color: Colors.text,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  pathRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    color: Colors.textDim,
  },
  pathText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surface2,
    borderRadius: Radius,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  concurrencyGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  concurrencyBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surface2,
  },
  concurrencyBtnActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  concurrencyText: {
    fontSize: 13,
    color: Colors.textDim,
  },
  concurrencyTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  actions: {
    flex: 1,
    alignItems: 'flex-end',
  },
  btnPrimary: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Radius,
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  btnCancel: {
    backgroundColor: Colors.error,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Radius,
  },
  btnSecondary: {
    backgroundColor: Colors.surface2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius,
  },
  btnSecondaryText: {
    color: Colors.text,
    fontSize: 12,
  },
  statusBar: {
    backgroundColor: Colors.surface,
    borderRadius: Radius,
    padding: 12,
    marginBottom: 12,
  },
  statusHeader: {
    marginBottom: 8,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textDim,
  },
  statValue: {
    color: Colors.text,
    fontWeight: '500',
  },
  fileListContainer: {
    flex: 1,
    marginBottom: 8,
  },
  fileListHeader: {
    fontSize: 13,
    color: Colors.textDim,
    marginBottom: 8,
  },
  fileList: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius,
    padding: 4,
  },
  doneMessage: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  doneText: {
    fontSize: 14,
    color: Colors.text,
  },
});
