// ============================================================
// SyncIndicator - Connection & sync status pill for headers
// Tap to trigger a manual sync.
// ============================================================

import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Typography, Spacing, BorderRadius } from '../../constants/theme';
import { useSettingsStore } from '../../stores/settingsStore';
import { useSyncStore } from '../../stores/syncStore';

export function SyncIndicator() {
  const darkMode = useSettingsStore((s) => s.settings.dark_mode);
  const colors = darkMode ? Colors.dark : Colors.light;

  const status = useSyncStore((s) => s.status);
  const pendingCount = useSyncStore((s) => s.pendingCount);
  const sync = useSyncStore((s) => s.sync);
  const refreshStatus = useSyncStore((s) => s.refreshStatus);

  useEffect(() => {
    refreshStatus();
  }, []);

  const handlePress = () => {
    if (status === 'syncing' || status === 'disabled') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sync(false);
  };

  const config = (() => {
    switch (status) {
      case 'syncing':
        return { color: colors.primary, icon: 'sync', label: 'جاري المزامنة' };
      case 'success':
        return { color: colors.accent, icon: 'cloud-check', label: 'متزامن' };
      case 'error':
        return { color: colors.danger, icon: 'cloud-alert', label: 'فشل المزامنة' };
      case 'offline':
        return { color: colors.warning, icon: 'cloud-off-outline', label: 'غير متصل' };
      case 'disabled':
        return { color: colors.textMuted, icon: 'cloud-outline', label: 'بدون مزامنة' };
      default:
        return { color: colors.accent, icon: 'cloud-outline', label: 'متصل' };
    }
  })();

  return (
    <Pressable
      onPress={handlePress}
      style={[styles.container, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}
      hitSlop={6}
    >
      {status === 'syncing' ? (
        <ActivityIndicator size="small" color={config.color} />
      ) : (
        <MaterialCommunityIcons name={config.icon as any} size={16} color={config.color} />
      )}
      <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
      {pendingCount > 0 && status !== 'syncing' && (
        <View style={[styles.badge, { backgroundColor: colors.warning }]}>
          <Text style={styles.badgeText}>{pendingCount > 99 ? '99+' : pendingCount}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  label: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '600',
  },
  badge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
  },
});
