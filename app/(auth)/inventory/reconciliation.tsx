// ============================================================
// Inventory Reconciliation Screen
// ============================================================

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAllProducts, reconcileProductStock } from '../../../src/services/inventoryService';
import { useAuthStore } from '../../../src/stores/authStore';
import { useSettingsStore } from '../../../src/stores/settingsStore';
import { Colors, Typography, Spacing, BorderRadius } from '../../../src/constants/theme';
import type { Product } from '../../../src/types';

export default function ReconciliationScreen() {
  const insets = useSafeAreaInsets();
  const darkMode = useSettingsStore((s) => s.settings.dark_mode);
  const colors = darkMode ? Colors.dark : Colors.light;
  const user = useAuthStore((s) => s.user);
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const loadProducts = useCallback(async () => {
    const rows = await getAllProducts();
    setProducts(rows);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [loadProducts])
  );

  const filtered = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return products;
    return products.filter((product) => product.name.includes(trimmed));
  }, [products, query]);

  const chooseProduct = (product: Product) => {
    setSelected(product);
    setQuantity(String(product.quantity));
    setNote('');
  };

  const saveReconciliation = async () => {
    if (!selected) {
      Alert.alert('اختار صنف', 'حدد الصنف اللي عايز تسويه الأول.');
      return;
    }

    const nextQuantity = parseInt(quantity, 10);
    if (!Number.isFinite(nextQuantity) || nextQuantity < 0) {
      Alert.alert('كمية غير صحيحة', 'اكتب كمية فعلية صحيحة.');
      return;
    }

    setSaving(true);
    try {
      await reconcileProductStock(selected.id, nextQuantity, note, user?.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSelected(null);
      setQuantity('');
      setNote('');
      await loadProducts();
      Alert.alert('تمت التسوية', 'تم تعديل المخزون وتسجيل العملية في سجل التدقيق.');
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('خطأ', 'تعذر حفظ التسوية.');
    } finally {
      setSaving(false);
    }
  };

  const delta = selected ? (parseInt(quantity, 10) || 0) - selected.quantity : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-right" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>تسوية المخزون</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>قارن الكمية الفعلية وسجل الفرق</Text>
        </View>
      </View>

      <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            value={query}
            onChangeText={setQuery}
            placeholder="بحث عن صنف..."
            placeholderTextColor={colors.textMuted}
          />
        </View>

        {selected && (
          <View style={[styles.reconcileBox, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}>
            <Text style={[styles.selectedName, { color: colors.text }]}>{selected.name}</Text>
            <View style={styles.qtyRow}>
              <View style={styles.qtyItem}>
                <Text style={[styles.label, { color: colors.textMuted }]}>المسجل</Text>
                <Text style={[styles.currentQty, { color: colors.text }]}>{selected.quantity}</Text>
              </View>
              <View style={styles.qtyItem}>
                <Text style={[styles.label, { color: colors.textMuted }]}>الفعلي</Text>
                <TextInput
                  style={[styles.qtyInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="number-pad"
                  textAlign="center"
                />
              </View>
              <View style={styles.qtyItem}>
                <Text style={[styles.label, { color: colors.textMuted }]}>الفرق</Text>
                <Text style={[styles.deltaText, { color: delta < 0 ? colors.danger : delta > 0 ? colors.accent : colors.textMuted }]}>
                  {delta > 0 ? `+${delta}` : delta}
                </Text>
              </View>
            </View>
            <TextInput
              style={[styles.noteInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              value={note}
              onChangeText={setNote}
              placeholder="سبب التسوية"
              placeholderTextColor={colors.textMuted}
            />
            <Pressable
              onPress={saveReconciliation}
              disabled={saving}
              style={[styles.saveButton, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}
            >
              <MaterialCommunityIcons name="content-save-outline" size={18} color="#fff" />
              <Text style={styles.saveButtonText}>{saving ? 'جاري الحفظ' : 'حفظ التسوية'}</Text>
            </Pressable>
          </View>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => chooseProduct(item)}
            style={[
              styles.productRow,
              {
                backgroundColor: selected?.id === item.id ? colors.primaryGlow : colors.surface,
                borderColor: selected?.id === item.id ? colors.primary : colors.border,
              },
            ]}
          >
            <View style={styles.productInfo}>
              <Text style={[styles.productName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
              <Text style={[styles.productMeta, { color: colors.textMuted }]}>حد أدنى {item.min_quantity}</Text>
            </View>
            <Text style={[styles.stock, { color: item.quantity <= item.min_quantity ? colors.warning : colors.accent }]}>
              {item.quantity}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  backButton: { padding: Spacing.xs },
  headerText: { flex: 1 },
  headerTitle: { fontSize: Typography.fontSize.lg, fontWeight: '800' },
  headerSubtitle: { fontSize: Typography.fontSize.xs, marginTop: 2 },
  panel: { margin: Spacing.base, borderWidth: 1, borderRadius: BorderRadius.xl, padding: Spacing.md, gap: Spacing.md },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md },
  searchInput: { flex: 1, paddingVertical: Spacing.sm, fontSize: Typography.fontSize.sm, marginLeft: Spacing.sm },
  reconcileBox: { borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.md },
  selectedName: { fontSize: Typography.fontSize.base, fontWeight: '800' },
  qtyRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  qtyItem: { flex: 1, minWidth: 90, alignItems: 'center', gap: Spacing.xs },
  label: { fontSize: Typography.fontSize.xs, fontWeight: '700' },
  currentQty: { fontSize: Typography.fontSize.xl, fontWeight: '800' },
  qtyInput: { minWidth: 92, borderWidth: 1, borderRadius: BorderRadius.md, paddingVertical: Spacing.sm, fontSize: Typography.fontSize.lg, fontWeight: '800' },
  deltaText: { fontSize: Typography.fontSize.xl, fontWeight: '800' },
  noteInput: { borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: Typography.fontSize.sm },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, borderRadius: BorderRadius.md, padding: Spacing.md },
  saveButtonText: { color: '#fff', fontSize: Typography.fontSize.sm, fontWeight: '800' },
  list: { padding: Spacing.base, paddingTop: 0, gap: Spacing.sm },
  productRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.md },
  productInfo: { flex: 1, minWidth: 0 },
  productName: { fontSize: Typography.fontSize.sm, fontWeight: '800' },
  productMeta: { fontSize: Typography.fontSize.xs, marginTop: 2 },
  stock: { fontSize: Typography.fontSize.lg, fontWeight: '900' },
});
