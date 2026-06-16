// ============================================================
// Audit Log Screen
// ============================================================

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getRecentAuditEvents } from '../../../src/services/auditService';
import { useSettingsStore } from '../../../src/stores/settingsStore';
import { Colors, Typography, Spacing, BorderRadius } from '../../../src/constants/theme';
import { formatDateTime } from '../../../src/utils/formatters';
import type { AuditEvent } from '../../../src/types';

function getActionLabel(action: AuditEvent['action']): string {
  switch (action) {
    case 'update': return 'تعديل';
    case 'delete': return 'حذف';
    case 'refund': return 'مرتجع';
    case 'restore': return 'استرجاع';
    case 'backup': return 'نسخ';
    case 'close': return 'إغلاق يومي';
    case 'create': return 'إضافة';
    default: return action;
  }
}

export default function AuditScreen() {
  const insets = useSafeAreaInsets();
  const darkMode = useSettingsStore((s) => s.settings.dark_mode);
  const colors = darkMode ? Colors.dark : Colors.light;
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadEvents = useCallback(async () => {
    setEvents(await getRecentAuditEvents(150));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadEvents();
    }, [loadEvents])
  );

  const refresh = async () => {
    setRefreshing(true);
    try {
      await loadEvents();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-right" size={22} color={colors.text} />
        </Pressable>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>سجل التدقيق</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>آخر التعديلات والحذف والاسترجاع</Text>
        </View>
      </View>

      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <View style={[styles.eventCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.eventHeader}>
              <View style={[styles.eventIcon, { backgroundColor: colors.primaryGlow }]}>
                <MaterialCommunityIcons name="clipboard-text-clock" size={20} color={colors.primary} />
              </View>
              <View style={styles.eventInfo}>
                <Text style={[styles.eventTitle, { color: colors.text }]} numberOfLines={1}>
                  {getActionLabel(item.action)} - {item.entity_label || item.entity_type}
                </Text>
                <Text style={[styles.eventMeta, { color: colors.textMuted }]}>
                  {item.entity_type} · {formatDateTime(item.created_at)}
                </Text>
              </View>
            </View>
            {item.note && (
              <Text style={[styles.note, { color: colors.textSecondary }]} numberOfLines={2}>
                {item.note}
              </Text>
            )}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="clipboard-text-off-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>لسه مفيش أحداث مسجلة</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  backButton: { padding: Spacing.xs },
  headerTitle: { fontSize: Typography.fontSize.lg, fontWeight: '800' },
  headerSubtitle: { fontSize: Typography.fontSize.xs, marginTop: 2 },
  list: { padding: Spacing.base, gap: Spacing.sm },
  eventCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  eventHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  eventIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventInfo: { flex: 1, minWidth: 0 },
  eventTitle: { fontSize: Typography.fontSize.sm, fontWeight: '800' },
  eventMeta: { fontSize: Typography.fontSize.xs, marginTop: 2 },
  note: { fontSize: Typography.fontSize.xs, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: Spacing['5xl'], gap: Spacing.sm },
  emptyText: { fontSize: Typography.fontSize.sm },
});
