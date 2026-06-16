// ============================================================
// CartPanel - Invoice/Cart panel for POS screen
// ============================================================

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Colors, Gradients, Typography, Spacing, BorderRadius } from '../../constants/theme';
import { useSettingsStore } from '../../stores/settingsStore';
import { useCartStore } from '../../stores/cartStore';
import { formatCurrency } from '../../utils/formatters';

interface CartPanelProps {
  onCheckout: () => void;
}

export function CartPanel({ onCheckout }: CartPanelProps) {
  const { width } = useWindowDimensions();
  const isCompact = width < 768;
  const darkMode = useSettingsStore((s) => s.settings.dark_mode);
  const colors = darkMode ? Colors.dark : Colors.light;
  const currency = useSettingsStore((s) => s.settings.currency);

  const {
    items,
    subtotal,
    taxAmount,
    total,
    taxEnabled,
    incrementItem,
    decrementItem,
    removeItem,
    clearCart,
  } = useCartStore();

  const handleClear = () => {
    if (items.length === 0) return;
    Alert.alert(
      'مسح الفاتورة',
      'هل تريد مسح جميع العناصر من الفاتورة؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'مسح',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            clearCart();
          },
        },
      ]
    );
  };

  const handleCheckout = () => {
    if (items.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onCheckout();
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderLeftWidth: isCompact ? 0 : 1,
          borderTopWidth: isCompact ? 1 : 0,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons name="receipt" size={20} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>الفاتورة</Text>
          {items.length > 0 && (
            <View style={[styles.countBadge, { backgroundColor: colors.primaryGlow }]}>
              <Text style={[styles.countText, { color: colors.primary }]}>
                {items.length}
              </Text>
            </View>
          )}
        </View>
        <Pressable onPress={handleClear} hitSlop={8}>
          <MaterialCommunityIcons
            name="delete-outline"
            size={20}
            color={items.length > 0 ? colors.danger : colors.textMuted}
          />
        </Pressable>
      </View>

      {/* Cart Items */}
      <ScrollView style={styles.itemsList} showsVerticalScrollIndicator={false}>
        {items.length === 0 ? (
          <View style={styles.emptyCart}>
            <MaterialCommunityIcons
              name="cart-outline"
              size={40}
              color={colors.textMuted}
            />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              الفاتورة فارغة
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
              اضغط على المنتجات أو استخدم "صنف سريع"
            </Text>
          </View>
        ) : (
          items.map((item) => (
            <Animated.View
              key={item.product.id}
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(150)}
              style={[
                styles.cartItem,
                item.isCustom && styles.cartItemCustom,
                {
                  backgroundColor: colors.surfaceLight,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.itemMain}>
                <View style={styles.itemInfo}>
                  <View style={styles.itemNameRow}>
                    <Text
                      style={[styles.itemName, { color: colors.text }]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {item.product.name}
                    </Text>
                    {item.isCustom && (
                      <View style={[styles.customBadge, { backgroundColor: 'rgba(251, 191, 36, 0.15)' }]}>
                        <Text style={[styles.customBadgeText, { color: colors.warning }]}>سريع</Text>
                      </View>
                    )}
                  </View>
                  <Text
                    style={[styles.itemPrice, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {formatCurrency(item.product.sell_price, currency)} × {item.quantity}
                  </Text>
                  {item.isCustom && (
                    <Text
                      style={[styles.itemProfit, { color: colors.accent }]}
                      numberOfLines={1}
                    >
                      مكسب: {formatCurrency((item.product.sell_price - item.product.cost_price) * item.quantity, currency)}
                    </Text>
                  )}
                </View>

                <View style={styles.itemActions}>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      decrementItem(item.product.id);
                    }}
                    style={[styles.qtyBtn, { backgroundColor: colors.surface }]}
                  >
                    <MaterialCommunityIcons
                      name={item.quantity === 1 ? 'delete-outline' : 'minus'}
                      size={14}
                      color={item.quantity === 1 ? colors.danger : colors.text}
                    />
                  </Pressable>

                  <Text style={[styles.qtyText, { color: colors.text }]}>
                    {item.quantity}
                  </Text>

                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      incrementItem(item.product.id);
                    }}
                    style={[styles.qtyBtn, { backgroundColor: colors.primaryGlow }]}
                  >
                    <MaterialCommunityIcons name="plus" size={14} color={colors.primary} />
                  </Pressable>

                  <Text style={[styles.itemTotal, { color: colors.text }]}>
                    {formatCurrency(item.total, currency)}
                  </Text>
                </View>
              </View>
            </Animated.View>
          ))
        )}
      </ScrollView>

      {/* Totals */}
      {items.length > 0 && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.totals}>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>
              المجموع الفرعي
            </Text>
            <Text style={[styles.totalValue, { color: colors.text }]}>
              {formatCurrency(subtotal, currency)}
            </Text>
          </View>

          {taxEnabled && (
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>
                الضريبة
              </Text>
              <Text style={[styles.totalValue, { color: colors.warning }]}>
                +{formatCurrency(taxAmount, currency)}
              </Text>
            </View>
          )}

          <View style={[styles.totalRow, styles.grandTotalRow]}>
            <Text style={[styles.grandTotalLabel, { color: colors.text }]}>
              الإجمالي
            </Text>
            <Text style={[styles.grandTotalValue, { color: colors.primary }]}>
              {formatCurrency(total, currency)}
            </Text>
          </View>

          {/* Checkout Button */}
          <Pressable onPress={handleCheckout}>
            <LinearGradient
              colors={Gradients.primary as unknown as readonly [string, string, ...string[]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.checkoutBtn}
            >
              <MaterialCommunityIcons name="cash-check" size={22} color="#fff" />
              <Text style={styles.checkoutText}>إتمام البيع</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: '700',
  },
  countBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 1,
    borderRadius: BorderRadius.full,
  },
  countText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
  },
  itemsList: {
    flex: 1,
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  emptyCart: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing['5xl'],
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: Typography.fontSize.base,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: Typography.fontSize.sm,
  },
  cartItem: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    minHeight: 56,
    maxHeight: 64,
    overflow: 'hidden',
  },
  cartItemCustom: {
    maxHeight: 82,
  },
  itemMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  itemInfo: {
    flex: 1,
    minWidth: 0,
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    maxWidth: '100%',
  },
  itemName: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
    flexShrink: 1,
    flexGrow: 0,
  },
  customBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 1,
    borderRadius: BorderRadius.sm,
    flexShrink: 0,
  },
  customBadgeText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
  },
  itemPrice: {
    fontSize: Typography.fontSize.xs,
    marginTop: 1,
  },
  itemProfit: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    marginTop: 1,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexShrink: 0,
  },
  qtyBtn: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    minWidth: 18,
    textAlign: 'center',
  },
  itemTotal: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    minWidth: 52,
    textAlign: 'right',
  },
  totals: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.base,
  },
  divider: {
    height: 1,
    marginBottom: Spacing.md,
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
  grandTotalRow: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.base,
  },
  grandTotalLabel: {
    fontSize: Typography.fontSize.md,
    fontWeight: '700',
  },
  grandTotalValue: {
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
  },
  checkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  checkoutText: {
    color: '#fff',
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
  },
});
