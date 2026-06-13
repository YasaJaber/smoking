// ============================================================
// Purchases Screen - Budget-based purchasing with inventory sync
// ============================================================

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Alert,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { CurrentDateBadge } from '../../../src/components/common/CurrentDateBadge';
import {
  getAllPurchases,
  getPurchaseWithItems,
  getTodayPurchase,
  createPurchase,
  addPurchaseItem,
  addBudget,
  deletePurchaseItem,
  closePurchase,
  reopenPurchase,
  deletePurchase,
} from '../../../src/services/purchaseService';
import {
  getAllProducts,
  getAllCategories,
} from '../../../src/services/inventoryService';
import { useSettingsStore } from '../../../src/stores/settingsStore';
import { useDateStore } from '../../../src/stores/dateStore';
import { formatCurrency, formatDate } from '../../../src/utils/formatters';
import { Colors, Gradients, Typography, Spacing, BorderRadius } from '../../../src/constants/theme';
import type { Purchase, PurchaseItem, Product, Category } from '../../../src/types';

export default function PurchasesScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isCompact = width < 768;
  const isShortScreen = height < 700;
  const modalWidth = Math.min(width - Spacing.base * 2, isCompact ? 380 : 500);
  const modalMaxHeight = height * 0.85;
  const darkMode = useSettingsStore((s) => s.settings.dark_mode);
  const colors = darkMode ? Colors.dark : Colors.light;
  const currency = useSettingsStore((s) => s.settings.currency);
  const selectedDateKey = useDateStore((s) => s.selectedDateKey);

  // Data state
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [activePurchase, setActivePurchase] = useState<Purchase | null>(null);
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Modal state
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Budget form
  const [budgetInput, setBudgetInput] = useState('');
  const [noteInput, setNoteInput] = useState('');

  // Top up form
  const [topUpInput, setTopUpInput] = useState('');

  // Add item form
  const [isNewProduct, setIsNewProduct] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemCategoryId, setItemCategoryId] = useState('');
  const [itemCostPrice, setItemCostPrice] = useState('');
  const [itemSellPrice, setItemSellPrice] = useState('');
  const [itemQuantity, setItemQuantity] = useState('1');
  const [productSearch, setProductSearch] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadInitialData();
    }, [selectedDateKey])
  );

  const loadInitialData = async () => {
    await loadInventoryData();
    // Try to load today's open purchase automatically
    const todayPurchase = await getTodayPurchase();
    if (todayPurchase) {
      await loadPurchaseDetails(todayPurchase.id);
    } else {
      setActivePurchase(null);
      setPurchaseItems([]);
    }
    await loadPurchases();
  };

  const loadPurchases = async () => {
    const all = await getAllPurchases();
    setPurchases(all);
  };

  const loadInventoryData = async () => {
    const [prods, cats] = await Promise.all([
      getAllProducts(),
      getAllCategories(),
    ]);
    setProducts(prods);
    setCategories(cats);
  };

  const loadPurchaseDetails = async (purchaseId: string) => {
    const result = await getPurchaseWithItems(purchaseId);
    if (result) {
      setActivePurchase(result.purchase);
      setPurchaseItems(result.items);
    }
  };

  // =========== Create Today's Budget ===========
  const handleCreateBudget = async () => {
    const budget = parseFloat(budgetInput);
    if (!budget || budget <= 0) {
      Alert.alert('خطأ', 'يجب إدخال المبلغ');
      return;
    }

    try {
      const newPurchase = await createPurchase(budget, noteInput || undefined);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowBudgetModal(false);
      setBudgetInput('');
      setNoteInput('');
      setActivePurchase(newPurchase);
      setPurchaseItems([]);
      await loadPurchases();
    } catch (error) {
      console.error('Error creating purchase:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء إنشاء عملية الشراء');
    }
  };

  // =========== Top Up Budget ===========
  const handleTopUp = async () => {
    if (!activePurchase) return;
    const amount = parseFloat(topUpInput);
    if (!amount || amount <= 0) {
      Alert.alert('خطأ', 'يجب إدخال مبلغ صحيح');
      return;
    }

    try {
      const updated = await addBudget(activePurchase.id, amount);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowTopUpModal(false);
      setTopUpInput('');
      setActivePurchase(updated);
      await loadPurchases();
    } catch (error) {
      Alert.alert('خطأ', 'حدث خطأ أثناء إضافة المبلغ');
    }
  };

  // =========== Add Item ===========
  const openAddItem = () => {
    setIsNewProduct(false);
    setSelectedProductId(null);
    setItemName('');
    setItemCategoryId(categories[0]?.id || '');
    setItemCostPrice('');
    setItemSellPrice('');
    setItemQuantity('1');
    setProductSearch('');
    setShowAddItemModal(true);
  };

  const selectProduct = (product: Product) => {
    setSelectedProductId(product.id);
    setItemName(product.name);
    setItemCategoryId(product.category_id);
    setItemCostPrice(product.cost_price.toString());
    setItemSellPrice(product.sell_price.toString());
    setIsNewProduct(false);
  };

  const switchToNewProduct = () => {
    setIsNewProduct(true);
    setSelectedProductId(null);
    setItemName('');
    setItemCostPrice('');
    setItemSellPrice('');
    setItemCategoryId(categories[0]?.id || '');
  };

  const handleAddItem = async () => {
    if (!activePurchase) return;

    if (!itemName.trim()) {
      Alert.alert('خطأ', 'يجب إدخال اسم الصنف');
      return;
    }
    if (!itemCategoryId) {
      Alert.alert('خطأ', 'يجب اختيار القسم');
      return;
    }

    const costPrice = parseFloat(itemCostPrice) || 0;
    const sellPrice = parseFloat(itemSellPrice) || 0;
    const quantity = parseInt(itemQuantity) || 1;

    if (costPrice <= 0) {
      Alert.alert('خطأ', 'يجب إدخال سعر الشراء');
      return;
    }

    const totalCost = costPrice * quantity;
    if (totalCost > activePurchase.remaining) {
      Alert.alert(
        'المبلغ غير كافي',
        `التكلفة ${formatCurrency(totalCost, currency)} أكبر من المتبقي ${formatCurrency(activePurchase.remaining, currency)}\n\nيمكنك إضافة مبلغ جديد من زرار "إضافة مبلغ".`
      );
      return;
    }

    try {
      await addPurchaseItem(activePurchase.id, {
        product_id: isNewProduct ? null : selectedProductId,
        product_name: itemName.trim(),
        category_id: itemCategoryId,
        cost_price: costPrice,
        sell_price: sellPrice,
        quantity,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowAddItemModal(false);
      await loadPurchaseDetails(activePurchase.id);
      await loadInventoryData();
      await loadPurchases();
    } catch (error: any) {
      if (error?.message === 'INSUFFICIENT_BUDGET') {
        Alert.alert('خطأ', 'المبلغ غير كافي لإضافة هذا الصنف');
      } else {
        console.error('Error adding item:', error);
        Alert.alert('خطأ', 'حدث خطأ أثناء إضافة الصنف');
      }
    }
  };

  // =========== Delete Item ===========
  const handleDeleteItem = (item: PurchaseItem) => {
    Alert.alert('حذف الصنف', `هل تريد حذف "${item.product_name}"?\nسيتم إرجاع المبلغ وخصم الكمية من المخزون.`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePurchaseItem(item.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await loadPurchaseDetails(activePurchase!.id);
            await loadInventoryData();
            await loadPurchases();
          } catch (error) {
            Alert.alert('خطأ', 'حدث خطأ أثناء حذف الصنف');
          }
        },
      },
    ]);
  };

  // =========== Close/Reopen ===========
  const handleToggleStatus = async () => {
    if (!activePurchase) return;

    if (activePurchase.status === 'open') {
      Alert.alert('إغلاق اليوم', 'بعد الإغلاق لن تتمكن من إضافة أصناف جديدة. هل تريد المتابعة?', [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'إغلاق',
          onPress: async () => {
            await closePurchase(activePurchase.id);
            await loadPurchaseDetails(activePurchase.id);
            await loadPurchases();
          },
        },
      ]);
    } else {
      await reopenPurchase(activePurchase.id);
      await loadPurchaseDetails(activePurchase.id);
      await loadPurchases();
    }
  };

  // =========== Delete Purchase ===========
  const handleDeletePurchase = () => {
    if (!activePurchase) return;

    Alert.alert(
      'حذف عملية الشراء',
      'سيتم حذف العملية بالكامل وخصم جميع الكميات من المخزون. هل أنت متأكد؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePurchase(activePurchase.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              setActivePurchase(null);
              setPurchaseItems([]);
              await loadPurchases();
            } catch (error) {
              Alert.alert('خطأ', 'حدث خطأ أثناء حذف العملية');
            }
          },
        },
      ]
    );
  };

  // =========== Open from history ===========
  const openFromHistory = async (purchase: Purchase) => {
    setShowHistoryModal(false);
    await loadPurchaseDetails(purchase.id);
  };

  const getCategoryName = (catId: string) => {
    return categories.find((c) => c.id === catId)?.name || '';
  };

  const filteredProducts = productSearch
    ? products.filter((p) => p.name.includes(productSearch))
    : products;

  const todayDateStr = new Date().toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // =============================================
  // RENDER
  // =============================================
  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          {activePurchase && (
            <Pressable onPress={() => { setActivePurchase(null); setPurchaseItems([]); }} style={styles.backBtn}>
              <MaterialCommunityIcons name="arrow-right" size={24} color={colors.text} />
            </Pressable>
          )}
          <Text style={[styles.headerTitle, { color: colors.text }]}>المشتريات</Text>
        </View>
        <CurrentDateBadge />
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => setShowHistoryModal(true)}
            style={[styles.headerBtn, { backgroundColor: colors.surfaceLight }]}
          >
            <MaterialCommunityIcons name="history" size={18} color={colors.textSecondary} />
            <Text style={[styles.headerBtnText, { color: colors.textSecondary }]}>السجل</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 20, flexGrow: 1 }}
      >
        {/* ============ No Active Purchase → Set Budget ============ */}
        {!activePurchase && (
          <Animated.View entering={FadeIn.duration(400)}>
            <View style={styles.noBudgetSection}>
              <LinearGradient
                colors={['#1e1b4b', '#312e81', '#3730a3'] as unknown as readonly [string, string, ...string[]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.noBudgetCard, isShortScreen && { padding: Spacing.xl }]}
              >
                <MaterialCommunityIcons name="wallet-plus-outline" size={isShortScreen ? 36 : 48} color="rgba(255,255,255,0.6)" />
                <Text style={styles.noBudgetTitle}>حدد مبلغ المشتريات</Text>
                <Text style={styles.noBudgetSubtitle}>
                  حط المبلغ اللي هتشتري بيه النهارده وابدأ أضف الأصناف
                </Text>
                <Pressable onPress={() => { setBudgetInput(''); setNoteInput(''); setShowBudgetModal(true); }}>
                  <View style={styles.setBudgetBtn}>
                    <MaterialCommunityIcons name="plus" size={20} color="#312e81" />
                    <Text style={styles.setBudgetBtnText}>إضافة مبلغ</Text>
                  </View>
                </Pressable>
              </LinearGradient>
            </View>
          </Animated.View>
        )}

        {/* ============ Active Purchase → Budget + Items ============ */}
        {activePurchase && (
          <>
            {/* Budget Card */}
            <Animated.View entering={FadeIn.duration(400)}>
              <LinearGradient
                colors={['#1e1b4b', '#312e81', '#3730a3'] as unknown as readonly [string, string, ...string[]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.budgetCard, isShortScreen && { padding: Spacing.base }]}
              >
                {activePurchase.note && (
                  <Text style={styles.budgetNote}>{activePurchase.note}</Text>
                )}

                {/* Main remaining amount */}
                <View style={styles.mainAmountSection}>
                  <Text style={styles.mainAmountLabel}>المتبقي</Text>
                  <Text style={styles.mainAmountValue}>
                    {formatCurrency(activePurchase.remaining, currency)}
                  </Text>
                </View>

                <View style={styles.budgetRow}>
                  <View style={styles.budgetItem}>
                    <Text style={styles.budgetLabel}>المبلغ الكلي</Text>
                    <Text style={styles.budgetValue}>{formatCurrency(activePurchase.budget, currency)}</Text>
                  </View>
                  <View style={styles.budgetDivider} />
                  <View style={styles.budgetItem}>
                    <Text style={styles.budgetLabel}>تم صرفه</Text>
                    <Text style={[styles.budgetValue, { color: '#fbbf24' }]}>
                      {formatCurrency(activePurchase.spent, currency)}
                    </Text>
                  </View>
                </View>

                {/* Progress bar */}
                {(() => {
                  const pct = activePurchase.budget > 0
                    ? (activePurchase.spent / activePurchase.budget) * 100
                    : 0;
                  return (
                    <>
                      <View style={styles.progressBarBg}>
                        <View
                          style={[
                            styles.progressBarFill,
                            {
                              width: `${Math.min(pct, 100)}%`,
                              backgroundColor: pct > 90 ? '#f87171' : pct > 70 ? '#fbbf24' : '#34d399',
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.progressLabel}>{pct.toFixed(0)}% مستخدم</Text>
                    </>
                  );
                })()}

                {/* Action buttons */}
                <View style={styles.budgetActions}>
                  {activePurchase.status === 'open' && (
                    <Pressable onPress={() => { setTopUpInput(''); setShowTopUpModal(true); }} style={styles.budgetActionBtn}>
                      <MaterialCommunityIcons name="cash-plus" size={18} color="#fff" />
                      <Text style={styles.budgetActionBtnText}>إضافة مبلغ</Text>
                    </Pressable>
                  )}
                  <Pressable onPress={handleToggleStatus} style={[styles.budgetActionBtn, {
                    backgroundColor: activePurchase.status === 'open' ? 'rgba(248,113,113,0.2)' : 'rgba(52,211,153,0.2)',
                  }]}>
                    <MaterialCommunityIcons
                      name={activePurchase.status === 'open' ? 'lock' : 'lock-open'}
                      size={16}
                      color={activePurchase.status === 'open' ? '#f87171' : '#34d399'}
                    />
                    <Text style={[styles.budgetActionBtnText, {
                      color: activePurchase.status === 'open' ? '#f87171' : '#34d399',
                    }]}>
                      {activePurchase.status === 'open' ? 'إغلاق' : 'إعادة فتح'}
                    </Text>
                  </Pressable>
                  <Pressable onPress={handleDeletePurchase} style={[styles.budgetActionBtn, { backgroundColor: 'rgba(248,113,113,0.15)' }]}>
                    <MaterialCommunityIcons name="delete-outline" size={16} color="#f87171" />
                  </Pressable>
                </View>
              </LinearGradient>
            </Animated.View>

            {/* Add Item Button */}
            {activePurchase.status === 'open' && (
              <Pressable onPress={openAddItem} style={{ marginHorizontal: Spacing.base, marginBottom: Spacing.sm }}>
                <LinearGradient
                  colors={Gradients.primary as unknown as readonly [string, string, ...string[]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.bigAddBtn}
                >
                  <MaterialCommunityIcons name="plus-circle" size={22} color="#fff" />
                  <Text style={styles.bigAddBtnText}>إضافة صنف للمشتريات</Text>
                </LinearGradient>
              </Pressable>
            )}

            {/* Items section header */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                الأصناف ({purchaseItems.length})
              </Text>
            </View>

            {/* Items List */}
            {purchaseItems.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="cart-outline" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>لم يتم إضافة أصناف بعد</Text>
                {activePurchase.status === 'open' && (
                  <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
                    اضغط "إضافة صنف" لبدء الشراء
                  </Text>
                )}
              </View>
            ) : (
              purchaseItems.map((item, index) => (
                <Animated.View key={item.id} entering={FadeInDown.duration(250).delay(Math.min(index, 10) * 40)}>
                  <Pressable
                    onLongPress={() => handleDeleteItem(item)}
                    style={[styles.itemRow, {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      marginHorizontal: Spacing.base,
                    }]}
                  >
                    <View style={[styles.itemIcon, { backgroundColor: colors.primaryGlow }]}>
                      <MaterialCommunityIcons name="package-variant-closed" size={20} color={colors.primary} />
                    </View>
                    <View style={styles.itemInfo}>
                      <Text style={[styles.itemName, { color: colors.text }]}>{item.product_name}</Text>
                      <Text style={[styles.itemCategory, { color: colors.textMuted }]}>
                        {getCategoryName(item.category_id)} • {item.quantity} قطعة
                      </Text>
                    </View>
                    <View style={styles.itemPrices}>
                      <Text style={[styles.itemTotalCost, { color: colors.warning }]}>
                        {formatCurrency(item.total_cost, currency)}
                      </Text>
                      <Text style={[styles.itemUnitCost, { color: colors.textMuted }]}>
                        {formatCurrency(item.cost_price, currency)}/قطعة
                      </Text>
                    </View>
                  </Pressable>
                </Animated.View>
              ))
            )}
            <View style={{ height: insets.bottom + 20 }} />
          </>
        )}
      </ScrollView>

      {/* ============ Set Budget Modal ============ */}
      <Modal
        visible={showBudgetModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBudgetModal(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <Animated.View entering={SlideInDown.duration(300)} style={[styles.modal, { width: modalWidth, maxHeight: modalMaxHeight * 0.6, backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>مبلغ المشتريات</Text>
              <Pressable onPress={() => setShowBudgetModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={[styles.modalDesc, { color: colors.textMuted }]}>
                حط المبلغ اللي هتشتري بيه والأصناف هتتخصم منه تلقائي
              </Text>

            <Text style={[styles.label, { color: colors.textSecondary }]}>المبلغ</Text>
            <TextInput
              style={[styles.input, styles.budgetInput, { backgroundColor: colors.surfaceLight, borderColor: colors.border, color: colors.text }]}
              value={budgetInput}
              onChangeText={setBudgetInput}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>ملاحظة (اختياري)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceLight, borderColor: colors.border, color: colors.text }]}
              value={noteInput}
              onChangeText={setNoteInput}
              placeholder="مثال: مشتريات الأسبوع"
              placeholderTextColor={colors.textMuted}
            />
            </ScrollView>

            <Pressable onPress={handleCreateBudget} style={{ marginTop: Spacing.xl }}>
              <LinearGradient
                colors={Gradients.primary as unknown as readonly [string, string, ...string[]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveBtn}
              >
                <MaterialCommunityIcons name="wallet-plus" size={20} color="#fff" />
                <Text style={styles.saveBtnText}>تأكيد المبلغ</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ============ Top Up Budget Modal ============ */}
      <Modal
        visible={showTopUpModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTopUpModal(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <Animated.View entering={SlideInDown.duration(300)} style={[styles.modal, { width: modalWidth, maxHeight: modalMaxHeight * 0.5, backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>إضافة مبلغ</Text>
              <Pressable onPress={() => setShowTopUpModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>

            <Text style={[styles.modalDesc, { color: colors.textMuted }]}>
              المبلغ الحالي: {activePurchase ? formatCurrency(activePurchase.budget, currency) : ''}
            </Text>

            <TextInput
              style={[styles.input, styles.budgetInput, { backgroundColor: colors.surfaceLight, borderColor: colors.border, color: colors.text }]}
              value={topUpInput}
              onChangeText={setTopUpInput}
              keyboardType="decimal-pad"
              placeholder="المبلغ الإضافي"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />

            <Pressable onPress={handleTopUp} style={{ marginTop: Spacing.lg }}>
              <LinearGradient
                colors={Gradients.accent as unknown as readonly [string, string, ...string[]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveBtn}
              >
                <MaterialCommunityIcons name="cash-plus" size={20} color="#fff" />
                <Text style={styles.saveBtnText}>إضافة</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ============ History Modal ============ */}
      <Modal
        visible={showHistoryModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHistoryModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <Animated.View entering={SlideInDown.duration(300)} style={[styles.modal, { width: modalWidth, maxHeight: modalMaxHeight * 0.75, backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>سجل المشتريات</Text>
              <Pressable onPress={() => setShowHistoryModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>

            <FlatList
              data={purchases}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const pct = item.budget > 0 ? (item.spent / item.budget) * 100 : 0;
                const isActive = activePurchase?.id === item.id;
                return (
                  <Pressable
                    onPress={() => openFromHistory(item)}
                    style={[styles.historyItem, {
                      backgroundColor: isActive ? colors.primaryGlow : colors.surfaceLight,
                      borderColor: isActive ? colors.primary : colors.border,
                    }]}
                  >
                    <View style={styles.historyItemHeader}>
                      <View style={[styles.historyIcon, {
                        backgroundColor: item.status === 'open' ? 'rgba(52,211,153,0.15)' : 'rgba(128,128,128,0.15)',
                      }]}>
                        <MaterialCommunityIcons
                          name={item.status === 'open' ? 'cart-arrow-down' : 'cart-check'}
                          size={18}
                          color={item.status === 'open' ? colors.accent : colors.textMuted}
                        />
                      </View>
                      <View style={styles.historyInfo}>
                        <Text style={[styles.historyBudget, { color: colors.text }]}>
                          {formatCurrency(item.budget, currency)}
                        </Text>
                        {item.note && (
                          <Text style={[styles.historyNote, { color: colors.textMuted }]} numberOfLines={1}>
                            {item.note}
                          </Text>
                        )}
                        <Text style={[styles.historyDate, { color: colors.textMuted }]}>
                          {formatDate(item.created_at)}
                        </Text>
                      </View>
                      <View style={[styles.statusBadgeSmall, {
                        backgroundColor: item.status === 'open' ? colors.accentGlow : colors.dangerGlow,
                      }]}>
                        <Text style={[styles.statusBadgeSmallText, {
                          color: item.status === 'open' ? colors.accent : colors.danger,
                        }]}>
                          {item.status === 'open' ? 'مفتوحة' : 'مغلقة'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.historyProgress}>
                      <View style={[styles.historyProgressFill, {
                        width: `${Math.min(pct, 100)}%`,
                        backgroundColor: pct > 90 ? colors.danger : pct > 70 ? colors.warning : colors.accent,
                      }]} />
                    </View>
                    <Text style={[styles.historySpent, { color: colors.textMuted }]}>
                      صرف {formatCurrency(item.spent, currency)} • متبقي {formatCurrency(item.remaining, currency)}
                    </Text>
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons name="history" size={40} color={colors.textMuted} />
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>لا يوجد سجل</Text>
                </View>
              }
              style={{ flexGrow: 0 }}
              contentContainerStyle={{ gap: Spacing.sm, paddingBottom: Spacing.md }}
            />
          </Animated.View>
        </View>
      </Modal>

      {/* ============ Add Item Modal ============ */}
      <Modal
        visible={showAddItemModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddItemModal(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <Animated.View entering={SlideInDown.duration(300)} style={[styles.modal, { width: modalWidth, maxHeight: modalMaxHeight, backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>إضافة صنف</Text>
              <Pressable onPress={() => setShowAddItemModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" bounces={true}>
              {/* Toggle: Existing / New */}
              <View style={styles.toggleRow}>
                <Pressable
                  onPress={() => { setIsNewProduct(false); setSelectedProductId(null); setItemName(''); setItemCostPrice(''); setItemSellPrice(''); setItemQuantity('1'); }}
                  style={[styles.toggleBtn, {
                    backgroundColor: !isNewProduct ? colors.primary : colors.surfaceLight,
                    borderColor: !isNewProduct ? colors.primary : colors.border,
                  }]}
                >
                  <MaterialCommunityIcons
                    name="magnify"
                    size={16}
                    color={!isNewProduct ? '#fff' : colors.textSecondary}
                  />
                  <Text style={[styles.toggleBtnText, { color: !isNewProduct ? '#fff' : colors.textSecondary }]}>
                    منتج موجود
                  </Text>
                </Pressable>
                <Pressable
                  onPress={switchToNewProduct}
                  style={[styles.toggleBtn, {
                    backgroundColor: isNewProduct ? colors.primary : colors.surfaceLight,
                    borderColor: isNewProduct ? colors.primary : colors.border,
                  }]}
                >
                  <MaterialCommunityIcons
                    name="plus-circle-outline"
                    size={16}
                    color={isNewProduct ? '#fff' : colors.textSecondary}
                  />
                  <Text style={[styles.toggleBtnText, { color: isNewProduct ? '#fff' : colors.textSecondary }]}>
                    منتج جديد
                  </Text>
                </Pressable>
              </View>

              {/* ===== EXISTING PRODUCT MODE ===== */}
              {!isNewProduct && !selectedProductId && (
                <>
                  <View style={[styles.searchBox, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}>
                    <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} />
                    <TextInput
                      style={[styles.searchInput, { color: colors.text }]}
                      placeholder="بحث عن منتج..."
                      placeholderTextColor={colors.textMuted}
                      value={productSearch}
                      onChangeText={setProductSearch}
                    />
                  </View>

                  <ScrollView style={styles.productList} nestedScrollEnabled>
                    {filteredProducts.slice(0, 20).map((product) => (
                      <Pressable
                        key={product.id}
                        onPress={() => selectProduct(product)}
                        style={[styles.productOption, {
                          backgroundColor: 'transparent',
                          borderColor: colors.border,
                        }]}
                      >
                        <View style={[styles.productOptionIcon, { backgroundColor: colors.primaryGlow }]}>
                          <MaterialCommunityIcons name="package-variant-closed" size={18} color={colors.primary} />
                        </View>
                        <View style={styles.productOptionInfo}>
                          <Text style={[styles.productOptionName, { color: colors.text }]}>{product.name}</Text>
                          <Text style={[styles.productOptionMeta, { color: colors.textMuted }]}>
                            {getCategoryName(product.category_id)} • المخزون: {product.quantity} • {formatCurrency(product.sell_price, currency)}
                          </Text>
                        </View>
                        <MaterialCommunityIcons name="chevron-left" size={20} color={colors.textMuted} />
                      </Pressable>
                    ))}
                    {filteredProducts.length === 0 && (
                      <View style={{ alignItems: 'center', paddingVertical: Spacing.xl }}>
                        <MaterialCommunityIcons name="magnify-close" size={32} color={colors.textMuted} />
                        <Text style={[{ color: colors.textMuted, fontSize: Typography.fontSize.sm, marginTop: Spacing.sm }]}>
                          لا توجد نتائج
                        </Text>
                      </View>
                    )}
                  </ScrollView>
                </>
              )}

              {/* ===== SELECTED PRODUCT CARD ===== */}
              {!isNewProduct && selectedProductId && (() => {
                const selectedProduct = products.find(p => p.id === selectedProductId);
                return (
                  <>
                    {/* Product Info Card */}
                    <View style={[styles.selectedProductCard, { backgroundColor: colors.primaryGlow, borderColor: colors.primary }]}>
                      <View style={styles.selectedProductHeader}>
                        <View style={[styles.selectedProductIcon, { backgroundColor: colors.surface }]}>
                          <MaterialCommunityIcons name="package-variant-closed" size={22} color={colors.primary} />
                        </View>
                        <View style={styles.selectedProductInfo}>
                          <Text style={[styles.selectedProductName, { color: colors.text }]}>{itemName}</Text>
                          <Text style={[styles.selectedProductMeta, { color: colors.textMuted }]}>
                            {getCategoryName(itemCategoryId)} • المخزون الحالي: {selectedProduct?.quantity ?? 0}
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => { setSelectedProductId(null); setItemName(''); setItemCostPrice(''); setItemSellPrice(''); setItemQuantity('1'); }}
                          style={[styles.changeProductBtn, { backgroundColor: colors.surface }]}
                        >
                          <MaterialCommunityIcons name="swap-horizontal" size={16} color={colors.primary} />
                          <Text style={[styles.changeProductBtnText, { color: colors.primary }]}>تغيير</Text>
                        </Pressable>
                      </View>
                    </View>

                    {/* Cost & Sell Price */}
                    <View style={styles.row}>
                      <View style={styles.halfField}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>سعر الشراء (التكلفة)</Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: colors.surfaceLight, borderColor: colors.border, color: colors.text }]}
                          value={itemCostPrice}
                          onChangeText={setItemCostPrice}
                          keyboardType="decimal-pad"
                          placeholder="0"
                          placeholderTextColor={colors.textMuted}
                        />
                      </View>
                      <View style={styles.halfField}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>سعر البيع</Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: colors.surfaceLight, borderColor: colors.border, color: colors.text }]}
                          value={itemSellPrice}
                          onChangeText={setItemSellPrice}
                          keyboardType="decimal-pad"
                          placeholder="0"
                          placeholderTextColor={colors.textMuted}
                        />
                      </View>
                    </View>

                    {/* Quantity */}
                    <Text style={[styles.label, { color: colors.textSecondary }]}>الكمية</Text>
                    <View style={styles.quantityRow}>
                      <Pressable
                        onPress={() => setItemQuantity(String(Math.max(1, (parseInt(itemQuantity) || 1) - 1)))}
                        style={[styles.qtyBtn, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}
                      >
                        <MaterialCommunityIcons name="minus" size={20} color={colors.text} />
                      </Pressable>
                      <TextInput
                        style={[styles.qtyInput, { backgroundColor: colors.surfaceLight, borderColor: colors.border, color: colors.text }]}
                        value={itemQuantity}
                        onChangeText={setItemQuantity}
                        keyboardType="number-pad"
                        textAlign="center"
                      />
                      <Pressable
                        onPress={() => setItemQuantity(String((parseInt(itemQuantity) || 0) + 1))}
                        style={[styles.qtyBtn, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}
                      >
                        <MaterialCommunityIcons name="plus" size={20} color={colors.text} />
                      </Pressable>
                    </View>

                    {/* Profit preview */}
                    {itemCostPrice && itemSellPrice && (
                      <View style={[styles.profitPreview, { backgroundColor: colors.accentGlow }]}>
                        <MaterialCommunityIcons name="trending-up" size={16} color={colors.accent} />
                        <Text style={[styles.profitPreviewText, { color: colors.accent }]}>
                          الربح: {formatCurrency((parseFloat(itemSellPrice) || 0) - (parseFloat(itemCostPrice) || 0), currency)} / قطعة
                        </Text>
                      </View>
                    )}

                    {/* Total Cost Preview */}
                    {itemCostPrice && activePurchase && (
                      <View style={[styles.totalPreview, { backgroundColor: 'rgba(251, 191, 36, 0.12)' }]}>
                        <View style={styles.totalPreviewRow}>
                          <MaterialCommunityIcons name="calculator" size={18} color="#fbbf24" />
                          <Text style={[styles.totalPreviewText, { color: '#fbbf24' }]}>
                            الإجمالي: {formatCurrency(
                              (parseFloat(itemCostPrice) || 0) * (parseInt(itemQuantity) || 1),
                              currency
                            )}
                          </Text>
                        </View>
                        <Text style={[styles.totalPreviewRemaining, { color: colors.textMuted }]}>
                          المتبقي بعد الشراء:{' '}
                          {formatCurrency(
                            activePurchase.remaining - (parseFloat(itemCostPrice) || 0) * (parseInt(itemQuantity) || 1),
                            currency
                          )}
                        </Text>
                      </View>
                    )}
                  </>
                );
              })()}

              {/* ===== NEW PRODUCT MODE ===== */}
              {isNewProduct && (
                <>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>اسم المنتج</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surfaceLight, borderColor: colors.border, color: colors.text }]}
                    value={itemName}
                    onChangeText={setItemName}
                    placeholder="اسم المنتج الجديد"
                    placeholderTextColor={colors.textMuted}
                  />

                  <Text style={[styles.label, { color: colors.textSecondary }]}>القسم</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catSelect}>
                    {categories.map((cat) => (
                      <Pressable
                        key={cat.id}
                        onPress={() => setItemCategoryId(cat.id)}
                        style={[styles.catOption, {
                          backgroundColor: itemCategoryId === cat.id ? cat.color : colors.surfaceLight,
                          borderColor: itemCategoryId === cat.id ? cat.color : colors.border,
                        }]}
                      >
                        <Text style={[styles.catOptionText, { color: itemCategoryId === cat.id ? '#fff' : colors.text }]}>
                          {cat.name}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  {/* Cost & Sell Price */}
                  <View style={styles.row}>
                    <View style={styles.halfField}>
                      <Text style={[styles.label, { color: colors.textSecondary }]}>سعر الشراء</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: colors.surfaceLight, borderColor: colors.border, color: colors.text }]}
                        value={itemCostPrice}
                        onChangeText={setItemCostPrice}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>
                    <View style={styles.halfField}>
                      <Text style={[styles.label, { color: colors.textSecondary }]}>سعر البيع</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: colors.surfaceLight, borderColor: colors.border, color: colors.text }]}
                        value={itemSellPrice}
                        onChangeText={setItemSellPrice}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>
                  </View>

                  {/* Quantity */}
                  <Text style={[styles.label, { color: colors.textSecondary }]}>الكمية</Text>
                  <View style={styles.quantityRow}>
                    <Pressable
                      onPress={() => setItemQuantity(String(Math.max(1, (parseInt(itemQuantity) || 1) - 1)))}
                      style={[styles.qtyBtn, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}
                    >
                      <MaterialCommunityIcons name="minus" size={20} color={colors.text} />
                    </Pressable>
                    <TextInput
                      style={[styles.qtyInput, { backgroundColor: colors.surfaceLight, borderColor: colors.border, color: colors.text }]}
                      value={itemQuantity}
                      onChangeText={setItemQuantity}
                      keyboardType="number-pad"
                      textAlign="center"
                    />
                    <Pressable
                      onPress={() => setItemQuantity(String((parseInt(itemQuantity) || 0) + 1))}
                      style={[styles.qtyBtn, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}
                    >
                      <MaterialCommunityIcons name="plus" size={20} color={colors.text} />
                    </Pressable>
                  </View>

                  {/* Total Cost Preview */}
                  {itemCostPrice && activePurchase && (
                    <View style={[styles.totalPreview, { backgroundColor: 'rgba(251, 191, 36, 0.12)' }]}>
                      <View style={styles.totalPreviewRow}>
                        <MaterialCommunityIcons name="calculator" size={18} color="#fbbf24" />
                        <Text style={[styles.totalPreviewText, { color: '#fbbf24' }]}>
                          الإجمالي: {formatCurrency(
                            (parseFloat(itemCostPrice) || 0) * (parseInt(itemQuantity) || 1),
                            currency
                          )}
                        </Text>
                      </View>
                      <Text style={[styles.totalPreviewRemaining, { color: colors.textMuted }]}>
                        المتبقي بعد الشراء:{' '}
                        {formatCurrency(
                          activePurchase.remaining - (parseFloat(itemCostPrice) || 0) * (parseInt(itemQuantity) || 1),
                          currency
                        )}
                      </Text>
                    </View>
                  )}
                </>
              )}
            </ScrollView>

            {/* Save Button */}
            <Pressable onPress={handleAddItem} style={{ marginTop: Spacing.base }}>
              <LinearGradient
                colors={Gradients.primary as unknown as readonly [string, string, ...string[]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveBtn}
              >
                <MaterialCommunityIcons name="check" size={20} color="#fff" />
                <Text style={styles.saveBtnText}>إضافة للمشتريات</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexShrink: 1,
  },
  headerTitle: { fontSize: Typography.fontSize.lg, fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: Spacing.sm },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  headerBtnText: { fontSize: Typography.fontSize.sm, fontWeight: '600' },
  backBtn: {
    padding: Spacing.xs,
  },

  // No budget state
  noBudgetSection: {
    padding: Spacing.base,
  },
  noBudgetCard: {
    borderRadius: BorderRadius['2xl'],
    padding: Spacing['2xl'],
    alignItems: 'center',
    gap: Spacing.md,
  },
  noBudgetTitle: {
    color: '#fff',
    fontSize: Typography.fontSize.xl,
    fontWeight: '700',
  },
  noBudgetSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: Typography.fontSize.sm,
    textAlign: 'center',
    lineHeight: 22,
  },
  setBudgetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#fff',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
  },
  setBudgetBtnText: {
    color: '#312e81',
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
  },

  // Budget card
  budgetCard: {
    margin: Spacing.base,
    borderRadius: BorderRadius['2xl'],
    padding: Spacing.xl,
  },
  budgetNote: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: Typography.fontSize.sm,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  mainAmountSection: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  mainAmountLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: Typography.fontSize.sm,
    fontWeight: '500',
    marginBottom: Spacing.xs,
  },
  mainAmountValue: {
    color: '#34d399',
    fontSize: Typography.fontSize['2xl'],
    fontWeight: '700',
  },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: Spacing.lg,
  },
  budgetItem: { alignItems: 'center', flex: 1 },
  budgetLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: Typography.fontSize.xs,
    fontWeight: '500',
    marginBottom: Spacing.xs,
  },
  budgetValue: {
    color: '#fff',
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
  },
  budgetDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: Typography.fontSize.xs,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  budgetActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  budgetActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  budgetActionBtnText: {
    color: '#fff',
    fontSize: Typography.fontSize.xs,
    fontWeight: '600',
  },

  // Big add button
  bigAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  bigAddBtnText: { color: '#fff', fontSize: Typography.fontSize.base, fontWeight: '700' },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  addBtnText: { color: '#fff', fontSize: Typography.fontSize.sm, fontWeight: '600' },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.base,
    fontWeight: '600',
  },

  // Item row
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: Typography.fontSize.sm, fontWeight: '600' },
  itemCategory: { fontSize: Typography.fontSize.xs, marginTop: 2 },
  itemPrices: { alignItems: 'flex-end' },
  itemTotalCost: { fontSize: Typography.fontSize.sm, fontWeight: '700' },
  itemUnitCost: { fontSize: Typography.fontSize.xs, marginTop: 2 },

  // History
  historyItem: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
  },
  historyItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  historyIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyInfo: { flex: 1 },
  historyBudget: { fontSize: Typography.fontSize.sm, fontWeight: '700' },
  historyNote: { fontSize: Typography.fontSize.xs, marginTop: 1 },
  historyDate: { fontSize: Typography.fontSize.xs, marginTop: 1 },
  historyProgress: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.15)',
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  historyProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  historySpent: { fontSize: Typography.fontSize.xs },
  statusBadgeSmall: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  statusBadgeSmallText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '600',
  },

  // Common
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing['5xl'],
    gap: Spacing.md,
  },
  emptyText: { fontSize: Typography.fontSize.base, fontWeight: '500' },
  emptySubtext: { fontSize: Typography.fontSize.sm },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modal: {
    maxWidth: '100%',
    borderRadius: BorderRadius['2xl'],
    padding: Spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  modalTitle: { fontSize: Typography.fontSize.lg, fontWeight: '700' },
  modalDesc: {
    fontSize: Typography.fontSize.sm,
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  label: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '500',
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: Typography.fontSize.base,
  },
  budgetInput: {
    fontSize: Typography.fontSize.xl,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: Spacing.base,
  },

  // Toggle buttons
  toggleRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  toggleBtnText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
  },

  // Product search/list
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.sm,
    fontSize: Typography.fontSize.sm,
    marginLeft: Spacing.sm,
  },
  productList: {
    maxHeight: 180,
    marginBottom: Spacing.sm,
  },
  productOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.xs,
  },
  productOptionInfo: { flex: 1 },
  productOptionName: { fontSize: Typography.fontSize.sm, fontWeight: '600' },
  productOptionMeta: { fontSize: Typography.fontSize.xs, marginTop: 2 },
  productOptionIcon: {
    width: 34,
    height: 34,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },

  // Selected product card
  selectedProductCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  selectedProductHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  selectedProductIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedProductInfo: { flex: 1 },
  selectedProductName: { fontSize: Typography.fontSize.base, fontWeight: '700' },
  selectedProductMeta: { fontSize: Typography.fontSize.xs, marginTop: 2 },
  changeProductBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  changeProductBtnText: { fontSize: Typography.fontSize.xs, fontWeight: '600' },

  // Profit preview
  profitPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  profitPreviewText: { fontSize: Typography.fontSize.xs, fontWeight: '600' },

  // Category select
  catSelect: { maxHeight: 40, marginTop: Spacing.xs },
  catOption: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginRight: Spacing.sm,
  },
  catOptionText: { fontSize: Typography.fontSize.sm, fontWeight: '600' },

  // Prices row
  row: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' },
  halfField: { flex: 1, minWidth: 120 },

  // Quantity
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  qtyBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    fontSize: Typography.fontSize.lg,
    fontWeight: '700',
  },

  // Total preview
  totalPreview: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  totalPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  totalPreviewText: { fontSize: Typography.fontSize.sm, fontWeight: '700' },
  totalPreviewRemaining: { fontSize: Typography.fontSize.xs },

  // Save button
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  saveBtnText: { color: '#fff', fontSize: Typography.fontSize.base, fontWeight: '700' },
});
