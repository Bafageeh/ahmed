import React from 'react';
import {
  PlusCircle,
  Save,
  Pencil,
  Trash2,
  BadgeCheck,
  CheckCircle2,
  Search,
  Filter,
  RefreshCw,
  Eye,
  XCircle,
  ChevronLeft,
  MoreVertical,
  AlertTriangle,
  BarChart3,
  ClipboardText,
  TrendingUp,
  Banknote,
  Wallet,
  Users,
  Building2,
  FileText,
  CreditCard,
  Gem,
  Landmark,
  Moon,
  CircleDollarSign,
  Hexagon,
  Settings,
} from 'lucide-react-native';

export const ICON_COLOR = '#7c3aed';
export const ICON_COLOR_SOFT = '#38bdf8';
export const ICON_COLOR_DARK = '#312e81';

const iconMap = {
  add: PlusCircle,
  save: Save,
  edit: Pencil,
  delete: Trash2,
  receive: Banknote,
  complete: BadgeCheck,
  search: Search,
  filter: Filter,
  refresh: RefreshCw,
  view: Eye,
  done: CheckCircle2,
  close: XCircle,
  back: ChevronLeft,
  more: MoreVertical,
  alert: AlertTriangle,
  stats: BarChart3,
  reports: ClipboardText,
  investments: TrendingUp,
  money: Banknote,
  wallet: Wallet,
  users: Users,
  properties: Building2,
  contracts: FileText,
  payments: CreditCard,
  wealth: Gem,
  ta3meed: Landmark,
  moneymoon: Moon,
  dinar: CircleDollarSign,
  tokenize: Hexagon,
  settings: Settings,
};

export default function UiIcon({ name, size = 22, color = ICON_COLOR, style }) {
  const IconComponent = iconMap[name] || MoreVertical;
  return (
    <IconComponent
      width={size}
      height={size}
      size={size}
      color={color}
      strokeWidth={2.35}
      style={style}
    />
  );
}
