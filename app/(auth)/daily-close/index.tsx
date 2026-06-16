// ============================================================
// Daily Close Report Screen
// ============================================================

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, TextInput } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CurrentDateBadge, formatDisplayDate, getLocalDateKey } from '../../../src/components/common/CurrentDateBadge';
import { closeDay, getDailyCloseReport, getDailyCloseSnapshot } from '../../../src/services/dailyCloseService';
import { useAuthStore } from '../../../src/stores/authStore';
import { useDateStore } from '../../../src/stores/dateStore';
import { useSettingsStore } from '../../../src/stores/settingsStore';
import { formatCurrency, formatDateTime } from '../../../src/utils/formatters';
import { Colors, Gradients, Typography, Spacing, BorderRadius } from '../../../src/constants/theme';
import type { DailyCloseReport, DailyCloseSnapshot } from '../../../src/types';
import { LinearGradient } from 'expo-linear-gradient';

function shiftDate(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  return getLocalDateKey(date);
}

const emptyReport: DailyCloseReport = {
  date_key: getLocalDateKey(),
  gross_sales: 0,
  net_sales: 0,
  cash_collected: 0,
  outstanding_due: 0,
  refunds_total: 0,
  profit: 0,
  invoice_count: 0,
  partial_count: 0,
  items_sold: 0,
  low_stock_count: 0,
  audit_count: 0,
};

