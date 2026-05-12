import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { styles } from './ta3meedStyles';

function HeaderIcon({ icon, onPress, large, label }) {
  return (
    <TouchableOpacity style={styles.headerIcon} onPress={onPress} activeOpacity={0.82}>
      <Text style={[styles.headerIconText, large && styles.headerBackText]}>{icon}</Text>
      {label ? <Text style={styles.headerIconLabel}>{label}</Text> : null}
    </TouchableOpacity>
  );
}

export function Ta3meedHeader({ onBack, onAdd, onFilter, onSearch, onToggleInvestors }) {
  return (
    <View style={styles.topBar}>
      <View style={styles.leftTopActions}>
        <HeaderIcon icon="‹" onPress={onBack} large />
        <HeaderIcon icon="⊕" onPress={onAdd} />
        <HeaderIcon icon="▽" onPress={onFilter} />
        <HeaderIcon icon="⌕" onPress={onSearch} />
      </View>
      <Text style={styles.screenTitle}>تعميد</Text>
      <HeaderIcon icon="👥" label="حسابات" onPress={onToggleInvestors} />
    </View>
  );
}
