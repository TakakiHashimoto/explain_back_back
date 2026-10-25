import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import { colors } from '@/styles/tokens';

const symbols = {
  close: { ios: 'xmark', android: 'close', web: 'close' },
  notifications: { ios: 'bell', android: 'notifications', web: 'notifications' },
  error: { ios: 'exclamationmark.circle.fill', android: 'error', web: 'error' },
  psychology: { ios: 'brain.head.profile', android: 'psychology', web: 'psychology' },
  lightbulb: { ios: 'lightbulb', android: 'lightbulb', web: 'lightbulb' },
  edit: { ios: 'square.and.pencil', android: 'edit_note', web: 'edit_note' },
  lock: { ios: 'lock', android: 'lock', web: 'lock' },
  mic: { ios: 'mic', android: 'mic', web: 'mic' },
  arrow: { ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' },
  verified: { ios: 'checkmark.seal', android: 'verified', web: 'verified' },
  tips: { ios: 'lightbulb.max', android: 'tips_and_updates', web: 'tips_and_updates' },
  home: { ios: 'house', android: 'home', web: 'home' },
  topics: { ios: 'book', android: 'menu_book', web: 'menu_book' },
  review: { ios: 'arrow.triangle.2.circlepath', android: 'sync', web: 'sync' },
  progress: { ios: 'chart.line.uptrend.xyaxis', android: 'trending_up', web: 'trending_up' },
  profile: { ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' }, // TODO this is just a placeholder
} satisfies Record<string, SymbolViewProps['name']>;

export function Icon({
  name,
  size = 20,
  color = colors.textMuted,
}: {
  name: keyof typeof symbols;
  size?: number;
  color?: string;
}) {
  return <SymbolView name={symbols[name]} size={size} tintColor={color} />;
}
