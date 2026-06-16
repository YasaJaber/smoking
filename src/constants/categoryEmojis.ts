// ============================================================
// Category Emoji Presets
// ============================================================

import { CategoryColors } from './theme';
import type { Category } from '../types';

export const DEFAULT_CATEGORY_EMOJI = '📦';
const MATERIAL_ICON_NAME_PATTERN = /^[a-z0-9-]+$/i;

export const LEGACY_CATEGORY_ICON_EMOJIS: Record<string, string> = {
  smoking: '🚬',
  cloud: '💨',
  'weather-fog': '💨',
  toolbox: '🧰',
  cup: '🥤',
  food: '🍿',
  'dots-horizontal': '✨',
  folder: DEFAULT_CATEGORY_EMOJI,
  default: DEFAULT_CATEGORY_EMOJI,
};

export const CATEGORY_EMOJI_GROUPS = [
  {
    key: 'popular',
    label: 'الأشهر',
    emojis: ['🚬', '💨', '🔥', '⚡', '🔋', '🧪', '🪨', '🪵', '⚫', '🟤', '🍇', '🍎', '🍋', '🍉', '🍓', '🥭'],
  },
  {
    key: 'cigarettes',
    label: 'سجائر',
    emojis: ['🚬', '🔥', '💨', '🏷️', '📦', '⭐', '🔴', '🔵', '🟡', '🟢', '⚪', '⚫', '🟤', '💎', '🥇', '🧾'],
  },
  {
    key: 'shisha',
    label: 'معسل',
    emojis: ['💨', '🌬️', '🍃', '🌿', '🍇', '🍏', '🍎', '🍋', '🍉', '🍓', '🥭', '🍒', '🍑', '🍍', '🫐', '🥥'],
  },
  {
    key: 'vape',
    label: 'فيب',
    emojis: ['💨', '⚡', '🔋', '🪫', '🧪', '🫧', '🌫️', '🔌', '💧', '🧊', '🍇', '🍓', '🥭', '🍉', '🍋', '🍒'],
  },
  {
    key: 'charcoal',
    label: 'فحم',
    emojis: ['🔥', '🪨', '🪵', '⚫', '🟤', '⬛', '◼️', '▪️', '🔸', '🔶', '📦', '🧺', '💨', '♨️', '🕯️', '🧯'],
  },
  {
    key: 'accessories',
    label: 'إكسسوارات',
    emojis: ['🧰', '🛠️', '🪛', '🔧', '⚙️', '✂️', '🧻', '🧴', '🔦', '🧲', '🔌', '🛍️', '🏷️', '🧾', '💳', '💰'],
  },
] as const;

export function getCategoryEmoji(category?: Pick<Category, 'icon'> | null): string {
  const icon = category?.icon?.trim();
  if (!icon) return DEFAULT_CATEGORY_EMOJI;

  const legacyEmoji = LEGACY_CATEGORY_ICON_EMOJIS[icon];
  if (legacyEmoji) return legacyEmoji;
  if (MATERIAL_ICON_NAME_PATTERN.test(icon)) return DEFAULT_CATEGORY_EMOJI;

  return icon;
}

export function getEmojiColor(emoji: string): string {
  const chars = Array.from(emoji || DEFAULT_CATEGORY_EMOJI);
  const score = chars.reduce((total, char) => total + (char.codePointAt(0) || 0), 0);
  return CategoryColors[score % CategoryColors.length];
}

export function normalizeCategoryEmoji(emoji: string): string {
  const value = emoji.trim();
  if (!value || MATERIAL_ICON_NAME_PATTERN.test(value)) return DEFAULT_CATEGORY_EMOJI;
  return value;
}
