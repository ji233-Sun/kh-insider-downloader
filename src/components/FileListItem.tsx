import React, {memo} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {Colors} from '../theme';
import {formatSize} from '../utils';
import type {FileStatus} from '../services/DownloadService';

interface Props {
  file: FileStatus;
}

const statusColors: Record<string, string> = {
  pending: Colors.textDim,
  downloading: Colors.warning,
  retrying: Colors.warning,
  done: Colors.success,
  failed: Colors.error,
};

function FileListItemInner({file}: Props) {
  const retryLabel =
    file.status === 'retrying' && file.retryCount
      ? ` (重试 ${file.retryCount})`
      : '';

  return (
    <View style={styles.row}>
      <View
        style={[
          styles.dot,
          {backgroundColor: statusColors[file.status] ?? Colors.textDim},
        ]}
      />
      <Text style={styles.name} numberOfLines={1}>
        {file.name}{retryLabel}
      </Text>
      {file.size > 0 && (
        <Text style={styles.size}>{formatSize(file.size)}</Text>
      )}
    </View>
  );
}

export const FileListItem = memo(FileListItemInner, (prev, next) => {
  const a = prev.file;
  const b = next.file;
  return (
    a.status === b.status &&
    a.name === b.name &&
    a.size === b.size &&
    a.retryCount === b.retryCount
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  name: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
  },
  size: {
    fontSize: 12,
    color: Colors.textDim,
  },
});
