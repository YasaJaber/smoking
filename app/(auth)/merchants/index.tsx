// ============================================================
// Merchant Invoices Screen - wholesale-style invoices from stock
// ============================================================

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Alert,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CurrentDateBadge } from '../../../src/components/common/CurrentDateBadge';
import { ReceiptModal } from '../../../src/components/pos/ReceiptModal';
import { getAllProducts } from '../../../src/services/inventoryService';
import { createInvoice, getInvoiceWithItems } from '../../../src/services/invoiceService';
import { useAuthStore } from '../../../src/stores/authStore';
import { useSettingsStore } from '../../../src/stores/settingsStore';
import { useSyncStore } from '../../../src/stores/syncStore';
import { formatCurrency } from '../../../src/utils/formatters';
import { Colors, Gradients, Typography, Spacing, BorderRadius } from '../../../src/constants/theme';
import type { CartItem, Invoice, InvoiceItem, Product } from '../../../src/types';

interface MerchantLine {
  product: Product;
  quantity: number;
  unitPrice: number;
}

function toNumberInput(value: string): number {
  return parseFloat(value.replace(',', '.')) || 0;
}

export default function MerchantsScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 860;
  const darkMode = useSettingsStore((s) => s.settings.dark_mode);
  const colors = darkMode ? Colors.dark : Colors.light;
  const settings = useSettingsStore((s) => s.settings);
  const user = useAuthStore((s) => s.user);

  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [merchantName, setMerchantName] = useState('');
  const [merchantPhone, setMerchantPhone] = useState('');
  const [lines, setLines] = useState<MerchantLine[]>([]);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<Invoice | null>(null);
  const [lastItems, setLastItems] = useState<InvoiceItem[]>([]);

  const loadProducts = useCallback(async () => {
    setProducts(await getAllProducts());
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [loadProducts])
  );

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim();
    if (!query) return products;
    return products.filter((product) => product.name.includes(query));
  }, [products, searchQuery]);

  const subtotal = useMemo(
    () => lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
    [lines]
  );
  const taxAmount = settings.tax_enabled ? subtotal * settings.tax_rate : 0;
  const total = subtotal + taxAmount;
  const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);

  const selectedIds = new Set(lines.map((line) => line.product.id));

  const addProduct = (product: Product) => {
    if (product.quantity <= 0) {
      Alert.alert('المخزون غير كافي', 'الصنف ده خلصان من المخزون.');
      return;
    }

    setLines((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (existing) {
        return current.map((line) =>
          line.product.id === product.id
            ? { ...line, quantity: Math.min(product.quantity, line.quantity + 1) }
            : line
        );
      }

      return [...current, { product, quantity: 1, unitPrice: product.sell_price }];
    });
  };

  const removeLine = (productId: string) => {
    setLines((current) => current.filter((line) => line.product.id !== productId));
  };

  const updateQuantity = (productId: string, value: string) => {
    const quantity = Math.max(1, parseInt(value, 10) || 1);
    setLines((current) =>
      current.map((line) =>
        line.product.id === productId
          ? { ...line, quantity: Math.min(line.product.quantity, quantity) }
          : line
      )
    );
  };

  const adjustQuantity = (productId: string, delta: number) => {
    setLines((current) =>
      current.map((line) =>
        line.product.id === productId
          ? {
              ...line,
              quantity: Math.min(line.product.quantity, Math.max(1, line.quantity + delta)),
            }
          : line
      )
    );
  };

  const updateUnitPrice = (productId: string, value: string) => {
    const unitPrice = toNumberInput(value);
    setLines((current) =>
      current.map((line) =>
        line.product.id === productId ? { ...line, unitPrice } : line
      )
    );
  };

  const resetForm = () => {
    setMerchantName('');
    setMerchantPhone('');
    setSearchQuery('');
    setLines([]);
  };

  const handleCreateInvoice = async () => {
    const normalizedName = merchantName.trim();
    const normalizedPhone = merchantPhone.trim();

    if (!normalizedName) {
      Alert.alert('بيانات ناقصة', 'اكتب اسم التاجر الأول.');
      return;
    }

    if (!normalizedPhone) {
      Alert.alert('بيانات ناقصة', 'اكتب رقم تليفون التاجر.');
      return;
    }

    if (lines.length === 0) {
      Alert.alert('الفاتورة فاضية', 'اختار صنف واحد على الأقل من المخزون.');
      return;
    }

    const invalidPrice = lines.find((line) => line.unitPrice <= 0);
    if (invalidPrice) {
      Alert.alert('سعر غير صحيح', `راجع سعر "${invalidPrice.product.name}".`);
      return;
    }

    const stockProblem = lines.find((line) => line.quantity > line.product.quantity);
    if (stockProblem) {
      Alert.alert(
        'المخزون غير كافي',
        `المتاح من "${stockProblem.product.name}" هو ${stockProblem.product.quantity} فقط.`
      );
      return;
    }

    if (!user) {
      Alert.alert('خطأ', 'لا يوجد مستخدم مسجل.');
      return;
    }

    const cartItems: CartItem[] = lines.map((line) => ({
      product: { ...line.product, sell_price: line.unitPrice },
      quantity: line.quantity,
      total: line.unitPrice * line.quantity,
    }));

    try {
      const invoice = await createInvoice(
        cartItems,
        subtotal,
        taxAmount,
        total,
        user.id,
        total,
        {
          invoiceName: `فاتورة تاجر - ${normalizedName}`,
          invoiceType: 'merchant',
          merchantName: normalizedName,
          merchantPhone: normalizedPhone,
        }
      );

      const saved = await getInvoiceWithItems(invoice.id);
      setLastInvoice(saved?.invoice ?? invoice);
      setLastItems(saved?.items ?? []);
      setShowReceipt(true);
      resetForm();
      await loadProducts();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      useSyncStore.getState().sync(true);
    } catch (error: any) {
      console.error('Merchant invoice error:', error);
      await loadProducts();

      const message = String(error?.message || '');
      if (message.startsWith('INSUFFICIENT_STOCK:')) {
        const [, productName, available] = message.split(':');
        Alert.alert(
          'المخزون غير كافي',
          available
            ? `الصنف "${productName}" المتاح منه ${available} فقط.`
            : `الصنف "${productName}" كميته غير كافية.`
        );
        return;
      }

      Alert.alert('خطأ', 'حصلت مشكلة أثناء إصدار فاتورة التاجر.');
    }
  };

  const renderProduct = ({ item, index }: { item: Product; index: number }) => {
    const selected = selectedIds.has(item.id);
    const outOfStock = item.quantity <= 0;

    return (
      <Animated.View entering={FadeInDown.duration(220).delay(index * 25)}>
        <Pressable
          onPress={() => addProduct(item)}
          disabled={outOfStock}
          style={[
            styles.productRow,
            {
              backgroundColor: selected ? colors.primaryGlow : colors.surface,
              borderColor: selected ? colors.primary : colors.border,
              opacity: outOfStock ? 0.55 : 1,
            },
          ]}
        >
          <View style={[styles.productIcon, { backgroundColor: colors.surfaceLight }]}>
            <MaterialCommunityIcons
              name={selected ? 'check' : 'package-variant-closed'}
              size={20}
              color={selected ? colors.accent : colors.primary}
            />
          </View>
          <View style={styles.productInfo}>
            <Text style={[styles.productName, { color: colors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.productMeta, { color: colors.textMuted }]}>
              متاح: {item.quantity}
            </Text>
          </View>
          <Text style={[styles.productPrice, { color: colors.primary }]}>
            {formatCurrency(item.sell_price, settings.currency)}
          </Text>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>فاتورة تجار</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
            أصناف من المخزون مع سعر وكمية لكل صنف
          </Text>
        </View>
        <CurrentDateBadge />
      </View>

      <View style={[styles.content, isCompact && styles.contentCompact]}>
        <View style={[styles.catalogPane, { backgroundColor: colors.background }]}>
          <View style={styles.formGrid}>
            <View style={styles.formField}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>اسم التاجر</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surfaceLight, borderColor: colors.border, color: colors.text }]}
                value={merchantName}
                onChangeText={setMerchantName}
                placeholder="مثال: أحمد للتوزيع"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={styles.formField}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>رقم التليفون</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surfaceLight, borderColor: colors.border, color: colors.text }]}
                value={merchantPhone}
                onChangeText={setMerchantPhone}
                keyboardType="phone-pad"
                placeholder="01xxxxxxxxx"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>

          <View style={[styles.searchBox, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="بحث في المخزون..."
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <FlatList
            data={filteredProducts}
            keyExtractor={(item) => item.id}
            renderItem={renderProduct}
            contentContainerStyle={styles.productList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="package-variant" size={44} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>لا توجد أصناف</Text>
              </View>
            }
          />
        </View>

        <View style={[styles.invoicePane, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.invoiceHeader}>
            <View>
              <Text style={[styles.invoiceTitle, { color: colors.text }]}>الفاتورة</Text>
              <Text style={[styles.invoiceSub, { color: colors.textMuted }]}>
                {lines.length} صنف • {totalQuantity} قطعة
              </Text>
            </View>
            {lines.length > 0 && (
              <Pressable onPress={() => setLines([])} style={styles.clearBtn}>
                <MaterialCommunityIcons name="delete-outline" size={20} color={colors.danger} />
              </Pressable>
            )}
          </View>

          <ScrollView
            style={styles.linesList}
            contentContainerStyle={lines.length === 0 ? styles.linesEmptyContent : undefined}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {lines.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="receipt-text-plus-outline" size={46} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>اختار الأصناف من المخزون</Text>
              </View>
            ) : (
              lines.map((line) => (
                <View key={line.product.id} style={[styles.lineCard, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}>
                  <View style={styles.lineTop}>
                    <View style={styles.lineNameWrap}>
                      <Text style={[styles.lineName, { color: colors.text }]} numberOfLines={1}>
                        {line.product.name}
                      </Text>
                      <Text style={[styles.lineStock, { color: colors.textMuted }]}>
                        المتاح: {line.product.quantity}
                      </Text>
                    </View>
                    <Pressable onPress={() => removeLine(line.product.id)} style={styles.removeBtn}>
                      <MaterialCommunityIcons name="close" size={18} color={colors.textMuted} />
                    </Pressable>
                  </View>

                  <View style={styles.lineControls}>
                    <View style={styles.priceField}>
                      <Text style={[styles.smallLabel, { color: colors.textMuted }]}>السعر</Text>
                      <TextInput
                        style={[styles.lineInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                        value={String(line.unitPrice)}
                        onChangeText={(value) => updateUnitPrice(line.product.id, value)}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={styles.qtyField}>
                      <Text style={[styles.smallLabel, { color: colors.textMuted }]}>الكمية</Text>
                      <View style={styles.qtyControls}>
                        <Pressable
                          onPress={() => adjustQuantity(line.product.id, -1)}
                          style={[styles.qtyBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        >
                          <MaterialCommunityIcons name="minus" size={17} color={colors.text} />
                        </Pressable>
                        <TextInput
                          style={[styles.qtyInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                          value={String(line.quantity)}
                          onChangeText={(value) => updateQuantity(line.product.id, value)}
                          keyboardType="number-pad"
                          textAlign="center"
                        />
                        <Pressable
                          onPress={() => adjustQuantity(line.product.id, 1)}
                          style={[styles.qtyBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        >
                          <MaterialCommunityIcons name="plus" size={17} color={colors.text} />
                        </Pressable>
                      </View>
                    </View>
                  </View>

                  <View style={styles.lineTotalRow}>
                    <Text style={[styles.smallLabel, { color: colors.textMuted }]}>الإجمالي</Text>
                    <Text style={[styles.lineTotal, { color: colors.primary }]}>
                      {formatCurrency(line.unitPrice * line.quantity, settings.currency)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          <View style={[styles.totalsBox, { borderTopColor: colors.border }]}>
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>المجموع</Text>
              <Text style={[styles.totalValue, { color: colors.text }]}>{formatCurrency(subtotal, settings.currency)}</Text>
            </View>
            {settings.tax_enabled && (
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>الضريبة</Text>
                <Text style={[styles.totalValue, { color: colors.warning }]}>{formatCurrency(taxAmount, settings.currency)}</Text>
              </View>
            )}
            <View style={styles.grandRow}>
              <Text style={[styles.grandLabel, { color: colors.text }]}>الإجمالي النهائي</Text>
              <Text style={[styles.grandValue, { color: colors.primary }]}>{formatCurrency(total, settings.currency)}</Text>
            </View>

            <Pressable onPress={handleCreateInvoice} disabled={lines.length === 0}>
              <LinearGradient
                colors={Gradients.primary as unknown as readonly [string, string, ...string[]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.createBtn, lines.length === 0 && { opacity: 0.5 }]}
              >
                <MaterialCommunityIcons name="receipt-text-check" size={21} color="#fff" />
                <Text style={styles.createBtnText}>إصدار الفاتورة</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>

      <ReceiptModal
        visible={showReceipt}
        invoice={lastInvoice}
        items={lastItems}
        onClose={() => setShowReceipt(false)}
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
  content: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 0,
  },
  contentCompact: {
    flexDirection: 'column',
  },
  catalogPane: {
    flex: 1,
    padding: Spacing.base,
    minHeight: 0,
  },
  invoicePane: {
    width: 420,
    maxWidth: '100%',
    borderLeftWidth: 1,
    padding: Spacing.base,
    minHeight: 0,
  },
  formGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
    flexWrap: 'wrap',
    marginBottom: Spacing.md,
  },
  formField: {
    flex: 1,
    minWidth: 220,
  },
  label: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: Typography.fontSize.base,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.sm,
    fontSize: Typography.fontSize.sm,
    marginLeft: Spacing.sm,
  },
  productList: {
    paddingBottom: Spacing['4xl'],
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  productIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInfo: { flex: 1, minWidth: 0 },
  productName: { fontSize: Typography.fontSize.sm, fontWeight: '700' },
  productMeta: { fontSize: Typography.fontSize.xs, marginTop: 2 },
  productPrice: { fontSize: Typography.fontSize.sm, fontWeight: '800' },
  invoiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  invoiceTitle: { fontSize: Typography.fontSize.md, fontWeight: '800' },
  invoiceSub: { fontSize: Typography.fontSize.xs, marginTop: 2 },
  clearBtn: { padding: Spacing.sm },
  linesList: { flex: 1 },
  linesEmptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  lineCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  lineTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  lineNameWrap: { flex: 1, minWidth: 0 },
  lineName: { fontSize: Typography.fontSize.sm, fontWeight: '800' },
  lineStock: { fontSize: Typography.fontSize.xs, marginTop: 2 },
  removeBtn: { padding: Spacing.xs },
  lineControls: {
    flexDirection: 'row',
    gap: Spacing.md,
    flexWrap: 'wrap',
  },
  priceField: { flex: 1, minWidth: 120 },
  qtyField: { flex: 1, minWidth: 150 },
  smallLabel: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  lineInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  qtyBtn: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyInput: {
    flex: 1,
    minWidth: 54,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    fontSize: Typography.fontSize.base,
    fontWeight: '800',
  },
  lineTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
  },
  lineTotal: { fontSize: Typography.fontSize.base, fontWeight: '800' },
  totalsBox: {
    borderTopWidth: 1,
    paddingTop: Spacing.md,
    gap: Spacing.xs,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: { fontSize: Typography.fontSize.sm },
  totalValue: { fontSize: Typography.fontSize.sm, fontWeight: '700' },
  grandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  grandLabel: { fontSize: Typography.fontSize.md, fontWeight: '800' },
  grandValue: { fontSize: Typography.fontSize.lg, fontWeight: '800' },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  createBtnText: {
    color: '#fff',
    fontSize: Typography.fontSize.base,
    fontWeight: '800',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing['4xl'],
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
    textAlign: 'center',
  },
});
