import React from 'react';
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

export default function UiIcon({ name, size = 22, color = ICON_COLOR, style }) {
  const [library, iconName] = iconMap[name] || iconMap.more;
  const IconComponent = library === 'Ionicons' ? Ionicons : MaterialCommunityIcons;
  return <IconComponent name={iconName} size={size} color={color} style={style} />;
}
