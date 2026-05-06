import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { styles } from './ta3meedStyles';

export function BottomTabs({ onHome, onInfo, onMore, active = 'investments' }) {
  return (
    <View pointerEvents="box-none" style={styles.bottomWrap}>
      <View style={styles.bottomBar}>
        <BottomItem icon="▦" label="المزيد" active={active === 'more'} onPress={onMore || (() => onInfo('تبويب المزيد'))} />
        <BottomItem icon="▭" label="محفظتي" onPress={() => onInfo('تبويب محفظتي')} />
        <View style={styles.centerSpace} />
        <BottomItem icon="◔" label="استثماراتي" active={active === 'investments'} onPress={() => onInfo('أنت الآن في استثماراتي')} />
        <BottomItem icon="⌂" label="الرئيسية" onPress={onHome} />
      </View>
      <TouchableOpacity style={styles.centerFab} activeOpacity={0.86} onPress={() => onInfo('لوحة الاستثمارات')}>
        <Text style={styles.centerFabIcon}>↗</Text>
        <Text style={styles.centerFabBars}>▥</Text>
      </TouchableOpacity>
    </View>
  );
}

function BottomItem({ icon, label, active, onPress }) {
  return (
    <TouchableOpacity style={styles.bottomItem} onPress={onPress} activeOpacity={0.82}>
      <Text style={[styles.bottomIcon, active && styles.bottomIconActive]}>{icon}</Text>
      <Text style={[styles.bottomLabel, active && styles.bottomLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}
