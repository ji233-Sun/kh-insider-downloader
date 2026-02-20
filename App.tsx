import React from 'react';
import {SafeAreaView, StyleSheet} from 'react-native';
import {HomeScreen} from './src/screens/HomeScreen';
import {Colors} from './src/theme';

function App() {
  return (
    <SafeAreaView style={styles.container}>
      <HomeScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
});

export default App;
