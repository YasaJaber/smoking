// ============================================================
// Main POS Screen - Split View (Products + Cart)
// With checkout modal supporting partial payment
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  Modal,
  TextInput,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryBar } from '../../../src/components/pos/CategoryBar';
import { ProductGrid } from '../../../src/components/pos/ProductGrid';
import { CartPanel } from '../../../src/components/pos/CartPanel';
import { ReceiptModal } from '../../../src/components/pos/ReceiptModal';
import { SyncIndicator } from '../../../src/components/common/SyncIndicator';
import { useSyncStore } from '../../../src/stores/syncStore';
import { useCartStore } from '../../../src/stores/cartStore';
import { useAuthStore } from '../../../src/stores/authStore';
import { useSettingsStore } from '../../../src/stores/settingsStore';
import { createInvoice, getInvoiceWithItems } from '../../../src/services/invoiceService';
import { getDatabase } from '../../../src/db/client';
import { formatCurrency } from '../../../src/utils/formatters';
import { Colors, Gradients, Typography, Spacing, BorderRadius } from '../../../src/constants/theme';
import type { Category, Product, Invoice, InvoiceItem } from '../../../src/types';
import { router, useFocusEffect } from 'expo-router';

const { width } = Dimensions.get('window');
const isTablet = width >= 768;

