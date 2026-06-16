// ============================================================
// Main POS Screen - Split View (Products + Cart)
// With checkout modal supporting partial payment
// Resizable cart panel via drag handle
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
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  SlideInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryBar } from '../../../src/components/pos/CategoryBar';
import { ProductGrid } from '../../../src/components/pos/ProductGrid';
import { CartPanel } from '../../../src/components/pos/CartPanel';
import { ReceiptModal } from '../../../src/components/pos/ReceiptModal';
import { QuickCustomItemModal } from '../../../src/components/pos/QuickCustomItemModal';
import { CurrentDateBadge } from '../../../src/components/common/CurrentDateBadge';
import { SyncIndicator } from '../../../src/components/common/SyncIndicator';
import { useSyncStore } from '../../../src/stores/syncStore';
import { useCartStore } from '../../../src/stores/cartStore';
import { useAuthStore } from '../../../src/stores/authStore';
import { useSettingsStore } from '../../../src/stores/settingsStore';
import { createInvoice, getInvoiceWithItems, getPartialDebtSummary, type PartialDebtSummary } from '../../../src/services/invoiceService';
import { getDatabase } from '../../../src/db/client';
import { formatCurrency } from '../../../src/utils/formatters';
import { Colors, Gradients, Typography, Spacing, BorderRadius } from '../../../src/constants/theme';
import type { Category, Product, Invoice, InvoiceItem } from '../../../src/types';
import { router, useFocusEffect } from 'expo-router';

