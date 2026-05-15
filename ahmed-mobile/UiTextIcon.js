import React from 'react';
import { Text } from 'react-native';

export const ICON_COLOR = '#7c3aed';
export const ICON_COLOR_SOFT = '#38bdf8';
export const ICON_COLOR_DARK = '#312e81';

const iconMap = {
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

export default function UiTextIcon({ name, size = 22, color = ICON_COLOR, style }) {
  const glyph = iconMap[name] || iconMap.more;
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
