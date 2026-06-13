// ============================================================
// Inventory Screen - Products list with management
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
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
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import {
  getAllProducts,
  getAllCategories,
  createProduct,
  updateProduct,
  deleteProduct,
  createCategory,
  deleteCategory,
} from '../../../src/services/inventoryService';
import { useSettingsStore } from '../../../src/stores/settingsStore';
import { formatCurrency } from '../../../src/utils/formatters';
import { Colors, Gradients, Typography, Spacing, BorderRadius, CategoryColors } from '../../../src/constants/theme';
import type { Product, Category } from '../../../src/types';

const { width } = Dimensions.get('window');
const isTablet = width >= 768;

export default function InventoryScreen() {
  const insets = useSafeAreaInsets();
  const darkMode = useSettingsStore((s) => s.settings.dark_mode);
  const colors = darkMode ? Colors.dark : Colors.light;
  const currency = useSettingsStore((s) => s.settings.currency);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Product form state
  const [prodName, setProdName] = useState('');
  const [prodCatId, setProdCatId] = useState('');
  const [prodCost, setProdCost] = useState('');
  const [prodSell, setProdSell] = useState('');
  const [prodQty, setProdQty] = useState('');
  const [prodMinQty, setProdMinQty] = useState('5');

  // Category form state
  const [catName, setCatName] = useState('');
  const [catColor, setCatColor] = useState<string>(CategoryColors[0]);

  // Reload data whenever the screen gains focus so categories/products stay
  // in sync with changes made elsewhere (or pulled in by a background sync).
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  useEffect(() => {
    loadProducts();
  }, [selectedCategory]);

  const loadData = async () => {
    await loadCategories();
    await loadProducts();
  };

  const loadCategories = async () => {
    const cats = await getAllCategories();
    setCategories(cats);
  };

  const loadProducts = async () => {
    const prods = await getAllProducts(selectedCategory || undefined);
    setProducts(prods);
  };

  const filteredProducts = searchQuery
    ? products.filter((p) => p.name.includes(searchQuery))
    : products;

  // === Product Modal ===
  const openAddProduct = () => {
    setEditingProduct(null);
    setProdName('');
    setProdCatId(categories[0]?.id || '');
    setProdCost('');
    setProdSell('');
    setProdQty('');
    setProdMinQty('5');
    setShowProductModal(true);
  };

  const openEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProdName(product.name);
    setProdCatId(product.category_id);
    setProdCost(product.cost_price.toString());
    setProdSell(product.sell_price.toString());
    setProdQty(product.quantity.toString());
    setProdMinQty(product.min_quantity.toString());
    setShowProductModal(true);
  };

  const handleSaveProduct = async () => {
    if (!prodName.trim() || !prodCatId) {
      Alert.alert('خطأ', 'يجب إدخال اسم المنتج واختيار القسم');
      return;
    }

    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, {
          name: prodName.trim(),
          category_id: prodCatId,
          cost_price: parseFloat(prodCost) || 0,
          sell_price: parseFloat(prodSell) || 0,
          quantity: parseInt(prodQty) || 0,
          min_quantity: parseInt(prodMinQty) || 5,
        });
      } else {
        await createProduct({
          name: prodName.trim(),
          category_id: prodCatId,
          cost_price: parseFloat(prodCost) || 0,
          sell_price: parseFloat(prodSell) || 0,
          quantity: parseInt(prodQty) || 0,
          min_quantity: parseInt(prodMinQty) || 5,
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowProductModal(false);
      await loadProducts();
    } catch (error) {
      Alert.alert('خطأ', 'حدث خطأ أثناء حفظ المنتج');
    }
  };

  const handleDeleteProduct = (product: Product) => {
    Alert.alert('حذف المنتج', `هل تريد حذف "${product.name}"؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          await deleteProduct(product.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await loadProducts();
        },
      },
    ]);
  };

  // === Category Modal ===
  const handleSaveCategory = async () => {
    if (!catName.trim()) {
      Alert.alert('خطأ', 'يجب إدخال اسم القسم');
      return;
    }
    try {
      await createCategory(catName.trim(), 'folder', catColor);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowCategoryModal(false);
      setCatName('');
      await loadCategories();
    } catch (error) {
      Alert.alert('خطأ', 'حدث خطأ أثناء حفظ القسم');
    }
  };

  const getCategoryName = (catId: string) => {
    return categories.find((c) => c.id === catId)?.name || '';
  };

  const renderProduct = ({ item, index }: { item: Product; index: number }) => {
    const isLowStock = item.quantity <= item.min_quantity;
    const profit = item.sell_price - item.cost_price;
    const profitPercent = item.cost_price > 0 ? (profit / item.cost_price) * 100 : 0;

    return (
      <Animated.View entering={FadeInDown.duration(250).delay(index * 40)}>
        <Pressable
          onPress={() => openEditProduct(item)}
          onLongPress={() => handleDeleteProduct(item)}
          style={[styles.productRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={[styles.productIcon, { backgroundColor: colors.primaryGlow }]}>
            <MaterialCommunityIcons name="package-variant-closed" size={22} color={colors.primary} />
          </View>

          <View style={styles.productInfo}>
            <Text style={[styles.prodName, { color: colors.text }]}>{item.name}</Text>
            <Text style={[styles.prodCategory, { color: colors.textMuted }]}>
              {getCategoryName(item.category_id)}
            </Text>
          </View>

          <View style={styles.productPrices}>
            <Text style={[styles.sellPrice, { color: colors.primary }]}>
              {formatCurrency(item.sell_price, currency)}
            </Text>
            <Text style={[styles.costPrice, { color: colors.textMuted }]}>
              تكلفة: {formatCurrency(item.cost_price, currency)}
            </Text>
          </View>

          <View style={styles.productMeta}>
            <Text style={[styles.profitText, { color: colors.accent }]}>
              +{profitPercent.toFixed(0)}%
            </Text>
            <View style={[
              styles.stockChip,
              { backgroundColor: isLowStock ? colors.dangerGlow : colors.accentGlow }
            ]}>
              <Text style={[styles.stockChipText, { color: isLowStock ? colors.danger : colors.accent }]}>
                {item.quantity}
              </Text>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>إدارة المخزون</Text>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => setShowCategoryModal(true)}
            style={[styles.headerBtn, { backgroundColor: colors.surfaceLight }]}
          >
            <MaterialCommunityIcons name="folder-plus" size={18} color={colors.secondary} />
            <Text style={[styles.headerBtnText, { color: colors.secondary }]}>قسم</Text>
          </Pressable>
          <Pressable onPress={openAddProduct}>
            <LinearGradient
              colors={Gradients.primary as unknown as readonly [string, string, ...string[]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.addBtn}
            >
              <MaterialCommunityIcons name="plus" size={18} color="#fff" />
              <Text style={styles.addBtnText}>منتج جديد</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>

      {/* Search + Category Filter */}
      <View style={styles.filterBar}>
        <View style={[styles.searchBox, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="بحث عن منتج..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catFilter}>
          <Pressable
            onPress={() => setSelectedCategory(null)}
            style={[styles.catChip, {
              backgroundColor: !selectedCategory ? colors.primary : colors.surfaceLight,
              borderColor: !selectedCategory ? colors.primary : colors.border,
            }]}
          >
            <Text style={[styles.catChipText, { color: !selectedCategory ? '#fff' : colors.textSecondary }]}>
              الكل ({products.length})
            </Text>
          </Pressable>
          {categories.map((cat) => (
            <Pressable
              key={cat.id}
              onPress={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
              onLongPress={() => {
                Alert.alert('حذف القسم', `هل تريد حذف "${cat.name}"؟`, [
                  { text: 'إلغاء', style: 'cancel' },
                  {
                    text: 'حذف',
                    style: 'destructive',
                    onPress: async () => {
                      await deleteCategory(cat.id);
                      await loadData();
                    },
                  },
                ]);
              }}
              style={[styles.catChip, {
                backgroundColor: selectedCategory === cat.id ? cat.color : colors.surfaceLight,
                borderColor: selectedCategory === cat.id ? cat.color : colors.border,
              }]}
            >
              <Text style={[styles.catChipText, {
                color: selectedCategory === cat.id ? '#fff' : colors.text,
              }]}>
                {cat.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Products List */}
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        renderItem={renderProduct}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="package-variant" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>لا توجد منتجات</Text>
          </View>
        }
      />

      {/* Product Modal */}
      <Modal visible={showProductModal} transparent animationType="fade" onRequestClose={() => setShowProductModal(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <Animated.View entering={SlideInDown.duration(300)} style={[styles.modal, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingProduct ? 'تعديل المنتج' : 'منتج جديد'}
              </Text>
              <Pressable onPress={() => setShowProductModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Name */}
              <Text style={[styles.label, { color: colors.textSecondary }]}>اسم المنتج</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surfaceLight, borderColor: colors.border, color: colors.text }]}
                value={prodName}
                onChangeText={setProdName}
                placeholder="مثال: مارلبورو أحمر"
                placeholderTextColor={colors.textMuted}
              />

              {/* Category */}
              <Text style={[styles.label, { color: colors.textSecondary }]}>القسم</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catSelect}>
                {categories.map((cat) => (
                  <Pressable
                    key={cat.id}
                    onPress={() => setProdCatId(cat.id)}
                    style={[styles.catOption, {
                      backgroundColor: prodCatId === cat.id ? cat.color : colors.surfaceLight,
                      borderColor: prodCatId === cat.id ? cat.color : colors.border,
                    }]}
                  >
                    <Text style={[styles.catOptionText, { color: prodCatId === cat.id ? '#fff' : colors.text }]}>
                      {cat.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Prices row */}
              <View style={styles.row}>
                <View style={styles.halfField}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>سعر التكلفة</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surfaceLight, borderColor: colors.border, color: colors.text }]}
                    value={prodCost}
                    onChangeText={setProdCost}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View style={styles.halfField}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>سعر البيع</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surfaceLight, borderColor: colors.border, color: colors.text }]}
                    value={prodSell}
                    onChangeText={setProdSell}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              {/* Quantity row */}
              <View style={styles.row}>
                <View style={styles.halfField}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>الكمية</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surfaceLight, borderColor: colors.border, color: colors.text }]}
                    value={prodQty}
                    onChangeText={setProdQty}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View style={styles.halfField}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>الحد الأدنى</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surfaceLight, borderColor: colors.border, color: colors.text }]}
                    value={prodMinQty}
                    onChangeText={setProdMinQty}
                    keyboardType="number-pad"
                    placeholder="5"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              {/* Profit preview */}
              {prodCost && prodSell && (
                <View style={[styles.profitPreview, { backgroundColor: colors.accentGlow }]}>
                  <MaterialCommunityIcons name="trending-up" size={18} color={colors.accent} />
                  <Text style={[styles.profitPreviewText, { color: colors.accent }]}>
                    الربح: {formatCurrency((parseFloat(prodSell) || 0) - (parseFloat(prodCost) || 0), currency)} للقطعة
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Save Button */}
            <Pressable onPress={handleSaveProduct} style={{ marginTop: Spacing.base }}>
              <LinearGradient
                colors={Gradients.primary as unknown as readonly [string, string, ...string[]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveBtn}
              >
                <MaterialCommunityIcons name="check" size={20} color="#fff" />
                <Text style={styles.saveBtnText}>حفظ</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>

      {/* Category Modal */}
      <Modal visible={showCategoryModal} transparent animationType="fade" onRequestClose={() => setShowCategoryModal(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <Animated.View entering={SlideInDown.duration(300)} style={[styles.modal, styles.smallModal, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>قسم جديد</Text>
              <Pressable onPress={() => setShowCategoryModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>

            <Text style={[styles.label, { color: colors.textSecondary }]}>اسم القسم</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceLight, borderColor: colors.border, color: colors.text }]}
              value={catName}
              onChangeText={setCatName}
              placeholder="مثال: المشروبات"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>اللون</Text>
            <View style={styles.colorPicker}>
              {CategoryColors.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setCatColor(c)}
                  style={[
                    styles.colorOption,
                    { backgroundColor: c, borderColor: catColor === c ? '#fff' : 'transparent' },
                  ]}
                >
                  {catColor === c && <MaterialCommunityIcons name="check" size={16} color="#fff" />}
                </Pressable>
              ))}
            </View>

            <Pressable onPress={handleSaveCategory} style={{ marginTop: Spacing.lg }}>
              <LinearGradient
                colors={Gradients.primary as unknown as readonly [string, string, ...string[]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveBtn}
              >
                <Text style={styles.saveBtnText}>حفظ</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  addBtnText: { color: '#fff', fontSize: Typography.fontSize.sm, fontWeight: '600' },
  filterBar: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  searchInput: { flex: 1, paddingVertical: Spacing.sm, fontSize: Typography.fontSize.sm, marginLeft: Spacing.sm },
  catFilter: { gap: Spacing.sm, paddingBottom: Spacing.xs },
  catChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  catChipText: { fontSize: Typography.fontSize.xs, fontWeight: '600' },
  list: { padding: Spacing.base, gap: Spacing.sm },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  productIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: { flex: 1 },
  prodName: { fontSize: Typography.fontSize.sm, fontWeight: '600' },
  prodCategory: { fontSize: Typography.fontSize.xs, marginTop: 2 },
  productPrices: { alignItems: 'flex-end' },
  sellPrice: { fontSize: Typography.fontSize.sm, fontWeight: '700' },
  costPrice: { fontSize: Typography.fontSize.xs, marginTop: 2 },
  productMeta: { alignItems: 'center', gap: Spacing.xs },
  profitText: { fontSize: Typography.fontSize.xs, fontWeight: '700' },
  stockChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    minWidth: 28,
    alignItems: 'center',
  },
  stockChipText: { fontSize: Typography.fontSize.xs, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingVertical: Spacing['5xl'], gap: Spacing.md },
  emptyText: { fontSize: Typography.fontSize.base },
  // Modal styles
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modal: { width: isTablet ? 480 : 360, maxHeight: '85%', borderRadius: BorderRadius['2xl'], padding: Spacing.xl },
  smallModal: { maxHeight: '60%' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  modalTitle: { fontSize: Typography.fontSize.lg, fontWeight: '700' },
  label: { fontSize: Typography.fontSize.sm, fontWeight: '500', marginBottom: Spacing.xs, marginTop: Spacing.md },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: Typography.fontSize.base,
  },
  catSelect: { maxHeight: 40, marginTop: Spacing.xs },
  catOption: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginRight: Spacing.sm,
  },
  catOptionText: { fontSize: Typography.fontSize.sm, fontWeight: '600' },
  row: { flexDirection: 'row', gap: Spacing.md },
  halfField: { flex: 1 },
  profitPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  profitPreviewText: { fontSize: Typography.fontSize.sm, fontWeight: '600' },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  saveBtnText: { color: '#fff', fontSize: Typography.fontSize.base, fontWeight: '700' },
  colorPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
  },
});
