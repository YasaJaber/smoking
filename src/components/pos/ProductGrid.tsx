// ============================================================
// ProductGrid - Grid display of products for POS
// ============================================================

import React, { useCallback } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { useSettingsStore } from '../../stores/settingsStore';
import { formatCurrency } from '../../utils/formatters';
import type { Product } from '../../types';

const { width } = Dimensions.get('window');
const isTablet = width >= 768;
const NUM_COLUMNS = isTablet ? 4 : 3;

interface ProductGridProps {
  products: Product[];
  onProductPress: (product: Product) => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function ProductItem({ product, onPress, index }: {
  product: Product;
  onPress: (product: Product) => void;
  index: number;
}) {
  const darkMode = useSettingsStore((s) => s.settings.dark_mode);
  const colors = darkMode ? Colors.dark : Colors.light;
  const settings = useSettingsStore((s) => s.settings);
  const isLowStock = product.quantity <= product.min_quantity;
  const isOutOfStock = product.quantity === 0;

  const handlePress = useCallback(() => {
    if (isOutOfStock) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress(product);
  }, [product, isOutOfStock, onPress]);

  return (
    <AnimatedPressable
      entering={FadeInUp.duration(300).delay(index * 30)}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.productCard,
        {
          backgroundColor: colors.surfaceLight,
          borderColor: colors.border,
          opacity: isOutOfStock ? 0.5 : pressed ? 0.8 : 1,
          transform: [{ scale: pressed && !isOutOfStock ? 0.96 : 1 }],
        },
      ]}
    >
      {/* Product Icon */}
      <View style={[styles.productIcon, { backgroundColor: colors.glass }]}>
        <MaterialCommunityIcons
          name="package-variant-closed"
          size={28}
          color={colors.primary}
        />
      </View>

      {/* Product Name */}
      <Text
        style={[styles.productName, { color: colors.text }]}
        numberOfLines={2}
      >
        {product.name}
      </Text>

      {/* Price */}
      <Text style={[styles.productPrice, { color: colors.primary }]}>
        {formatCurrency(product.sell_price, settings.currency)}
      </Text>

      {/* Stock indicator */}
      <View style={styles.stockRow}>
        {isOutOfStock ? (
          <View style={[styles.stockBadge, { backgroundColor: colors.dangerGlow }]}>
            <Text style={[styles.stockText, { color: colors.danger }]}>نفد</Text>
          </View>
        ) : isLowStock ? (
          <View style={[styles.stockBadge, { backgroundColor: 'rgba(251,191,36,0.15)' }]}>
            <Text style={[styles.stockText, { color: colors.warning }]}>
              {product.quantity} متبقي
            </Text>
          </View>
        ) : (
          <Text style={[styles.stockNormal, { color: colors.textMuted }]}>
            المخزون: {product.quantity}
          </Text>
        )}
      </View>
    </AnimatedPressable>
  );
}

export function ProductGrid({ products, onProductPress }: ProductGridProps) {
  const darkMode = useSettingsStore((s) => s.settings.dark_mode);
  const colors = darkMode ? Colors.dark : Colors.light;

  if (products.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons name="package-variant" size={48} color={colors.textMuted} />
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          لا توجد منتجات في هذا القسم
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={products}
      keyExtractor={(item) => item.id}
      numColumns={NUM_COLUMNS}
      contentContainerStyle={styles.grid}
      columnWrapperStyle={styles.row}
      showsVerticalScrollIndicator={false}
      renderItem={({ item, index }) => (
        <ProductItem
          product={item}
          onPress={onProductPress}
          index={index}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  grid: {
    padding: Spacing.sm,
  },
  row: {
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  productCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  productIcon: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  productName: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
    textAlign: 'center',
    minHeight: 36,
  },
  productPrice: {
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
  },
  stockRow: {
    marginTop: Spacing.xs,
  },
  stockBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  stockText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '600',
  },
  stockNormal: {
    fontSize: Typography.fontSize.xs,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing['5xl'],
  },
  emptyText: {
    fontSize: Typography.fontSize.base,
    fontWeight: '500',
  },
});
