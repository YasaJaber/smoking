// ============================================================
// GlassCard - Glassmorphism Card Component
// ============================================================

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, BorderRadius, Spacing } from '../../constants/theme';
import { useSettingsStore } from '../../stores/settingsStore';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'elevated' | 'bordered';
  padding?: number;
}

export function GlassCard({
  children,
  style,
  variant = 'default',
  padding = Spacing.base,
}: GlassCardProps) {
  const darkMode = useSettingsStore((s) => s.settings.dark_mode);
  const colors = darkMode ? Colors.dark : Colors.light;

  const variantStyles: Record<string, ViewStyle> = {
    default: {
      backgroundColor: colors.glass,
      borderColor: colors.glassBorder,
    },
    elevated: {
      backgroundColor: colors.surfaceLight,
      borderColor: colors.border,
    },
    bordered: {
      backgroundColor: colors.glass,
      borderColor: colors.borderLight,
      borderWidth: 1.5,
    },
  };

  return (
    <View
      style={[
        styles.card,
        variantStyles[variant],
        { padding },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