export default function DailyCloseScreen() {
  const insets = useSafeAreaInsets();
  const darkMode = useSettingsStore((s) => s.settings.dark_mode);
  const currency = useSettingsStore((s) => s.settings.currency);
  const colors = darkMode ? Colors.dark : Colors.light;
  const user = useAuthStore((s) => s.user);
  const selectedDate = useDateStore((s) => s.selectedDateKey);
  const setSelectedDate = useDateStore((s) => s.setSelectedDateKey);
  const [report, setReport] = useState<DailyCloseReport>(emptyReport);
  const [snapshot, setSnapshot] = useState<DailyCloseSnapshot | null>(null);
  const [note, setNote] = useState('');
  const [closing, setClosing] = useState(false);

  const loadReport = useCallback(async () => {
    const [nextReport, nextSnapshot] = await Promise.all([
      getDailyCloseReport(selectedDate),
      getDailyCloseSnapshot(selectedDate),
    ]);
    setReport(nextReport);
    setSnapshot(nextSnapshot);
    setNote(nextSnapshot?.note ?? '');
  }, [selectedDate]);

  useFocusEffect(
    useCallback(() => {
      loadReport();
    }, [loadReport])
  );

  const handleCloseDay = () => {
    Alert.alert(
      snapshot ? 'تحديث إغلاق اليوم؟' : 'إغلاق اليوم؟',
      'هيتم حفظ لقطة رسمية للأرقام الحالية في التقرير.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: snapshot ? 'تحديث' : 'إغلاق',
          onPress: async () => {
            setClosing(true);
            try {
              const closed = await closeDay(selectedDate, user?.id, note);
              setSnapshot(closed);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('تم', 'تم حفظ تقرير إغلاق اليوم.');
            } catch {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('خطأ', 'تعذر حفظ إغلاق اليوم.');
            } finally {
              setClosing(false);
            }
          },
        },
      ]
    );
  };

  const cards = [
    { label: 'إجمالي المبيعات', value: formatCurrency(report.gross_sales, currency), icon: 'cash-multiple', color: colors.primary },
    { label: 'صافي بعد المرتجعات', value: formatCurrency(report.net_sales, currency), icon: 'calculator-variant', color: colors.accent },
    { label: 'الكاش المحصل', value: formatCurrency(report.cash_collected, currency), icon: 'cash-check', color: colors.accent },
    { label: 'ديون اليوم', value: formatCurrency(report.outstanding_due, currency), icon: 'alert-circle-outline', color: colors.warning },
    { label: 'المرتجعات', value: formatCurrency(report.refunds_total, currency), icon: 'backup-restore', color: colors.danger },
    { label: 'الربح', value: formatCurrency(report.profit, currency), icon: 'trending-up', color: colors.secondary },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>تقرير إغلاق اليوم</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>{formatDisplayDate(selectedDate)}</Text>
        </View>
        <CurrentDateBadge dateKey={selectedDate} onDateChange={setSelectedDate} />
      </View>

      <View style={styles.dateControls}>
        <Pressable
          onPress={() => setSelectedDate((current) => shiftDate(current, -1))}
          style={[styles.dateButton, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}
        >
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
          <Text style={[styles.dateButtonText, { color: colors.textSecondary }]}>السابق</Text>
        </Pressable>
        <Pressable
          onPress={() => setSelectedDate(getLocalDateKey())}
          style={[styles.todayButton, { backgroundColor: colors.primaryGlow, borderColor: colors.primary }]}
        >
          <Text style={[styles.todayButtonText, { color: colors.primary }]}>النهارده</Text>
        </Pressable>
        <Pressable
          onPress={() => setSelectedDate((current) => shiftDate(current, 1))}
          style={[styles.dateButton, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}
        >
          <Text style={[styles.dateButtonText, { color: colors.textSecondary }]}>التالي</Text>
          <MaterialCommunityIcons name="chevron-left" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.cardGrid}>
          {cards.map((card) => (
            <View key={card.label} style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.metricIcon, { backgroundColor: colors.surfaceLight }]}>
                <MaterialCommunityIcons name={card.icon as any} size={20} color={card.color} />
              </View>
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{card.label}</Text>
              <Text style={[styles.metricValue, { color: card.color }]}>{card.value}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.summaryPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.panelTitle, { color: colors.text }]}>ملخص التشغيل</Text>
          <View style={styles.rowWrap}>
            <View style={styles.miniStat}>
              <Text style={[styles.miniLabel, { color: colors.textMuted }]}>فواتير</Text>
              <Text style={[styles.miniValue, { color: colors.text }]}>{report.invoice_count}</Text>
            </View>
            <View style={styles.miniStat}>
              <Text style={[styles.miniLabel, { color: colors.textMuted }]}>فواتير جزئية</Text>
              <Text style={[styles.miniValue, { color: report.partial_count > 0 ? colors.warning : colors.text }]}>{report.partial_count}</Text>
            </View>
            <View style={styles.miniStat}>
              <Text style={[styles.miniLabel, { color: colors.textMuted }]}>قطع مباعة</Text>
              <Text style={[styles.miniValue, { color: colors.text }]}>{report.items_sold}</Text>
            </View>
            <View style={styles.miniStat}>
              <Text style={[styles.miniLabel, { color: colors.textMuted }]}>مخزون منخفض</Text>
              <Text style={[styles.miniValue, { color: report.low_stock_count > 0 ? colors.warning : colors.text }]}>{report.low_stock_count}</Text>
            </View>
            <View style={styles.miniStat}>
              <Text style={[styles.miniLabel, { color: colors.textMuted }]}>تعديلات</Text>
              <Text style={[styles.miniValue, { color: colors.text }]}>{report.audit_count}</Text>
            </View>
          </View>
        </View>

        {(report.partial_count > 0 || report.low_stock_count > 0) && (
          <View style={[styles.warningPanel, { backgroundColor: 'rgba(245, 158, 11, 0.12)', borderColor: colors.warning }]}>
            <MaterialCommunityIcons name="alert-outline" size={22} color={colors.warning} />
            <Text style={[styles.warningText, { color: colors.warning }]}>
              راجع الفواتير الجزئية والمخزون المنخفض قبل الإغلاق.
            </Text>
          </View>
        )}

        <View style={[styles.closePanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.panelTitle, { color: colors.text }]}>ملاحظات الإغلاق</Text>
          <TextInput
            style={[styles.noteInput, { backgroundColor: colors.surfaceLight, borderColor: colors.border, color: colors.text }]}
            value={note}
            onChangeText={setNote}
            placeholder="مثال: تم مراجعة الدرج والمخزون"
            placeholderTextColor={colors.textMuted}
            multiline
          />
          {snapshot && (
            <Text style={[styles.closedAt, { color: colors.textMuted }]}>
              آخر حفظ: {formatDateTime(snapshot.updated_at)}
            </Text>
          )}
          <Pressable onPress={handleCloseDay} disabled={closing}>
            <LinearGradient
              colors={Gradients.emeraldTeal as unknown as readonly [string, string, ...string[]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.closeButton, { opacity: closing ? 0.65 : 1 }]}
            >
              <MaterialCommunityIcons name="calendar-check" size={20} color="#fff" />
              <Text style={styles.closeButtonText}>{closing ? 'جاري الحفظ' : snapshot ? 'تحديث إغلاق اليوم' : 'إغلاق اليوم'}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    gap: Spacing.md,
    flexWrap: 'wrap',
  },
  headerTitle: { fontSize: Typography.fontSize.lg, fontWeight: '800' },
  headerSubtitle: { fontSize: Typography.fontSize.xs, marginTop: 2 },
  dateControls: { flexDirection: 'row', alignItems: 'center', padding: Spacing.base, gap: Spacing.sm, flexWrap: 'wrap' },
  dateButton: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, gap: Spacing.xs },
  dateButtonText: { fontSize: Typography.fontSize.xs, fontWeight: '800' },
  todayButton: { borderWidth: 1, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  todayButtonText: { fontSize: Typography.fontSize.xs, fontWeight: '800' },
  scrollContent: { padding: Spacing.base, paddingTop: 0, gap: Spacing.md },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  metricCard: { flex: 1, minWidth: 155, borderWidth: 1, borderRadius: BorderRadius.xl, padding: Spacing.md, gap: Spacing.xs },
  metricIcon: { width: 38, height: 38, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center' },
  metricLabel: { fontSize: Typography.fontSize.xs, fontWeight: '700' },
  metricValue: { fontSize: Typography.fontSize.lg, fontWeight: '900' },
  summaryPanel: { borderWidth: 1, borderRadius: BorderRadius.xl, padding: Spacing.md, gap: Spacing.md },
  panelTitle: { fontSize: Typography.fontSize.base, fontWeight: '900' },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  miniStat: { flex: 1, minWidth: 110, gap: Spacing.xs },
  miniLabel: { fontSize: Typography.fontSize.xs, fontWeight: '700' },
  miniValue: { fontSize: Typography.fontSize.xl, fontWeight: '900' },
  warningPanel: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.sm },
  warningText: { flex: 1, fontSize: Typography.fontSize.sm, fontWeight: '800' },
  closePanel: { borderWidth: 1, borderRadius: BorderRadius.xl, padding: Spacing.md, gap: Spacing.md },
  noteInput: { minHeight: 72, borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: Typography.fontSize.sm, textAlignVertical: 'top' },
  closedAt: { fontSize: Typography.fontSize.xs, fontWeight: '700' },
  closeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, gap: Spacing.sm },
  closeButtonText: { color: '#fff', fontSize: Typography.fontSize.base, fontWeight: '900' },
});
