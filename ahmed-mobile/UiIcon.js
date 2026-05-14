import React from 'react';
import { Platform, Text } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export const ICON_COLOR = '#7c3aed';
export const ICON_COLOR_SOFT = '#38bdf8';
export const ICON_COLOR_DARK = '#312e81';

const iconMap = {
  add: ['MaterialCommunityIcons', 'plus-circle-outline'],
  save: ['MaterialCommunityIcons', 'content-save-outline'],
  edit: ['MaterialCommunityIcons', 'pencil-outline'],
  delete: ['MaterialCommunityIcons', 'trash-can-outline'],
  receive: ['MaterialCommunityIcons', 'cash-check'],
  complete: ['MaterialCommunityIcons', 'check-decagram-outline'],
  search: ['Ionicons', 'search-outline'],
  filter: ['MaterialCommunityIcons', 'filter-variant'],
  refresh: ['MaterialCommunityIcons', 'refresh'],
  view: ['Ionicons', 'eye-outline'],
  done: ['MaterialCommunityIcons', 'check-circle-outline'],
  close: ['MaterialCommunityIcons', 'close-circle-outline'],
  back: ['Ionicons', 'chevron-back-outline'],
  more: ['MaterialCommunityIcons', 'dots-vertical'],
  alert: ['MaterialCommunityIcons', 'alert-outline'],
  stats: ['Ionicons', 'stats-chart-outline'],
  reports: ['MaterialCommunityIcons', 'clipboard-text-outline'],
  investments: ['MaterialCommunityIcons', 'trending-up'],
  money: ['MaterialCommunityIcons', 'cash-multiple'],
  wallet: ['Ionicons', 'wallet-outline'],
  users: ['MaterialCommunityIcons', 'account-group-outline'],
  properties: ['MaterialCommunityIcons', 'office-building-outline'],
  contracts: ['MaterialCommunityIcons', 'file-document-outline'],
  payments: ['Ionicons', 'card-outline'],
  wealth: ['MaterialCommunityIcons', 'diamond-stone'],
  ta3meed: ['MaterialCommunityIcons', 'bank-outline'],
  moneymoon: ['MaterialCommunityIcons', 'moon-waning-crescent'],
  dinar: ['MaterialCommunityIcons', 'currency-usd-circle-outline'],
  tokenize: ['MaterialCommunityIcons', 'hexagon-outline'],
  settings: ['Ionicons', 'settings-outline'],
};

const webIconMap = {
  add: '+',
  save: '▣',
  edit: '✎',
  delete: '⌫',
  receive: '✓',
  complete: '✓',
  search: '⌕',
  filter: '≡',
  refresh: '↻',
  view: '◉',
  done: '✓',
  close: '×',
  back: '‹',
  more: '⋮',
  alert: '!',
  stats: '▥',
  reports: '☷',
  investments: '↗',
  money: '﷼',
  wallet: '▤',
  users: '♙',
  properties: '▦',
  contracts: '▤',
  payments: '▭',
  wealth: '◇',
  ta3meed: '▥',
  moneymoon: '◐',
  dinar: '$',
  tokenize: '⬡',
  settings: '⚙',
};

function WebIcon({ name, size, color, style }) {
  const glyph = webIconMap[name] || webIconMap.more;
  return (
    <Text
      selectable={false}
      style={[
        {
          color,
          fontSize: size,
          lineHeight: Math.round(size * 1.12),
          fontWeight: '900',
          textAlign: 'center',
          includeFontPadding: false,
        },
        style,
      ]}
    >
      {glyph}
    </Text>
  );
}

export default function UiIcon({ name, size = 22, color = ICON_COLOR, style }) {
  if (Platform.OS === 'web') {
    return <WebIcon name={name} size={size} color={color} style={style} />;
  }

  const [library, iconName] = iconMap[name] || iconMap.more;
  const IconComponent = library === 'Ionicons' ? Ionicons : MaterialCommunityIcons;
  return <IconComponent name={iconName} size={size} color={color} style={style} />;
}
