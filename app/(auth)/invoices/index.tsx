// ============================================================
// Invoices Screen - Daily invoice archive
// ============================================================

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getInvoiceDaySummary,
  getInvoicesByDate,
  getInvoiceWithItems,
  type InvoiceDaySummary,
} from '../../../src/services/invoiceService';
import { CurrentDateBadge, formatDisplayDate, getLocalDateKey } from '../../../src/components/common/CurrentDateBadge';
import { useSettingsStore } from '../../../src/stores/settingsStore';
import { useDateStore } from '../../../src/stores/dateStore';
import { formatCurrency, formatTime, generateInvoiceNumber } from '../../../src/utils/formatters';
import { Colors, Typography, Spacing, BorderRadius } from '../../../src/constants/theme';
import type { Invoice, InvoiceItem } from '../../../src/types';

const emptySummary: InvoiceDaySummary = {
  count: 0,
  subtotal: 0,
  taxAmount: 0,
  total: 0,
  amountPaid: 0,
  amountDue: 0,
};

function shiftDate(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  return getLocalDateKey(date);
}

function getStatusLabel(status: Invoice['status']): string {
  switch (status) {
    case 'completed':
      return 'مدفوعة';
    case 'partial':
      return 'دفع جزئي';
    case 'refunded':
      return 'مرتجعة';
  }
}

