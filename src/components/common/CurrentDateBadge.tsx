// ============================================================
// Current Date Badge - Reusable date display for screen headers
// ============================================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../../constants/theme';
import { useSettingsStore } from '../../stores/settingsStore';

export function getLocalDateKey(date: Date = new Date()): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function formatDisplayDate(date: Date | string): string {
  const value = typeof date === 'string' ? new Date(`${date}T00:00:00`) : date;

  return value.toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

interface CurrentDateBadgeProps {
  dateKey?: string;
}

export function CurrentDateBadge({ dateKey = getLocalDateKey() }: CurrentDateBadgeProps) {
  const darkMode = useSettingsStore((s) => s.settings.dark_mode);
  const colors = darkMode ? Colors.dark : Colors.light;

  return (
    <View style={[styles.badge, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}>
      <MaterialCommunityIcons name="calendar-today" size={16} color={colors.primary} />
      <Text style={[styles.text, { color: colors.textSecondary }]} numberOfLines={1}>
        {formatDisplayDate(dateKey)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
    maxWidth: 240,
    flexShrink: 1,
  },
  text: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '600',
    flexShrink: 1,
  },
});
