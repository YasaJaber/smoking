// ============================================================
// QuickCustomItemModal - Add ad-hoc item to invoice (no inventory)
// ============================================================

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { Colors, Gradients, Typography, Spacing, BorderRadius } from '../../constants/theme';
import { useSettingsStore } from '../../stores/settingsStore';
import { useCartStore } from '../../stores/cartStore';

interface QuickCustomItemModalProps {
  visible: boolean;
  onClose: () => void;
}

export function QuickCustomItemModal({ visible, onClose }: QuickCustomItemModalProps) {
  const { width } = useWindowDimensions();
  const isCompact = width < 768;
  const darkMode = useSettingsStore((s) => s.settings.dark_mode);
  const colors = darkMode ? Colors.dark : Colors.light;
  const addCustomItem = useCartStore((s) => s.addCustomItem);

  const [name, setName] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setName('');
    setCostPrice('');
    setSellPrice('');
    setQuantity('1');
    setError('');
  }, [visible]);

  const handleAdd = () => {
    const trimmedName = name.trim();
    const cost = parseFloat(costPrice);
    const sell = parseFloat(sellPrice);
    const qty = parseInt(quantity, 10);

    if (!trimmedName) {
      setError('اكتب اسم الصنف');
      return;
    }
    if (!cost || cost <= 0) {
      setError('اكتب سعر شراء صحيح');
      return;
    }
    if (!sell || sell <= 0) {
      setError('اكتب سعر بيع صحيح');
      return;
    }
    if (sell < cost) {
      setError('سعر البيع لازم يكون أكبر من أو يساوي سعر الشراء');
      return;
    }
    if (!qty || qty <= 0) {
      setError('اكتب كمية صحيحة');
      return;
    }

    addCustomItem(trimmedName, cost, sell, qty);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  };

  const parsedCost = parseFloat(costPrice) || 0;
  const parsedSell = parseFloat(sellPrice) || 0;
  const parsedQty = parseInt(quantity, 10) || 0;
  const profit = Math.max(0, (parsedSell - parsedCost) * parsedQty);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <Animated.View
          entering={SlideInDown.duration(300)}
          style={[
            styles.modal,
            {
              backgroundColor: colors.surface,
              width: Math.min(width - Spacing.base * 2, isCompact ? 360 : 420),
            },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <MaterialCommunityIcons name="lightning-bolt" size={22} color={colors.warning} />
              <Text style={[styles.title, { color: colors.text }]}>صنف سريع</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <MaterialCommunityIcons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>

          <Text style={[styles.hint, { color: colors.textMuted }]}>
            يتضاف للفاتورة فقط — مش هيتخصم من المخزون
          </Text>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>اسم الصنف</Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.surfaceLight, borderColor: colors.border, color: colors.text },
              ]}
              value={name}
              onChangeText={(value) => {
                setName(value);
                setError('');
              }}
              placeholder="مثال: معسل خاص"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.half]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>الشراء بكام</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.surfaceLight, borderColor: colors.border, color: colors.text },
                ]}
                value={costPrice}
                onChangeText={(value) => {
                  setCostPrice(value);
                  setError('');
                }}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={[styles.inputGroup, styles.half]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>هتبيعه بكام</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.surfaceLight, borderColor: colors.border, color: colors.text },
                ]}
                value={sellPrice}
                onChangeText={(value) => {
                  setSellPrice(value);
                  setError('');
                }}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.half]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>الكمية</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.surfaceLight, borderColor: colors.border, color: colors.text },
                ]}
                value={quantity}
                onChangeText={(value) => {
                  setQuantity(value);
                  setError('');
                }}
                keyboardType="number-pad"
                placeholder="1"
                placeholderTextColor={colors.textMuted}
                selectTextOnFocus
              />
            </View>

            <View style={[styles.profitBox, { backgroundColor: colors.accentGlow, borderColor: colors.accent }]}>
              <Text style={[styles.profitLabel, { color: colors.accent }]}>المكسب</Text>
              <Text style={[styles.profitValue, { color: colors.accent }]}>
                {profit.toFixed(2)}
              </Text>
            </View>
          </View>

          {error ? (
            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          ) : null}

          <Pressable onPress={handleAdd}>
            <LinearGradient
              colors={Gradients.primary as unknown as readonly [string, string, ...string[]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.addBtn}
            >
              <MaterialCommunityIcons name="plus-circle" size={22} color="#fff" />
              <Text style={styles.addBtnText}>إضافة للفاتورة</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    borderRadius: BorderRadius['2xl'],
    padding: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: {
    fontSize: Typography.fontSize.lg,
    fontWeight: '700',
  },
  hint: {
    fontSize: Typography.fontSize.sm,
    marginBottom: Spacing.lg,
  },
  inputGroup: {
    marginBottom: Spacing.base,
  },
  label: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '500',
    marginBottom: Spacing.sm,
  },
  input: {
    fontSize: Typography.fontSize.base,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  half: {
    flex: 1,
  },
  profitBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    justifyContent: 'center',
    marginBottom: Spacing.base,
    minHeight: 70,
  },
  profitLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
    marginBottom: 2,
  },
  profitValue: {
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
  },
  errorText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
    marginBottom: Spacing.base,
    textAlign: 'center',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  addBtnText: {
    color: '#fff',
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
  },
});