export default function POSScreen() {
  const insets = useSafeAreaInsets();
  const darkMode = useSettingsStore((s) => s.settings.dark_mode);
  const colors = darkMode ? Colors.dark : Colors.light;
  const settings = useSettingsStore((s) => s.settings);
  const { user, logout } = useAuthStore();
  const cart = useCartStore();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [paidAmount, setPaidAmount] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<Invoice | null>(null);
  const [lastItems, setLastItems] = useState<InvoiceItem[]>([]);

  // Reload categories + products every time the screen gains focus, so changes
  // made in other tabs (e.g. adding a category in Inventory) show up here.
  useFocusEffect(
    useCallback(() => {
      loadCategories();
      loadProducts(selectedCategory);
    }, [selectedCategory])
  );

  // Load products when category changes
  useEffect(() => {
    loadProducts(selectedCategory);
  }, [selectedCategory]);

  // Set tax config from settings
  useEffect(() => {
    cart.setTaxConfig(settings.tax_enabled, settings.tax_rate);
  }, [settings.tax_enabled, settings.tax_rate]);

  const loadCategories = async () => {
    const db = await getDatabase();
    const cats = await db.getAllAsync<Category>(
      'SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order ASC'
    );
    setCategories(cats);
  };

  const loadProducts = async (categoryId: string | null) => {
    const db = await getDatabase();
    let prods: Product[];
    if (categoryId) {
      prods = await db.getAllAsync<Product>(
        'SELECT * FROM products WHERE category_id = ? AND is_active = 1 ORDER BY name ASC',
        [categoryId]
      );
    } else {
      prods = await db.getAllAsync<Product>(
        'SELECT * FROM products WHERE is_active = 1 ORDER BY name ASC'
      );
    }
    setProducts(prods);
  };

  const handleProductPress = useCallback(
    (product: Product) => {
      cart.addItem(product);
    },
    [cart]
  );

  const handleOpenCheckout = () => {
    if (cart.items.length === 0) return;
    setPaidAmount(cart.total.toFixed(2));
    setShowCheckout(true);
  };

  const handleConfirmCheckout = async () => {
    if (cart.items.length === 0 || !user) return;

    const paid = parseFloat(paidAmount) || 0;
    if (paid <= 0) {
      Alert.alert('خطأ', 'يجب إدخال مبلغ مدفوع صحيح');
      return;
    }

    try {
      const invoice = await createInvoice(
        cart.items,
        cart.subtotal,
        cart.taxAmount,
        cart.total,
        user.id,
        paid
      );

      setShowCheckout(false);
      cart.clearCart();

      // Load the saved invoice with its items to render the receipt
      const saved = await getInvoiceWithItems(invoice.id);
      setLastInvoice(saved?.invoice ?? invoice);
      setLastItems(saved?.items ?? []);
      setShowReceipt(true);

      // Refresh products to show updated stock
      await loadProducts(selectedCategory);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Push the new sale to the server in the background
      useSyncStore.getState().sync(true);
    } catch (error) {
      console.error('Checkout error:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء إتمام البيع. حاول مرة أخرى.');
    }
  };

  const handleLogout = () => {
    Alert.alert('تسجيل الخروج', 'هل تريد تسجيل الخروج؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'خروج',
        style: 'destructive',
        onPress: () => {
          cart.clearCart();
          logout();
          router.replace('/');
        },
      },
    ]);
  };

  const paidNum = parseFloat(paidAmount) || 0;
  const changeAmount = paidNum - cart.total;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Top Bar */}
      <View style={[styles.topBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.topBarLeft}>
          <LinearGradient
            colors={Gradients.primary as unknown as readonly [string, string, ...string[]]}
            style={styles.miniLogo}
          >
            <MaterialCommunityIcons name="store" size={18} color="#fff" />
          </LinearGradient>
          <View>
            <Text style={[styles.storeName, { color: colors.text }]}>
              {settings.store_name}
            </Text>
            <Text style={[styles.userName, { color: colors.textMuted }]}>
              {user?.name} • {user?.role === 'admin' ? 'مدير' : 'كاشير'}
            </Text>
          </View>
        </View>

        <View style={styles.topBarRight}>
          <SyncIndicator />

          <Pressable onPress={handleLogout} style={styles.logoutBtn}>
            <MaterialCommunityIcons name="logout" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* Main Content - Split View */}
      <View style={styles.mainContent}>
        {/* Left: Products */}
        <View style={styles.productsSection}>
          <CategoryBar
            categories={categories}
            selectedId={selectedCategory}
            onSelect={setSelectedCategory}
          />
          <ProductGrid
            products={products}
            onProductPress={handleProductPress}
          />
        </View>

        {/* Right: Cart */}
        <View style={styles.cartSection}>
          <CartPanel onCheckout={handleOpenCheckout} />
        </View>
      </View>

      {/* Checkout Modal */}
      <Modal
        visible={showCheckout}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCheckout(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <Animated.View
            entering={SlideInDown.duration(300)}
            style={[styles.checkoutModal, { backgroundColor: colors.surface }]}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                إتمام البيع
              </Text>
              <Pressable onPress={() => setShowCheckout(false)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>

            {/* Total */}
            <View style={[styles.totalBox, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}>
              <Text style={[styles.totalBoxLabel, { color: colors.textSecondary }]}>
                إجمالي الفاتورة
              </Text>
              <Text style={[styles.totalBoxValue, { color: colors.primary }]}>
                {formatCurrency(cart.total, settings.currency)}
              </Text>
            </View>

            {/* Paid Amount Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                المبلغ المدفوع
              </Text>
              <TextInput
                style={[
                  styles.amountInput,
                  {
                    backgroundColor: colors.surfaceLight,
                    borderColor: colors.borderFocused,
                    color: colors.text,
                  },
                ]}
                value={paidAmount}
                onChangeText={setPaidAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                selectTextOnFocus
              />
            </View>

            {/* Change / Remaining */}
            <View style={[
              styles.changeBox,
              {
                backgroundColor: changeAmount >= 0 ? colors.accentGlow : colors.dangerGlow,
                borderColor: changeAmount >= 0 ? colors.accent : colors.danger,
              }
            ]}>
              <MaterialCommunityIcons
                name={changeAmount >= 0 ? 'cash-check' : 'alert-circle-outline'}
                size={22}
                color={changeAmount >= 0 ? colors.accent : colors.danger}
              />
              <View>
                <Text style={[styles.changeLabel, { color: changeAmount >= 0 ? colors.accent : colors.danger }]}>
                  {changeAmount >= 0 ? 'الباقي للعميل' : 'المتبقي على العميل'}
                </Text>
                <Text style={[styles.changeValue, { color: changeAmount >= 0 ? colors.accent : colors.danger }]}>
                  {formatCurrency(Math.abs(changeAmount), settings.currency)}
                </Text>
              </View>
            </View>

            {/* Quick Amount Buttons */}
            <View style={styles.quickAmounts}>
              {[cart.total, Math.ceil(cart.total / 10) * 10, Math.ceil(cart.total / 50) * 50, Math.ceil(cart.total / 100) * 100].filter((v, i, a) => a.indexOf(v) === i).map((amount) => (
                <Pressable
                  key={amount}
                  onPress={() => setPaidAmount(amount.toFixed(2))}
                  style={[styles.quickBtn, {
                    backgroundColor: parseFloat(paidAmount) === amount ? colors.primaryGlow : colors.surfaceLight,
                    borderColor: parseFloat(paidAmount) === amount ? colors.primary : colors.border,
                  }]}
                >
                  <Text style={[styles.quickBtnText, {
                    color: parseFloat(paidAmount) === amount ? colors.primary : colors.text,
                  }]}>
                    {amount.toFixed(0)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Confirm Button */}
            <Pressable onPress={handleConfirmCheckout}>
              <LinearGradient
                colors={Gradients.primary as unknown as readonly [string, string, ...string[]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.confirmBtn}
              >
                <MaterialCommunityIcons name="check-circle" size={22} color="#fff" />
                <Text style={styles.confirmText}>
                  {changeAmount < 0 ? 'تأكيد (دفع جزئي)' : 'تأكيد البيع'}
                </Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>

      {/* Receipt / Invoice after sale */}
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
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  miniLogo: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storeName: {
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
  },
  userName: {
    fontSize: Typography.fontSize.xs,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
  },
  statusDot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: Typography.fontSize.xs,
  },
  logoutBtn: {
    padding: Spacing.sm,
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },
  productsSection: {
    flex: isTablet ? 0.62 : 0.55,
  },
  cartSection: {
    flex: isTablet ? 0.38 : 0.45,
  },
  // Checkout Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkoutModal: {
    width: isTablet ? 420 : 340,
    borderRadius: BorderRadius['2xl'],
    padding: Spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  modalTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: '700',
  },
  totalBox: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.xl,
  },
  totalBoxLabel: {
    fontSize: Typography.fontSize.sm,
    marginBottom: Spacing.xs,
  },
  totalBoxValue: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: '800',
  },
  inputGroup: {
    marginBottom: Spacing.base,
  },
  inputLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '500',
    marginBottom: Spacing.sm,
  },
  amountInput: {
    fontSize: Typography.fontSize.xl,
    fontWeight: '700',
    borderWidth: 2,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    textAlign: 'center',
  },
  changeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.base,
  },
  changeLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '500',
  },
  changeValue: {
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
  },
  quickAmounts: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
    flexWrap: 'wrap',
  },
  quickBtn: {
    flex: 1,
    minWidth: 60,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  quickBtnText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  confirmText: {
    color: '#fff',
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
  },
});