export default function POSScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 768;
  const darkMode = useSettingsStore((s) => s.settings.dark_mode);
  const colors = darkMode ? Colors.dark : Colors.light;
  const settings = useSettingsStore((s) => s.settings);
  const { user, logout } = useAuthStore();
  const cart = useCartStore();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [finalTotalAmount, setFinalTotalAmount] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [invoiceName, setInvoiceName] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [showQuickItem, setShowQuickItem] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<Invoice | null>(null);
  const [lastItems, setLastItems] = useState<InvoiceItem[]>([]);
  const [debtSummary, setDebtSummary] = useState<PartialDebtSummary>({ count: 0, totalDue: 0, oldestDate: null });

  // Reload categories + products every time the screen gains focus, so changes
  // made in other tabs (e.g. adding a category in Inventory) show up here.
  useFocusEffect(
    useCallback(() => {
      loadCategories();
      loadProducts(selectedCategory);
      loadDebtSummary();
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

  const loadDebtSummary = async () => {
    setDebtSummary(await getPartialDebtSummary());
  };

  const handleProductPress = useCallback(
    (product: Product) => {
      cart.addItem(product);
    },
    [cart]
  );

  const handleOpenCheckout = () => {
    if (cart.items.length === 0) return;
    const defaultTotal = cart.total.toFixed(2);
    setInvoiceName('');
    setFinalTotalAmount(defaultTotal);
    setPaidAmount(defaultTotal);
    setShowCheckout(true);
  };

  const handleFinalTotalChange = (value: string) => {
    setFinalTotalAmount(value);
    setPaidAmount(value);
  };

  const handleConfirmCheckout = async () => {
    if (cart.items.length === 0 || !user) return;

    const finalTotal = parseFloat(finalTotalAmount) || 0;
    if (finalTotal <= 0) {
      Alert.alert('خطأ', 'يجب إدخال إجمالي نهائي صحيح');
      return;
    }

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
        finalTotal,
        user.id,
        paid,
        invoiceName
      );

      setShowCheckout(false);
      setFinalTotalAmount('');
      setInvoiceName('');
      cart.clearCart();

      // Load the saved invoice with its items to render the receipt
      const saved = await getInvoiceWithItems(invoice.id);
      setLastInvoice(saved?.invoice ?? invoice);
      setLastItems(saved?.items ?? []);
      setShowReceipt(true);

      // Refresh products to show updated stock
      await loadProducts(selectedCategory);
      await loadDebtSummary();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Push the new sale to the server in the background
      useSyncStore.getState().sync(true);
    } catch (error: any) {
      console.error('Checkout error:', error);
      await loadProducts(selectedCategory);

      const message = String(error?.message || '');
      if (message.startsWith('INSUFFICIENT_STOCK:')) {
        const [, productName, available] = message.split(':');
        Alert.alert(
          'المخزون غير كافي',
          available
            ? `الصنف "${productName}" المتاح منه ${available} فقط. راجع الكمية في الفاتورة.`
            : `الصنف "${productName}" كميته غير كافية. راجع الكمية في الفاتورة.`
        );
        return;
      }

      if (message.startsWith('PRODUCT_NOT_FOUND:')) {
        Alert.alert('الصنف غير متاح', 'تم حذف أو تعطيل صنف من الفاتورة. راجع الفاتورة وحاول مرة أخرى.');
        return;
      }

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

  const finalTotalNum = parseFloat(finalTotalAmount) || 0;
  const paidNum = parseFloat(paidAmount) || 0;
  const changeAmount = paidNum - finalTotalNum;
  const priceAdjustment = finalTotalNum - cart.total;
  const hasPriceAdjustment = Math.abs(priceAdjustment) > 0.005;

  // ── Resizable cart panel ──────────────────────────────────
  const DEFAULT_CART_RATIO = 0.38;
  const MIN_CART_RATIO = 0.25;
  const MAX_CART_RATIO = 0.55;

  const cartRatio = useSharedValue(DEFAULT_CART_RATIO);
  const dragStartRatio = useSharedValue(DEFAULT_CART_RATIO);
  const isDragging = useSharedValue(false);

  const triggerHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const resizePanGesture = Gesture.Pan()
    .onStart(() => {
      dragStartRatio.value = cartRatio.value;
      isDragging.value = true;
      runOnJS(triggerHaptic)();
    })
    .onUpdate((e) => {
      // Negative translationX = dragging left = cart gets bigger
      const delta = -e.translationX / width;
      const newRatio = Math.min(
        MAX_CART_RATIO,
        Math.max(MIN_CART_RATIO, dragStartRatio.value + delta)
      );
      cartRatio.value = newRatio;
    })
    .onEnd(() => {
      isDragging.value = false;
      // Snap with a nice spring
      cartRatio.value = withSpring(cartRatio.value, {
        damping: 20,
        stiffness: 200,
      });
    });

  // Double-tap to reset to default size
  const resetGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onStart(() => {
      cartRatio.value = withSpring(DEFAULT_CART_RATIO, {
        damping: 15,
        stiffness: 150,
      });
      runOnJS(triggerHaptic)();
    });

  const resizeGesture = Gesture.Race(resizePanGesture, resetGesture);

  // Animated styles for sections
  const productsAnimatedStyle = useAnimatedStyle(() => ({
    flex: 1 - cartRatio.value,
  }));

  const cartAnimatedStyle = useAnimatedStyle(() => ({
    flex: cartRatio.value,
  }));

  const handleAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: isDragging.value
      ? 'rgba(129, 140, 248, 0.2)'
      : 'transparent',
  }));

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
          <CurrentDateBadge />
          <SyncIndicator />

          <Pressable onPress={handleLogout} style={styles.logoutBtn}>
            <MaterialCommunityIcons name="logout" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* Main Content - Split View */}
      <View style={[styles.mainContent, isCompact && styles.mainContentCompact]}>
        {/* Left: Products */}
        <Animated.View style={[isCompact ? styles.productsSectionCompact : productsAnimatedStyle, { minHeight: 0 }]}>
          {debtSummary.count > 0 && (
            <Pressable
              onPress={() => router.push('/invoices')}
              style={[styles.debtAlert, { backgroundColor: 'rgba(245, 158, 11, 0.12)', borderColor: colors.warning }]}
            >
              <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.warning} />
              <Text style={[styles.debtAlertText, { color: colors.warning }]}>
                {debtSummary.count} فواتير جزئية - متبقي {formatCurrency(debtSummary.totalDue, settings.currency)}
              </Text>
              <MaterialCommunityIcons name="chevron-left" size={18} color={colors.warning} />
            </Pressable>
          )}
          <View style={[styles.quickItemBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <Pressable
              onPress={() => setShowQuickItem(true)}
              style={[styles.quickItemBtn, { backgroundColor: 'rgba(251, 191, 36, 0.15)', borderColor: colors.warning }]}
            >
              <MaterialCommunityIcons name="lightning-bolt" size={18} color={colors.warning} />
              <Text style={[styles.quickItemBtnText, { color: colors.warning }]}>صنف سريع</Text>
            </Pressable>
            <Text style={[styles.quickItemHint, { color: colors.textMuted }]}>
              صنف مش موجود في المخزون؟ ضيفه للفاتورة بسرعة
            </Text>
          </View>
          <CategoryBar
            categories={categories}
            selectedId={selectedCategory}
            onSelect={setSelectedCategory}
          />
          <View style={styles.productGridWrapper}>
            <ProductGrid
              products={products}
              categories={categories}
              onProductPress={handleProductPress}
            />
          </View>
        </Animated.View>

        {/* Resize Handle (desktop/tablet only) */}
        {!isCompact && (
          <GestureDetector gesture={resizeGesture}>
            <Animated.View style={[styles.resizeHandle, handleAnimatedStyle, { borderColor: colors.border }]}>
              <View style={styles.resizeHandleDots}>
                <View style={[styles.resizeHandleDot, { backgroundColor: colors.textMuted }]} />
                <View style={[styles.resizeHandleDot, { backgroundColor: colors.textMuted }]} />
                <View style={[styles.resizeHandleDot, { backgroundColor: colors.textMuted }]} />
              </View>
            </Animated.View>
          </GestureDetector>
        )}

        {/* Right: Cart */}
        <Animated.View style={[isCompact ? styles.cartSectionCompact : cartAnimatedStyle, { borderColor: colors.border, borderLeftWidth: isCompact ? 0 : 0, borderTopWidth: isCompact ? 1 : 0 }]}>
          <CartPanel onCheckout={handleOpenCheckout} />
        </Animated.View>
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
            style={[
              styles.checkoutModal,
              {
                backgroundColor: colors.surface,
                width: Math.min(width - Spacing.base * 2, isCompact ? 360 : 420),
              },
            ]}
          >
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
                  الإجمالي المحسوب
                </Text>
                <Text style={[styles.totalBoxValue, { color: colors.primary }]}>
                  {formatCurrency(cart.total, settings.currency)}
                </Text>
              </View>

              {/* Editable Final Total Input */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  الإجمالي النهائي
                </Text>
                <TextInput
                  style={[
                    styles.amountInput,
                    {
                      backgroundColor: colors.surfaceLight,
                      borderColor: hasPriceAdjustment ? colors.warning : colors.borderFocused,
                      color: colors.text,
                    },
                  ]}
                  value={finalTotalAmount}
                  onChangeText={handleFinalTotalChange}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  selectTextOnFocus
                />
                {hasPriceAdjustment && (
                  <Text style={[styles.adjustmentHint, { color: priceAdjustment < 0 ? colors.accent : colors.warning }]}>
                    {priceAdjustment < 0 ? 'خصم' : 'زيادة'}: {formatCurrency(Math.abs(priceAdjustment), settings.currency)}
                  </Text>
                )}
              </View>

              {/* Invoice Name Input */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  اسم الفاتورة
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: colors.surfaceLight,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={invoiceName}
                  onChangeText={setInvoiceName}
                  placeholder="مثال: عميل المحل / طلب مخصوص"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              {/* Paid Amount Input */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  المبلغ المستلم
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
                {[finalTotalNum, Math.ceil(finalTotalNum / 10) * 10, Math.ceil(finalTotalNum / 50) * 50, Math.ceil(finalTotalNum / 100) * 100].filter((v, i, a) => v > 0 && a.indexOf(v) === i).map((amount) => (
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
            </ScrollView>
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

      <QuickCustomItemModal
        visible={showQuickItem}
        onClose={() => setShowQuickItem(false)}
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
    gap: Spacing.sm,
    flexWrap: 'wrap',
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
    flexWrap: 'wrap',
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
    minHeight: 0,
  },
  mainContentCompact: {
    flexDirection: 'column',
  },
  productsSection: {
    flex: 0.62,
    minHeight: 0,
  },
  productsSectionCompact: {
    flex: 1,
    minHeight: 320,
  },
  quickItemBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    flexWrap: 'wrap',
  },
  debtAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  debtAlertText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    fontWeight: '800',
  },
  quickItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  quickItemBtnText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
  },
  quickItemHint: {
    flex: 1,
    fontSize: Typography.fontSize.xs,
    minWidth: 180,
  },
  productGridWrapper: {
    flex: 1,
    minHeight: 0,
  },
  cartSection: {
    flex: 0.38,
  },
  cartSectionCompact: {
    flex: 0,
    height: 320,
    borderTopWidth: 1,
  },
  // Resize Handle
  resizeHandle: {
    width: 12,
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'col-resize' as any,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    zIndex: 10,
  },
  resizeHandleDots: {
    gap: 4,
    alignItems: 'center',
  },
  resizeHandleDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    opacity: 0.6,
  },
  // Checkout Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkoutModal: {
    maxHeight: '88%',
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
  textInput: {
    fontSize: Typography.fontSize.base,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  adjustmentHint: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    marginTop: Spacing.xs,
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
