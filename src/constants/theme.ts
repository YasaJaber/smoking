// ============================================================
// Design System - Smoking POS
// Premium Dark Theme with Glassmorphism & Aurora Effects
// ============================================================

export const Colors = {
  dark: {
    // Backgrounds
    background: '#0a0a0f',
    surface: '#13131a',
    surfaceLight: '#1c1c28',
    surfaceElevated: '#242436',

    // Primary - Indigo
    primary: '#818cf8',
    primaryDark: '#6366f1',
    primaryLight: '#a5b4fc',
    primaryGlow: 'rgba(129, 140, 248, 0.15)',

    // Secondary - Purple
    secondary: '#a78bfa',
    secondaryDark: '#7c3aed',
    secondaryLight: '#c4b5fd',

    // Accent - Emerald (profits/success)
    accent: '#34d399',
    accentDark: '#10b981',
    accentLight: '#6ee7b7',
    accentGlow: 'rgba(52, 211, 153, 0.15)',

    // Danger - Red
    danger: '#f87171',
    dangerDark: '#ef4444',
    dangerLight: '#fca5a5',
    dangerGlow: 'rgba(248, 113, 113, 0.15)',

    // Warning - Amber
    warning: '#fbbf24',
    warningDark: '#f59e0b',
    warningLight: '#fcd34d',

    // Text
    text: '#f1f5f9',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',
    textInverse: '#0f172a',

    // Borders
    border: 'rgba(255, 255, 255, 0.08)',
    borderLight: 'rgba(255, 255, 255, 0.12)',
    borderFocused: 'rgba(129, 140, 248, 0.5)',

    // Glass
    glass: 'rgba(255, 255, 255, 0.05)',
    glassLight: 'rgba(255, 255, 255, 0.08)',
    glassBorder: 'rgba(255, 255, 255, 0.1)',

    // Overlay
    overlay: 'rgba(0, 0, 0, 0.6)',
    overlayLight: 'rgba(0, 0, 0, 0.4)',

    // Status bar
    statusBar: 'light',
  },
  light: {
    background: '#f8fafc',
    surface: '#ffffff',
    surfaceLight: '#f1f5f9',
    surfaceElevated: '#ffffff',

    primary: '#6366f1',
    primaryDark: '#4f46e5',
    primaryLight: '#818cf8',
    primaryGlow: 'rgba(99, 102, 241, 0.1)',

    secondary: '#7c3aed',
    secondaryDark: '#6d28d9',
    secondaryLight: '#a78bfa',

    accent: '#10b981',
    accentDark: '#059669',
    accentLight: '#34d399',
    accentGlow: 'rgba(16, 185, 129, 0.1)',

    danger: '#ef4444',
    dangerDark: '#dc2626',
    dangerLight: '#f87171',
    dangerGlow: 'rgba(239, 68, 68, 0.1)',

    warning: '#f59e0b',
    warningDark: '#d97706',
    warningLight: '#fbbf24',

    text: '#0f172a',
    textSecondary: '#475569',
    textMuted: '#94a3b8',
    textInverse: '#f1f5f9',

    border: 'rgba(0, 0, 0, 0.08)',
    borderLight: 'rgba(0, 0, 0, 0.05)',
    borderFocused: 'rgba(99, 102, 241, 0.5)',

    glass: 'rgba(255, 255, 255, 0.7)',
    glassLight: 'rgba(255, 255, 255, 0.85)',
    glassBorder: 'rgba(0, 0, 0, 0.08)',

    overlay: 'rgba(0, 0, 0, 0.5)',
    overlayLight: 'rgba(0, 0, 0, 0.3)',

    statusBar: 'dark',
  },
} as const;

// Aurora gradient presets for analytics and decorative backgrounds
export const Gradients = {
  primary: ['#6366f1', '#818cf8', '#a78bfa'],
  secondary: ['#7c3aed', '#a78bfa', '#c4b5fd'],
  accent: ['#10b981', '#34d399', '#6ee7b7'],
  danger: ['#ef4444', '#f87171', '#fca5a5'],
  warning: ['#f59e0b', '#fbbf24', '#fcd34d'],
  aurora1: ['#6366f1', '#818cf8', '#a78bfa', '#c084fc'],
  aurora2: ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0'],
  aurora3: ['#f59e0b', '#fbbf24', '#fcd34d', '#fde68a'],
  darkSurface: ['#13131a', '#1c1c28'],
  purpleBlue: ['#7c3aed', '#6366f1'],
  emeraldTeal: ['#10b981', '#14b8a6'],
  sunset: ['#f97316', '#ef4444'],
} as const;

// Category color presets
export const CategoryColors = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
] as const;

export const Typography = {
  // Font families
  fontFamily: {
    regular: 'Cairo_400Regular',
    medium: 'Cairo_500Medium',
    semiBold: 'Cairo_600SemiBold',
    bold: 'Cairo_700Bold',
    mono: 'monospace',
  },
  // Font sizes
  fontSize: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 17,
    lg: 20,
    xl: 24,
    '2xl': 30,
    '3xl': 36,
    '4xl': 48,
  },
  // Line heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
} as const;

export const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  '2xl': 24,
  full: 9999,
} as const;

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  }),
} as const;

export const Animation = {
  fast: 150,
  normal: 250,
  slow: 400,
  spring: {
    damping: 15,
    stiffness: 150,
    mass: 1,
  },
  springBouncy: {
    damping: 10,
    stiffness: 180,
    mass: 0.8,
  },
} as const;

// Icon mapping for categories
export const CategoryIcons: Record<string, string> = {
  cigarettes: 'smoking',
  hookah: 'cloud',
  vape: 'weather-fog',
  accessories: 'toolbox',
  drinks: 'cup',
  snacks: 'food',
  other: 'dots-horizontal',
  default: 'folder',
} as const;
