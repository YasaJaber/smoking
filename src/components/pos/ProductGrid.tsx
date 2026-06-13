// ============================================================
// ProductGrid - Grid display of products for POS
// ============================================================

import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Colors, Typography, Spacing, BorderRadius } from '../../constants/theme';
import { useSettingsStore } from '../../stores/settingsStore';
import { formatCurrency } from '../../utils/formatters';
import type { Product } from '../../types';

interface ProductGridProps {
  products: Product[];
  onProductPress: (product: Product) => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Pick column count from the actual products-section width (not the whole
// screen) so cards stay large instead of getting squeezed into the left pane.
function getNumColumns(containerWidth: number): number {
  if (containerWidth <= 0) return 2;
  if (containerWidth >= 900) return 4;
  if (containerWidth >= 620) return 3;
  return 2;
}

function ProductItem({ product, onPress, index, cardWidth }: {
  product: Product;
  onPress: (product: Product) => void;
  index: number;
  cardWidth: number;
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
      entering={FadeInUp.duration(250).delay(index * 20)}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.productCard,
        {
          width: cardWidth,
          backgroundColor: colors.surfaceLight,
          borderColor: colors.border,
          opacity: isOutOfStock ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed && !isOutOfStock ? 0.97 : 1 }],
        },
      ]}
    >
      <View style={[styles.productIcon, { backgroundColor: colors.glass }]}>
        <MaterialCommunityIcons
          name="package-variant-closed"
          size={28}
          color={colors.primary}
        />
      </View>

      <Text
        style={[styles.productName, { color: colors.text }]}
        numberOfLines={2}
        ellipsizeMode="tail"
      >
        {product.name}
      </Text>

      <Text style={[styles.productPrice, { color: colors.primary }]}>
        {formatCurrency(product.sell_price, settings.currency)}
      </Text>

      {isOutOfStock ? (
        <Text style={[styles.stockText, { color: colors.danger }]}>نفد</Text>
      ) : isLowStock ? (
        <Text style={[styles.stockText, { color: colors.warning }]}>
          {product.quantity}
        </Text>
      ) : (
        <Text style={[styles.stockText, { color: colors.textMuted }]}>
          {product.quantity}
        </Text>
      )}
    </AnimatedPressable>
  );
}

export function ProductGrid({ products, onProductPress }: ProductGridProps) {
  const darkMode = useSettingsStore((s) => s.settings.dark_mode);
  const colors = darkMode ? Colors.dark : Colors.light;
  const [containerWidth, setContainerWidth] = useState(0);
  const numColumns = getNumColumns(containerWidth);

  const GAP = Spacing.md;
  const horizontalPadding = Spacing.md * 2;
  const cardWidth =
    containerWidth > 0
      ? (containerWidth - horizontalPadding - GAP * (numColumns - 1)) / numColumns
      : 0;

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
    <View
      style={styles.listContainer}
      onLayout={(event) => {
        const nextWidth = event.nativeEvent.layout.width;
        if (nextWidth > 0 && nextWidth !== containerWidth) {
          setContainerWidth(nextWidth);
        }
      }}
    >
      {cardWidth > 0 && (
        <ScrollView
          style={styles.list}
          contentContainerStyle={[styles.grid, { gap: GAP }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.gridRow, { gap: GAP }]}>
            {products.map((product, index) => (
              <ProductItem
                key={product.id}
                product={product}
                onPress={onProductPress}
                index={index}
                cardWidth={cardWidth}
              />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  listContainer: {
    flex: 1,
    minHeight: 0,
  },
  list: {
    flex: 1,
  },
  grid: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  productCard: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 150,
    maxHeight: 170,
    gap: Spacing.xs,
  },
  productIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productName: {
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
    lineHeight: 22,
    minHeight: 44,
  },
  productPrice: {
    fontSize: Typography.fontSize.md,
    fontWeight: '800',
    marginTop: 2,
  },
  stockText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
    marginTop: 2,
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
