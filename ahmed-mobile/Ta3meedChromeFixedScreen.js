import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ta3meedScreen from './Ta3meedScreen';

export default function Ta3meedChromeFixedScreen(props) {
  return (
    <View style={styles.root}>
      <Ta3meedScreen {...props} />
      <View style={styles.headerOverlay} pointerEvents="none">
        <View style={styles.backMask} />
        <View style={styles.iconGroup}>
          <View style={styles.iconButton}><Text style={styles.iconText}>◉</Text></View>
          <View style={styles.iconButton}><Text style={styles.iconText}>▽</Text></View>
          <View style={styles.iconButton}><Text style={styles.iconText}>⌕</Text></View>
        </View>
        <Text style={styles.title}>تعميد</Text>
        <View style={styles.moreButton}><Text style={styles.iconText}>⋮</Text></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f3f7f6' },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 92,
    backgroundColor: '#f3f7f6',
    zIndex: 50,
  },
  backMask: {
    position: 'absolute',
    left: 8,
    top: 2,
    width: 70,
    height: 78,
    borderRadius: 26,
    backgroundColor: '#f3f7f6',
  },
  iconGroup: {
    position: 'absolute',
    left: 82,
    top: 2,
    flexDirection: 'row',
    gap: 9,
  },
  iconButton: {
    width: 58,
    height: 58,
    borderRadius: 21,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  moreButton: {
    position: 'absolute',
    right: 8,
    top: 2,
    width: 58,
    height: 58,
    borderRadius: 21,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  iconText: { color: '#64748b', fontSize: 29, fontWeight: '900', lineHeight: 32 },
  title: {
    position: 'absolute',
    top: 19,
    right: 96,
    left: 278,
    color: '#0f172a',
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'right',
  },
});
