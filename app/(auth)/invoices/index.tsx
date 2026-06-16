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
  Modal,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getInvoiceDaySummary,
  getInvoicesByDate,
  getInvoiceWithItems,
  refundInvoice,
  updateInvoice,
  type InvoiceDaySummary,
} from '../../../src/services/invoiceService';
import { CurrentDateBadge, formatDisplayDate, getLocalDateKey } from '../../../src/components/common/CurrentDateBadge';
import { useSettingsStore } from '../../../src/stores/settingsStore';
import { useDateStore } from '../../../src/stores/dateStore';
import { useSyncStore } from '../../../src/stores/syncStore';
import { useAuthStore } from '../../../src/stores/authStore';
import { formatCurrency, formatTime, formatInvoiceCode } from '../../../src/utils/formatters';
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

interface EditableInvoiceLine {
  id: string;
  productName: string;
  quantity: string;
  unitPrice: string;
}

function toNumberInput(value: string): number {
  return parseFloat(value.replace(',', '.')) || 0;
}

export default function InvoicesScreen() {
  const insets = useSafeAreaInsets();
  const darkMode = useSettingsStore((s) => s.settings.dark_mode);
  const colors = darkMode ? Colors.dark : Colors.light;
  const currency = useSettingsStore((s) => s.settings.currency);
  const user = useAuthStore((s) => s.user);

  const selectedDate = useDateStore((s) => s.selectedDateKey);
  const setSelectedDate = useDateStore((s) => s.setSelectedDateKey);
  const [summary, setSummary] = useState<InvoiceDaySummary>(emptySummary);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [itemsByInvoice, setItemsByInvoice] = useState<Record<string, InvoiceItem[]>>({});
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editInvoiceName, setEditInvoiceName] = useState('');
  const [editMerchantName, setEditMerchantName] = useState('');
  const [editMerchantPhone, setEditMerchantPhone] = useState('');
  const [editLines, setEditLines] = useState<EditableInvoiceLine[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  const isToday = selectedDate === getLocalDateKey();
  const editSubtotal = editLines.reduce(
    (sum, line) => sum + (parseInt(line.quantity, 10) || 0) * toNumberInput(line.unitPrice),
    0
  );
  const editTaxRate =
    editingInvoice && editingInvoice.subtotal > 0
      ? editingInvoice.tax_amount / editingInvoice.subtotal
      : 0;
  const editTotal = editSubtotal + editSubtotal * editTaxRate;

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

  const openEditInvoice = async (invoice: Invoice) => {
    const saved = await getInvoiceWithItems(invoice.id);
    if (!saved) {
      Alert.alert('خطأ', 'الفاتورة غير موجودة.');
      return;
    }

    setEditingInvoice(saved.invoice);
    setEditInvoiceName(saved.invoice.invoice_name ?? '');
    setEditMerchantName(saved.invoice.merchant_name ?? '');
    setEditMerchantPhone(saved.invoice.merchant_phone ?? '');
    setEditLines(
      saved.items.map((invoiceItem) => ({
        id: invoiceItem.id,
        productName: invoiceItem.product_name,
        quantity: String(invoiceItem.quantity),
        unitPrice: String(invoiceItem.unit_price),
      }))
    );
  };

  const closeEditInvoice = () => {
    setEditingInvoice(null);
    setSavingEdit(false);
    setEditLines([]);
  };

  const updateEditLine = (
    id: string,
    updates: Partial<Pick<EditableInvoiceLine, 'quantity' | 'unitPrice'>>
  ) => {
    setEditLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...updates } : line))
    );
  };

  const adjustEditQuantity = (id: string, delta: number) => {
    setEditLines((current) =>
      current.map((line) => {
        if (line.id !== id) return line;
        const quantity = Math.max(0, (parseInt(line.quantity, 10) || 0) + delta);
        return { ...line, quantity: String(quantity) };
      })
    );
  };

  const handleSaveEdit = async () => {
    if (!editingInvoice) return;

    const invalidLine = editLines.find(
      (line) => toNumberInput(line.unitPrice) < 0 || (parseInt(line.quantity, 10) || 0) < 0
    );
    if (invalidLine) {
      Alert.alert('بيانات غير صحيحة', `راجع الصنف "${invalidLine.productName}".`);
      return;
    }

    setSavingEdit(true);
    try {
      await updateInvoice(
        editingInvoice.id,
        {
          invoiceName: editInvoiceName,
          merchantName: editingInvoice.invoice_type === 'merchant' ? editMerchantName : null,
          merchantPhone: editingInvoice.invoice_type === 'merchant' ? editMerchantPhone : null,
          items: editLines.map((line) => ({
            id: line.id,
            quantity: Math.max(0, parseInt(line.quantity, 10) || 0),
            unitPrice: toNumberInput(line.unitPrice),
          })),
        },
        user?.id
      );

      const saved = await getInvoiceWithItems(editingInvoice.id);
      setItemsByInvoice((current) => ({
        ...current,
        [editingInvoice.id]: saved?.items ?? [],
      }));
      await loadInvoices();
      closeEditInvoice();
      useSyncStore.getState().sync(true);
    } catch (error: any) {
      const message = String(error?.message || '');
      if (message === 'INVOICE_EMPTY') {
        Alert.alert('الفاتورة فاضية', 'لو كل الأصناف مرتجعة استخدم حذف الفاتورة.');
      } else if (message.startsWith('INSUFFICIENT_STOCK:')) {
        const [, productName, available] = message.split(':');
        Alert.alert(
          'المخزون غير كافي',
          available
            ? `المتاح من "${productName}" هو ${available} فقط.`
            : `الصنف "${productName}" كميته غير كافية.`
        );
      } else {
        Alert.alert('خطأ', 'حصلت مشكلة أثناء تعديل الفاتورة.');
      }
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmDeleteInvoice = (invoice: Invoice) => {
    Alert.alert(
      'مرتجع كامل للفاتورة؟',
      'هيتم إرجاع كميات الأصناف للمخزون وتسجيل العملية كمرتجع كامل في سجل التدقيق.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            try {
              await refundInvoice(invoice.id, user?.id, 'full_refund_from_invoice_screen');
              setExpandedInvoiceId((current) => (current === invoice.id ? null : current));
              setItemsByInvoice((current) => {
                const next = { ...current };
                delete next[invoice.id];
                return next;
              });
              await loadInvoices();
              useSyncStore.getState().sync(true);
            } catch {
              Alert.alert('خطأ', 'حصلت مشكلة أثناء حذف الفاتورة.');
            }
          },
        },
      ]
    );
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
                  {formatInvoiceCode(item.invoice_number, item.invoice_code)}
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

          <View style={styles.actionRow}>
            <Pressable
              onPress={() => openEditInvoice(item)}
              style={[styles.actionButton, { backgroundColor: colors.primaryGlow, borderColor: colors.primary }]}
            >
              <MaterialCommunityIcons name="pencil-outline" size={17} color={colors.primary} />
              <Text style={[styles.actionButtonText, { color: colors.primary }]}>تعديل</Text>
            </Pressable>
            <Pressable
              onPress={() => confirmDeleteInvoice(item)}
              style={[styles.actionButton, { backgroundColor: colors.dangerGlow, borderColor: colors.danger }]}
            >
              <MaterialCommunityIcons name="delete-outline" size={17} color={colors.danger} />
              <Text style={[styles.actionButtonText, { color: colors.danger }]}>مرتجع كامل</Text>
            </Pressable>
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

      <Modal
        visible={editingInvoice !== null}
        transparent
        animationType="slide"
        onRequestClose={closeEditInvoice}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={styles.modalTitleBlock}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>تعديل الفاتورة</Text>
                <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
                  {editingInvoice ? formatInvoiceCode(editingInvoice.invoice_number, editingInvoice.invoice_code) : ''}
                </Text>
              </View>
              <Pressable onPress={closeEditInvoice} style={styles.modalCloseButton}>
                <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={styles.modalBodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.editField}>
                <Text style={[styles.editLabel, { color: colors.textSecondary }]}>اسم الفاتورة</Text>
                <TextInput
                  style={[styles.editInput, { backgroundColor: colors.surfaceLight, borderColor: colors.border, color: colors.text }]}
                  value={editInvoiceName}
                  onChangeText={setEditInvoiceName}
                  placeholder="اختياري"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              {editingInvoice?.invoice_type === 'merchant' && (
                <View style={styles.editFieldGrid}>
                  <View style={styles.editField}>
                    <Text style={[styles.editLabel, { color: colors.textSecondary }]}>اسم التاجر</Text>
                    <TextInput
                      style={[styles.editInput, { backgroundColor: colors.surfaceLight, borderColor: colors.border, color: colors.text }]}
                      value={editMerchantName}
                      onChangeText={setEditMerchantName}
                      placeholder="اسم التاجر"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                  <View style={styles.editField}>
                    <Text style={[styles.editLabel, { color: colors.textSecondary }]}>رقم التليفون</Text>
                    <TextInput
                      style={[styles.editInput, { backgroundColor: colors.surfaceLight, borderColor: colors.border, color: colors.text }]}
                      value={editMerchantPhone}
                      onChangeText={setEditMerchantPhone}
                      keyboardType="phone-pad"
                      placeholder="01xxxxxxxxx"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                </View>
              )}

              {editLines.map((line) => {
                const quantity = parseInt(line.quantity, 10) || 0;
                const unitPrice = toNumberInput(line.unitPrice);

                return (
                  <View key={line.id} style={[styles.editLineCard, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}>
                    <View style={styles.editLineHeader}>
                      <Text style={[styles.editLineName, { color: colors.text }]} numberOfLines={1}>
                        {line.productName}
                      </Text>
                      <Pressable
                        onPress={() => updateEditLine(line.id, { quantity: '0' })}
                        style={styles.returnLineButton}
                      >
                        <MaterialCommunityIcons name="backup-restore" size={17} color={colors.danger} />
                        <Text style={[styles.returnLineText, { color: colors.danger }]}>مرتجع</Text>
                      </Pressable>
                    </View>

                    <View style={styles.editLineControls}>
                      <View style={styles.editPriceField}>
                        <Text style={[styles.editLabel, { color: colors.textMuted }]}>السعر</Text>
                        <TextInput
                          style={[styles.editInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                          value={line.unitPrice}
                          onChangeText={(value) => updateEditLine(line.id, { unitPrice: value })}
                          keyboardType="decimal-pad"
                        />
                      </View>
                      <View style={styles.editQtyField}>
                        <Text style={[styles.editLabel, { color: colors.textMuted }]}>الكمية</Text>
                        <View style={styles.editQtyControls}>
                          <Pressable
                            onPress={() => adjustEditQuantity(line.id, -1)}
                            style={[styles.qtyButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                          >
                            <MaterialCommunityIcons name="minus" size={17} color={colors.text} />
                          </Pressable>
                          <TextInput
                            style={[styles.qtyInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                            value={line.quantity}
                            onChangeText={(value) => updateEditLine(line.id, { quantity: value })}
                            keyboardType="number-pad"
                            textAlign="center"
                          />
                          <Pressable
                            onPress={() => adjustEditQuantity(line.id, 1)}
                            style={[styles.qtyButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                          >
                            <MaterialCommunityIcons name="plus" size={17} color={colors.text} />
                          </Pressable>
                        </View>
                      </View>
                    </View>

                    <View style={styles.editLineTotalRow}>
                      <Text style={[styles.editLabel, { color: colors.textMuted }]}>إجمالي الصنف</Text>
                      <Text style={[styles.editLineTotal, { color: colors.primary }]}>
                        {formatCurrency(quantity * unitPrice, currency)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
              <View>
                <Text style={[styles.editLabel, { color: colors.textMuted }]}>الإجمالي الجديد</Text>
                <Text style={[styles.editGrandTotal, { color: colors.primary }]}>
                  {formatCurrency(editTotal, currency)}
                </Text>
              </View>
              <View style={styles.footerActions}>
                <Pressable
                  onPress={closeEditInvoice}
                  style={[styles.secondaryButton, { borderColor: colors.border }]}
                >
                  <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>إلغاء</Text>
                </Pressable>
                <Pressable
                  onPress={handleSaveEdit}
                  disabled={savingEdit}
                  style={[styles.saveButton, { backgroundColor: colors.primary, opacity: savingEdit ? 0.6 : 1 }]}
                >
                  <MaterialCommunityIcons name="content-save-outline" size={18} color="#fff" />
                  <Text style={styles.saveButtonText}>{savingEdit ? 'جاري الحفظ' : 'حفظ'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>
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
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    flexWrap: 'wrap',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
  },
  actionButtonText: { fontSize: Typography.fontSize.xs, fontWeight: '800' },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.base,
  },
  modalCard: {
    width: '100%',
    maxWidth: 680,
    maxHeight: '92%',
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  modalTitleBlock: { flex: 1, minWidth: 0 },
  modalTitle: { fontSize: Typography.fontSize.md, fontWeight: '800' },
  modalSubtitle: { fontSize: Typography.fontSize.xs, marginTop: 2 },
  modalCloseButton: { padding: Spacing.xs },
  modalBody: { minHeight: 0 },
  modalBodyContent: {
    padding: Spacing.base,
    gap: Spacing.md,
  },
  editFieldGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
    flexWrap: 'wrap',
  },
  editField: { flex: 1, minWidth: 220 },
  editLabel: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  editInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
  },
  editLineCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  editLineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  editLineName: { flex: 1, fontSize: Typography.fontSize.sm, fontWeight: '800' },
  returnLineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    gap: 4,
  },
  returnLineText: { fontSize: Typography.fontSize.xs, fontWeight: '800' },
  editLineControls: {
    flexDirection: 'row',
    gap: Spacing.md,
    flexWrap: 'wrap',
  },
  editPriceField: { flex: 1, minWidth: 130 },
  editQtyField: { flex: 1, minWidth: 170 },
  editQtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  qtyButton: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyInput: {
    flex: 1,
    minWidth: 58,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    fontSize: Typography.fontSize.base,
    fontWeight: '800',
  },
  editLineTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  editLineTotal: { fontSize: Typography.fontSize.base, fontWeight: '800' },
  modalFooter: {
    borderTopWidth: 1,
    padding: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    flexWrap: 'wrap',
  },
  editGrandTotal: { fontSize: Typography.fontSize.lg, fontWeight: '800' },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  secondaryButtonText: { fontSize: Typography.fontSize.sm, fontWeight: '800' },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  saveButtonText: { color: '#fff', fontSize: Typography.fontSize.sm, fontWeight: '800' },
});
