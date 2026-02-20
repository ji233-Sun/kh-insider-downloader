import React from 'react';
import {View, StyleSheet} from 'react-native';
import {Colors} from '../theme';

interface Props {
  progress: number; // 0-100
  isDone?: boolean;
}

export function ProgressBar({progress, isDone}: Props) {
  return (
    <View style={styles.track}>
      <View
        style={[
          styles.fill,
          {width: `${Math.min(progress, 100)}%`},
          isDone && styles.fillDone,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 6,
    backgroundColor: Colors.bg,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 3,
  },
  fillDone: {
    backgroundColor: Colors.success,
  },
});