export default function InvoicesScreen() {
  const insets = useSafeAreaInsets();
  const darkMode = useSettingsStore((s) => s.settings.dark_mode);
  const colors = darkMode ? Colors.dark : Colors.light;
  const currency = useSettingsStore((s) => s.settings.currency);

  const selectedDate = useDateStore((s) => s.selectedDateKey);
  const setSelectedDate = useDateStore((s) => s.setSelectedDateKey);
  const [summary, setSummary] = useState<InvoiceDaySummary>(emptySummary);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [itemsByInvoice, setItemsByInvoice] = useState<Record<string, InvoiceItem[]>>({});
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const isToday = selectedDate === getLocalDateKey();

  const loadInvoices = useCallback(async () => {
    const [invoiceRows, daySummary] = await Promise.all([
      getInvoicesByDate(selectedDate),
      getInvoiceDaySummary(selectedDate),
    ]);

    setInvoices(invoiceRows);
    setSummary(daySummary);
  }, [selectedDate]);

  useFocusEffect(
    useCallback(() => {
      loadInvoices();
    }, [loadInvoices])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadInvoices();
    } finally {
      setRefreshing(false);
    }
  };

  const toggleInvoice = async (invoice: Invoice) => {
    if (expandedInvoiceId === invoice.id) {
      setExpandedInvoiceId(null);
      return;
    }

    if (!itemsByInvoice[invoice.id]) {
      const saved = await getInvoiceWithItems(invoice.id);
      setItemsByInvoice((current) => ({
        ...current,
        [invoice.id]: saved?.items ?? [],
      }));
    }

    setExpandedInvoiceId(invoice.id);
  };

  const renderInvoice = ({ item, index }: { item: Invoice; index: number }) => {
    const isExpanded = expandedInvoiceId === item.id;
    const items = itemsByInvoice[item.id] ?? [];
    const statusColor =
      item.status === 'completed'
        ? colors.accent
        : item.status === 'partial'
          ? colors.warning
          : colors.danger;
    const statusBackground =
      item.status === 'completed'
        ? colors.accentGlow
        : item.status === 'partial'
          ? 'rgba(245, 158, 11, 0.15)'
          : colors.dangerGlow;

    return (
      <Animated.View entering={FadeInDown.duration(250).delay(index * 35)}>
        <Pressable
          onPress={() => toggleInvoice(item)}
          style={[styles.invoiceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={styles.invoiceHeader}>
            <View style={styles.invoiceTitleRow}>
              <View style={[styles.invoiceIcon, { backgroundColor: colors.primaryGlow }]}>
                <MaterialCommunityIcons name="receipt-text-outline" size={22} color={colors.primary} />
              </View>
              <View style={styles.invoiceTextBlock}>
                {item.invoice_name && (
                  <Text style={[styles.invoiceName, { color: colors.text }]} numberOfLines={1}>
                    {item.invoice_name}
                  </Text>
                )}
                <Text style={[styles.invoiceNumber, { color: item.invoice_name ? colors.textMuted : colors.text }]}>
                  {generateInvoiceNumber(item.invoice_number)}
                </Text>
                <Text style={[styles.invoiceTime, { color: colors.textMuted }]}>
                  {formatTime(item.created_at)}
                </Text>
              </View>
            </View>

            <View style={styles.invoiceMeta}>
              <Text style={[styles.invoiceTotal, { color: colors.primary }]}>
                {formatCurrency(item.total, currency)}
              </Text>
              <View style={[styles.statusChip, { backgroundColor: statusBackground }]}>
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {getStatusLabel(item.status)}
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.paymentRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.paymentText, { color: colors.textSecondary }]}>
              مدفوع: {formatCurrency(item.amount_paid, currency)}
            </Text>
            <Text style={[styles.paymentText, { color: item.amount_due > 0 ? colors.warning : colors.accent }]}>
              متبقي: {formatCurrency(item.amount_due, currency)}
            </Text>
            <MaterialCommunityIcons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.textMuted}
            />
          </View>

          {isExpanded && (
            <View style={[styles.itemsPanel, { borderTopColor: colors.border }]}>
              {items.length > 0 ? (
                items.map((invoiceItem) => (
                  <View key={invoiceItem.id} style={styles.itemRow}>
                    <View style={styles.itemInfo}>
                      <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>
                        {invoiceItem.product_name}
                      </Text>
                      <Text style={[styles.itemQty, { color: colors.textMuted }]}>
                        {invoiceItem.quantity} x {formatCurrency(invoiceItem.unit_price, currency)}
                      </Text>
                    </View>
                    <Text style={[styles.itemTotal, { color: colors.textSecondary }]}>
                      {formatCurrency(invoiceItem.total, currency)}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={[styles.emptyItemsText, { color: colors.textMuted }]}>
                  لا توجد أصناف مسجلة لهذه الفاتورة
                </Text>
              )}
            </View>
          )}
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>الفواتير</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
            أرشيف الفواتير حسب اليوم
          </Text>
        </View>
        <CurrentDateBadge dateKey={selectedDate} onDateChange={setSelectedDate} />
      </View>

      <View style={styles.dateControls}>
        <Pressable
          onPress={() => setSelectedDate((current) => shiftDate(current, -1))}
          style={[styles.dateButton, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}
        >
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
          <Text style={[styles.dateButtonText, { color: colors.textSecondary }]}>اليوم السابق</Text>
        </Pressable>

        <View style={[styles.selectedDateCard, { backgroundColor: colors.primaryGlow, borderColor: colors.primary }]}>
          <MaterialCommunityIcons name="calendar-month-outline" size={18} color={colors.primary} />
          <Text style={[styles.selectedDateText, { color: colors.primary }]} numberOfLines={1}>
            {formatDisplayDate(selectedDate)}
          </Text>
        </View>

        <Pressable
          onPress={() => setSelectedDate((current) => shiftDate(current, 1))}
          style={[styles.dateButton, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}
        >
          <Text style={[styles.dateButtonText, { color: colors.textSecondary }]}>اليوم التالي</Text>
          <MaterialCommunityIcons name="chevron-left" size={20} color={colors.textSecondary} />
        </Pressable>

        {!isToday && (
          <Pressable
            onPress={() => setSelectedDate(getLocalDateKey())}
            style={[styles.todayButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.todayButtonText, { color: colors.primary }]}>النهارده</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.summaryGrid}>
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="receipt" size={20} color={colors.secondary} />
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>عدد الفواتير</Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>{summary.count}</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="cash-multiple" size={20} color={colors.primary} />
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>إجمالي اليوم</Text>
          <Text style={[styles.summaryValue, { color: colors.primary }]}>
            {formatCurrency(summary.total, currency)}
          </Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="cash-check" size={20} color={colors.accent} />
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>المدفوع</Text>
          <Text style={[styles.summaryValue, { color: colors.accent }]}>
            {formatCurrency(summary.amountPaid, currency)}
          </Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.warning} />
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>المتبقي</Text>
          <Text style={[styles.summaryValue, { color: colors.warning }]}>
            {formatCurrency(summary.amountDue, currency)}
          </Text>
        </View>
      </View>

      <FlatList
        data={invoices}
        keyExtractor={(item) => item.id}
        renderItem={renderInvoice}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="receipt-text-remove-outline" size={52} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>مفيش فواتير في اليوم ده</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              أي فاتورة بيع هتتسجل تلقائيًا في يومها
            </Text>
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
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    gap: Spacing.md,
    flexWrap: 'wrap',
  },
  headerTitle: { fontSize: Typography.fontSize.lg, fontWeight: '700' },
  headerSubtitle: { fontSize: Typography.fontSize.xs, marginTop: 2 },
  dateControls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
  },
  dateButtonText: { fontSize: Typography.fontSize.xs, fontWeight: '600' },
  selectedDateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
    flexGrow: 1,
    justifyContent: 'center',
  },
  selectedDateText: { fontSize: Typography.fontSize.sm, fontWeight: '700' },
  todayButton: {
    borderWidth: 1,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  todayButtonText: { fontSize: Typography.fontSize.xs, fontWeight: '700' },
  summaryGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
    flexWrap: 'wrap',
  },
  summaryCard: {
    flex: 1,
    minWidth: 150,
    borderWidth: 1,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  summaryLabel: { fontSize: Typography.fontSize.xs, fontWeight: '500' },
  summaryValue: { fontSize: Typography.fontSize.md, fontWeight: '800' },
  list: {
    padding: Spacing.base,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing['4xl'],
  },
  invoiceCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  invoiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    flexWrap: 'wrap',
  },
  invoiceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  invoiceIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  invoiceTextBlock: { flex: 1 },
  invoiceName: { fontSize: Typography.fontSize.base, fontWeight: '800' },
  invoiceNumber: { fontSize: Typography.fontSize.base, fontWeight: '700' },
  invoiceTime: { fontSize: Typography.fontSize.xs, marginTop: 2 },
  invoiceMeta: { alignItems: 'flex-end', gap: Spacing.xs, minWidth: 120 },
  invoiceTotal: { fontSize: Typography.fontSize.base, fontWeight: '800' },
  statusChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  statusText: { fontSize: Typography.fontSize.xs, fontWeight: '700' },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    gap: Spacing.md,
    flexWrap: 'wrap',
  },
  paymentText: { fontSize: Typography.fontSize.xs, fontWeight: '600' },
  itemsPanel: {
    borderTopWidth: 1,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: Typography.fontSize.sm, fontWeight: '600' },
  itemQty: { fontSize: Typography.fontSize.xs, marginTop: 2 },
  itemTotal: { fontSize: Typography.fontSize.sm, fontWeight: '700' },
  emptyItemsText: { fontSize: Typography.fontSize.sm, textAlign: 'center', paddingVertical: Spacing.sm },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing['5xl'],
    gap: Spacing.sm,
  },
  emptyTitle: { fontSize: Typography.fontSize.base, fontWeight: '700' },
  emptySubtitle: { fontSize: Typography.fontSize.sm, textAlign: 'center' },
});
