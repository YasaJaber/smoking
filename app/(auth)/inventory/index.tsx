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
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { CurrentDateBadge } from '../../../src/components/common/CurrentDateBadge';
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
import { Colors, Gradients, Typography, Spacing, BorderRadius } from '../../../src/constants/theme';
import {
  CATEGORY_EMOJI_GROUPS,
  DEFAULT_CATEGORY_EMOJI,
  getCategoryEmoji,
  getEmojiColor,
  normalizeCategoryEmoji,
} from '../../../src/constants/categoryEmojis';
import type { Product, Category } from '../../../src/types';

export default function InventoryScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 768;
  const modalWidth = Math.min(width - Spacing.base * 2, isCompact ? 360 : 480);
  const darkMode = useSettingsStore((s) => s.settings.dark_mode);
  const colors = darkMode ? Colors.dark : Colors.light;
  const currency = useSettingsStore((s) => s.settings.currency);
  const lowStockThreshold = useSettingsStore((s) => s.settings.low_stock_threshold);

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
  const [catEmoji, setCatEmoji] = useState(DEFAULT_CATEGORY_EMOJI);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeEmojiGroup, setActiveEmojiGroup] = useState<string>(CATEGORY_EMOJI_GROUPS[0].key);

  const selectedEmojiGroup =
    CATEGORY_EMOJI_GROUPS.find((group) => group.key === activeEmojiGroup) ||
    CATEGORY_EMOJI_GROUPS[0];

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
  const lowStockProducts = filteredProducts.filter((p) => p.quantity <= lowStockThreshold);

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
      console.error('Error saving product:', error);
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
  const openAddCategory = () => {
    setCatName('');
    setCatEmoji(DEFAULT_CATEGORY_EMOJI);
    setShowEmojiPicker(false);
    setActiveEmojiGroup(CATEGORY_EMOJI_GROUPS[0].key);
    setShowCategoryModal(true);
  };

  const handleSaveCategory = async () => {
    if (!catName.trim()) {
      Alert.alert('خطأ', 'يجب إدخال اسم القسم');
      return;
    }
    try {
      const emoji = normalizeCategoryEmoji(catEmoji);
      await createCategory(catName.trim(), emoji, getEmojiColor(emoji));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowCategoryModal(false);
      setCatName('');
      setCatEmoji(DEFAULT_CATEGORY_EMOJI);
      setShowEmojiPicker(false);
      await loadCategories();
    } catch (error) {
      Alert.alert('خطأ', 'حدث خطأ أثناء حفظ القسم');
    }
  };

  const getCategory = (catId: string) => {
    return categories.find((c) => c.id === catId) || null;
  };

  const getCategoryName = (catId: string) => {
    return getCategory(catId)?.name || '';
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const isLowStock = item.quantity <= item.min_quantity;
    const category = getCategory(item.category_id);

    return (
      <Pressable
          onPress={() => openEditProduct(item)}
          onLongPress={() => handleDeleteProduct(item)}
          style={[styles.productRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={[styles.productIcon, { backgroundColor: colors.primaryGlow }]}>
            <Text style={styles.productEmoji}>{getCategoryEmoji(category)}</Text>
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
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>إدارة المخزون</Text>
        <CurrentDateBadge />
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => router.push('/inventory/reconciliation')}
            style={[styles.headerBtn, { backgroundColor: colors.surfaceLight }]}
          >
            <MaterialCommunityIcons name="scale-balance" size={18} color={colors.warning} />
            <Text style={[styles.headerBtnText, { color: colors.warning }]}>تسوية</Text>
          </Pressable>
          <Pressable
            onPress={openAddCategory}
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
              <Text style={styles.catChipEmoji}>{getCategoryEmoji(cat)}</Text>
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
        ListFooterComponent={
          <View style={[styles.lowStockSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.lowStockHeader}>
              <View>
                <Text style={[styles.lowStockTitle, { color: colors.text }]}>المخزون المنخفض</Text>
                <Text style={[styles.lowStockSubtitle, { color: colors.textMuted }]}>
                  المنتجات التي كميتها أقل من أو تساوي {lowStockThreshold}
                </Text>
              </View>
              <View style={[styles.lowStockCountChip, { backgroundColor: colors.surfaceLight }]}>
                <Text style={[styles.lowStockCountText, { color: colors.warning }]}>
                  {lowStockProducts.length}
                </Text>
              </View>
            </View>

            {lowStockProducts.length > 0 ? (
              lowStockProducts.map((item, index) => (
                <View key={`low-stock-${item.id}`} style={index > 0 ? styles.lowStockItemSpacing : undefined}>
                  {renderProduct({ item })}
                </View>
              ))
            ) : (
              <View style={[styles.lowStockEmptyState, { backgroundColor: colors.surfaceLight }]}>
                <MaterialCommunityIcons name="check-circle-outline" size={20} color={colors.accent} />
                <Text style={[styles.lowStockEmptyText, { color: colors.textMuted }]}>
                  لا توجد منتجات ضمن المخزون المنخفض الآن
                </Text>
              </View>
            )}
          </View>
        }
      />

      {/* Product Modal */}
      <Modal visible={showProductModal} transparent animationType="fade" onRequestClose={() => setShowProductModal(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <Animated.View entering={SlideInDown.duration(300)} style={[styles.modal, { width: modalWidth, backgroundColor: colors.surface }]}>
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
                    <Text style={styles.catOptionEmoji}>{getCategoryEmoji(cat)}</Text>
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
                (() => {
                  const profit = (parseFloat(prodSell) || 0) - (parseFloat(prodCost) || 0);
                  const isLoss = profit < 0;
                  const label = isLoss ? 'الخسارة' : 'الربح';
                  const color = isLoss ? colors.danger : colors.accent;

                  return (
                    <View style={[styles.profitPreview, { backgroundColor: isLoss ? colors.dangerGlow : colors.accentGlow }]}>
                      <MaterialCommunityIcons name={isLoss ? 'trending-down' : 'trending-up'} size={18} color={color} />
                      <Text style={[styles.profitPreviewText, { color }]}>
                        {label}: {formatCurrency(Math.abs(profit), currency)} للقطعة
                      </Text>
                    </View>
                  );
                })()
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
          <Animated.View entering={SlideInDown.duration(300)} style={[styles.modal, styles.smallModal, { width: modalWidth, backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>قسم جديد</Text>
              <Pressable onPress={() => setShowCategoryModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={[styles.label, { color: colors.textSecondary }]}>اسم القسم</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surfaceLight, borderColor: colors.border, color: colors.text }]}
                value={catName}
                onChangeText={setCatName}
                placeholder="مثال: المشروبات"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>الإيموجي</Text>
              <View style={styles.emojiSelectRow}>
                <Pressable
                  onPress={() => setShowEmojiPicker((visible) => !visible)}
                  style={[
                    styles.emojiSelect,
                    { backgroundColor: colors.surfaceLight, borderColor: colors.border },
                  ]}
                >
                  <Text style={styles.selectedEmoji}>{catEmoji}</Text>
                  <MaterialCommunityIcons
                    name={showEmojiPicker ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </Pressable>
                <TextInput
                  style={[
                    styles.emojiInput,
                    { backgroundColor: colors.surfaceLight, borderColor: colors.border, color: colors.text },
                  ]}
                  value={catEmoji}
                  onChangeText={setCatEmoji}
                  placeholder="😀"
                  placeholderTextColor={colors.textMuted}
                  maxLength={8}
                />
              </View>

              {showEmojiPicker && (
                <View style={[styles.emojiPicker, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.emojiTabs}
                  >
                    {CATEGORY_EMOJI_GROUPS.map((group) => {
                      const isActive = group.key === activeEmojiGroup;
                      return (
                        <Pressable
                          key={group.key}
                          onPress={() => setActiveEmojiGroup(group.key)}
                          style={[
                            styles.emojiTab,
                            {
                              backgroundColor: isActive ? colors.primary : colors.surface,
                              borderColor: isActive ? colors.primary : colors.border,
                            },
                          ]}
                        >
                          <Text style={[styles.emojiTabText, { color: isActive ? '#fff' : colors.textSecondary }]}>
                            {group.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  <ScrollView style={styles.emojiGridScroll} showsVerticalScrollIndicator={false}>
                    <View style={styles.emojiGrid}>
                      {selectedEmojiGroup.emojis.map((emoji, emojiIndex) => {
                        const isSelected = catEmoji === emoji;
                        return (
                          <Pressable
                            key={`${selectedEmojiGroup.key}-${emoji}-${emojiIndex}`}
                            onPress={() => {
                              setCatEmoji(emoji);
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }}
                            style={[
                              styles.emojiOption,
                              {
                                backgroundColor: isSelected ? colors.primaryGlow : colors.surface,
                                borderColor: isSelected ? colors.primary : colors.border,
                              },
                            ]}
                          >
                            <Text style={styles.emojiOptionText}>{emoji}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>
              )}

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
            </ScrollView>
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
    gap: Spacing.md,
    flexWrap: 'wrap',
  },
  headerTitle: { fontSize: Typography.fontSize.lg, fontWeight: '700', flexShrink: 1 },
  headerActions: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  catChipText: { fontSize: Typography.fontSize.xs, fontWeight: '600' },
  list: { padding: Spacing.base, gap: Spacing.sm },
  lowStockSection: {
    marginTop: Spacing.lg,
    borderWidth: 1,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
  },
  lowStockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  lowStockTitle: {
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
  },
  lowStockSubtitle: {
    fontSize: Typography.fontSize.xs,
    marginTop: 2,
  },
  lowStockCountChip: {
    minWidth: 34,
    height: 34,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  lowStockCountText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
  },
  lowStockItemSpacing: {
    marginTop: Spacing.xs,
  },
  lowStockEmptyState: {
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  lowStockEmptyText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '500',
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.md,
    marginBottom: Spacing.sm,
    flexWrap: 'wrap',
  },
  productIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productEmoji: {
    fontSize: 24,
    lineHeight: 30,
  },
  productInfo: { flex: 1 },
  prodName: { fontSize: Typography.fontSize.sm, fontWeight: '600' },
  prodCategory: { fontSize: Typography.fontSize.xs, marginTop: 2 },
  productPrices: { alignItems: 'flex-end', minWidth: 96 },
  sellPrice: { fontSize: Typography.fontSize.sm, fontWeight: '700' },
  costPrice: { fontSize: Typography.fontSize.xs, marginTop: 2 },
  productMeta: { alignItems: 'center', gap: Spacing.xs },
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
  modal: { maxWidth: '100%', maxHeight: '85%', borderRadius: BorderRadius['2xl'], padding: Spacing.xl },
  smallModal: { maxHeight: '88%' },
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginRight: Spacing.sm,
    gap: Spacing.xs,
  },
  catChipEmoji: { fontSize: 14, lineHeight: 18 },
  catOptionEmoji: { fontSize: 14, lineHeight: 18 },
  catOptionText: { fontSize: Typography.fontSize.sm, fontWeight: '600' },
  row: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' },
  halfField: { flex: 1, minWidth: 120 },
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
  emojiSelectRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  emojiSelect: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedEmoji: {
    fontSize: 28,
    lineHeight: 34,
  },
  emojiInput: {
    width: 76,
    height: 48,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    textAlign: 'center',
    fontSize: Typography.fontSize.xl,
    paddingHorizontal: Spacing.xs,
  },
  emojiPicker: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
  },
  emojiTabs: {
    gap: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  emojiTab: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  emojiTabText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
  },
  emojiGridScroll: {
    maxHeight: 180,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  emojiOption: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiOptionText: {
    fontSize: 24,
    lineHeight: 30,
  },
});
