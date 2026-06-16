// ============================================================
// ReceiptModal - shows the invoice after a sale with
// print / export-PDF / new-sale actions
// ============================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { Colors, Gradients, Typography, Spacing, BorderRadius } from '../../constants/theme';
import { useSettingsStore } from '../../stores/settingsStore';
import { formatCurrency, formatDateTime, formatInvoiceCode } from '../../utils/formatters';
import { printInvoice, shareInvoicePdf } from '../../services/printService';
import type { Invoice, InvoiceItem } from '../../types';

interface ReceiptModalProps {
  visible: boolean;
  invoice: Invoice | null;
  items: InvoiceItem[];
  onClose: () => void;
}

export function ReceiptModal({ visible, invoice, items, onClose }: ReceiptModalProps) {
  const darkMode = useSettingsStore((s) => s.settings.dark_mode);
  const colors = darkMode ? Colors.dark : Colors.light;
  const settings = useSettingsStore((s) => s.settings);
  const currency = settings.currency;

  const [printing, setPrinting] = useState(false);
  const [exporting, setExporting] = useState(false);

  if (!invoice) return null;

  const handlePrint = async () => {
    setPrinting(true);
    try {
      await printInvoice({ invoice, items });
    } catch (error) {
      console.error('Print error:', error);
      Alert.alert('خطأ', 'حصلت مشكلة أثناء الطباعة. حاول تاني.');
    } finally {
      setPrinting(false);
    }
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      await shareInvoicePdf({ invoice, items });
    } catch (error) {
      console.error('PDF export error:', error);
      Alert.alert('خطأ', 'حصلت مشكلة أثناء عمل ملف PDF. حاول تاني.');
    } finally {
      setExporting(false);
    }
  };

  const statusLabel =
    invoice.status === 'partial' ? 'دفع جزئي' : invoice.status === 'refunded' ? 'مرتجع' : 'مدفوعة';
  const statusColor =
    invoice.status === 'partial' ? colors.warning : invoice.status === 'refunded' ? colors.danger : colors.accent;
  const calculatedTotal = invoice.subtotal + invoice.tax_amount;
  const priceAdjustment = invoice.total - calculatedTotal;
  const hasPriceAdjustment = Math.abs(priceAdjustment) > 0.005;
  const successTitle = invoice.invoice_type === 'merchant' ? 'تم إصدار فاتورة التاجر' : 'تم البيع بنجاح';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <Animated.View
          entering={SlideInDown.duration(300)}
          style={[styles.modal, { backgroundColor: colors.surface }]}
        >
          {/* Success header */}
          <LinearGradient
            colors={Gradients.accent as unknown as readonly [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.successHeader}
          >
            <MaterialCommunityIcons name="check-circle" size={36} color="#fff" />
            <Text style={styles.successTitle}>{successTitle}</Text>
            <Text style={styles.successAmount}>{formatCurrency(invoice.total, currency)}</Text>
          </LinearGradient>

          {/* Receipt body */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {invoice.invoice_name && (
              <View style={styles.metaRow}>
                <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>اسم الفاتورة</Text>
                <Text style={[styles.metaValue, { color: colors.text }]} numberOfLines={1}>
                  {invoice.invoice_name}
                </Text>
              </View>
            )}
            {invoice.merchant_name && (
              <View style={styles.metaRow}>
                <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>اسم التاجر</Text>
                <Text style={[styles.metaValue, { color: colors.text }]} numberOfLines={1}>
                  {invoice.merchant_name}
                </Text>
              </View>
            )}
            {invoice.merchant_phone && (
              <View style={styles.metaRow}>
                <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>تليفون التاجر</Text>
                <Text style={[styles.metaValue, { color: colors.text }]}>
                  {invoice.merchant_phone}
                </Text>
              </View>
            )}
            <View style={styles.metaRow}>
              <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>رقم الفاتورة</Text>
              <Text style={[styles.metaValue, { color: colors.text }]}>
                {formatInvoiceCode(invoice.invoice_number, invoice.invoice_code)}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>التاريخ</Text>
              <Text style={[styles.metaValue, { color: colors.text }]}>
                {formatDateTime(invoice.created_at)}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>الحالة</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
                <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Items */}
            {items.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>
                    {item.product_name}
                  </Text>
                  <Text style={[styles.itemSub, { color: colors.textMuted }]}>
                    {formatCurrency(item.unit_price, currency)} × {item.quantity}
                  </Text>
                </View>
                <Text style={[styles.itemTotal, { color: colors.text }]}>
                  {formatCurrency(item.total, currency)}
                </Text>
              </View>
            ))}

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Totals */}
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>المجموع الفرعي</Text>
              <Text style={[styles.totalValue, { color: colors.text }]}>
                {formatCurrency(invoice.subtotal, currency)}
              </Text>
            </View>
            {settings.tax_enabled && (
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>الضريبة</Text>
                <Text style={[styles.totalValue, { color: colors.warning }]}>
                  {formatCurrency(invoice.tax_amount, currency)}
                </Text>
              </View>
            )}
            {hasPriceAdjustment && (
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: priceAdjustment < 0 ? colors.accent : colors.warning }]}>
                  {priceAdjustment < 0 ? 'خصم' : 'تعديل سعر'}
                </Text>
                <Text style={[styles.totalValue, { color: priceAdjustment < 0 ? colors.accent : colors.warning }]}>
                  {priceAdjustment < 0 ? '-' : '+'}{formatCurrency(Math.abs(priceAdjustment), currency)}
                </Text>
              </View>
            )}
            <View style={[styles.totalRow, styles.grandRow]}>
              <Text style={[styles.grandLabel, { color: colors.text }]}>الإجمالي النهائي</Text>
              <Text style={[styles.grandValue, { color: colors.primary }]}>
                {formatCurrency(invoice.total, currency)}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>المدفوع</Text>
              <Text style={[styles.totalValue, { color: colors.accent }]}>
                {formatCurrency(invoice.amount_paid, currency)}
              </Text>
            </View>
            {invoice.amount_due > 0 && (
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: colors.danger }]}>المتبقي</Text>
                <Text style={[styles.totalValue, { color: colors.danger }]}>
                  {formatCurrency(invoice.amount_due, currency)}
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Actions */}
          <View style={[styles.actions, { borderTopColor: colors.border }]}>
            <View style={styles.actionsRow}>
              <Pressable
                onPress={handlePrint}
                disabled={printing}
                style={[styles.outlineBtn, { borderColor: colors.border, backgroundColor: colors.surfaceLight }]}
              >
                {printing ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <MaterialCommunityIcons name="printer" size={20} color={colors.primary} />
                )}
                <Text style={[styles.outlineBtnText, { color: colors.text }]}>طباعة</Text>
              </Pressable>

              <Pressable
                onPress={handleExportPdf}
                disabled={exporting}
                style={[styles.outlineBtn, { borderColor: colors.border, backgroundColor: colors.surfaceLight }]}
              >
                {exporting ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <MaterialCommunityIcons name="file-pdf-box" size={20} color={colors.danger} />
                )}
                <Text style={[styles.outlineBtnText, { color: colors.text }]}>PDF / مشاركة</Text>
              </Pressable>
            </View>

            <Pressable onPress={onClose}>
              <LinearGradient
                colors={Gradients.primary as unknown as readonly [string, string, ...string[]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.doneBtn}
              >
                <MaterialCommunityIcons name="plus-circle" size={22} color="#fff" />
                <Text style={styles.doneText}>بيع جديد</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.base,
  },
  modal: {
    width: 420,
    maxWidth: '100%',
    maxHeight: '92%',
    borderRadius: BorderRadius['2xl'],
    overflow: 'hidden',
  },
  successHeader: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    gap: Spacing.xs,
  },
  successTitle: {
    color: '#fff',
    fontSize: Typography.fontSize.md,
    fontWeight: '800',
  },
  successAmount: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: Typography.fontSize.xl,
    fontWeight: '800',
  },
  body: {
    paddingHorizontal: Spacing.xl,
  },
  bodyContent: {
    paddingVertical: Spacing.lg,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  metaLabel: {
    fontSize: Typography.fontSize.sm,
  },
  metaValue: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginVertical: Spacing.md,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
  },
  itemSub: {
    fontSize: Typography.fontSize.xs,
    marginTop: 2,
  },
  itemTotal: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  totalLabel: {
    fontSize: Typography.fontSize.sm,
  },
  totalValue: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
  },
  grandRow: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  grandLabel: {
    fontSize: Typography.fontSize.md,
    fontWeight: '800',
  },
  grandValue: {
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
  },
  actions: {
    padding: Spacing.base,
    borderTopWidth: 1,
    gap: Spacing.md,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  outlineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  outlineBtnText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  doneText: {
    color: '#fff',
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
  },
});
