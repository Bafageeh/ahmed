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
          <View style={styles.iconButton}><Text style={styles.iconText}>👥</Text></View>
          <View style={styles.iconButton}><Text style={styles.iconText}>⏷</Text></View>
          <View style={styles.iconButton}><Text style={styles.iconText}>⌕</Text></View>
        </View>

        <Text style={styles.title}>تعميد</Text>

        <View style={styles.moreButton}><Text style={styles.moreIconText}>⋮</Text></View>
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
    height: 84,
    backgroundColor: '#f3f7f6',
    zIndex: 50,
  },
  backMask: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 66,
    height: 62,
    borderRadius: 22,
    backgroundColor: '#f3f7f6',
  },
  iconGroup: {
    position: 'absolute',
    left: 70,
    top: 7,
    flexDirection: 'row',
    gap: 7,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 15,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e6eaf0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.045,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  moreButton: {
    position: 'absolute',
    right: 8,
    top: 7,
    width: 40,
    height: 40,
    borderRadius: 15,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e6eaf0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.045,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  iconText: {
    color: '#7b8798',
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 22,
  },
  moreIconText: {
    color: '#7b8798',
    fontSize: 23,
    fontWeight: '900',
    lineHeight: 25,
  },
  title: {
    position: 'absolute',
    top: 13,
    right: 58,
    left: 210,
    color: '#0f172a',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'right',
    lineHeight: 34,
  },
});
