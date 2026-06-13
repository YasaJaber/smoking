// ============================================================
// Current Date Badge - Reusable date display for screen headers
// ============================================================

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, TextInput } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../../constants/theme';
import { useSettingsStore } from '../../stores/settingsStore';
import { useDateStore } from '../../stores/dateStore';

export function getLocalDateKey(date: Date = new Date()): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function formatDisplayDate(date: Date | string): string {
  const value = typeof date === 'string' ? new Date(`${date}T00:00:00`) : date;

  return value.toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function parseDateKey(dateKey: string): { year: string; month: string; day: string } {
  const [year = '', month = '', day = ''] = dateKey.split('-');
  return { year, month, day };
}

function normalizeDateParts(year: string, month: string, day: string): string | null {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);

  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) {
    return null;
  }

  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) {
    return null;
  }

  const value = new Date(y, m - 1, d);
  if (value.getFullYear() !== y || value.getMonth() !== m - 1 || value.getDate() !== d) {
    return null;
  }

  return getLocalDateKey(value);
}

interface CurrentDateBadgeProps {
  dateKey?: string;
  onDateChange?: (dateKey: string) => void;
}

export function CurrentDateBadge({ dateKey, onDateChange }: CurrentDateBadgeProps) {
  const darkMode = useSettingsStore((s) => s.settings.dark_mode);
  const sharedDateKey = useDateStore((s) => s.selectedDateKey);
  const setSharedDateKey = useDateStore((s) => s.setSelectedDateKey);
  const colors = darkMode ? Colors.dark : Colors.light;
  const activeDateKey = dateKey ?? sharedDateKey;
  const activeParts = useMemo(() => parseDateKey(activeDateKey), [activeDateKey]);

  const [modalVisible, setModalVisible] = useState(false);
  const [year, setYear] = useState(activeParts.year);
  const [month, setMonth] = useState(activeParts.month);
  const [day, setDay] = useState(activeParts.day);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!modalVisible) {
      setYear(activeParts.year);
      setMonth(activeParts.month);
      setDay(activeParts.day);
      setError('');
    }
  }, [activeParts.day, activeParts.month, activeParts.year, modalVisible]);

  const applyDate = (nextDateKey: string) => {
    if (onDateChange) {
      onDateChange(nextDateKey);
    } else {
      setSharedDateKey(nextDateKey);
    }

    setModalVisible(false);
  };

  const handleConfirm = () => {
    const nextDateKey = normalizeDateParts(year, month, day);

    if (!nextDateKey) {
      setError('اكتب تاريخ صحيح');
      return;
    }

    applyDate(nextDateKey);
  };

  return (
    <>
      <Pressable
        onPress={() => setModalVisible(true)}
        style={({ pressed }) => [
          styles.badge,
          {
            backgroundColor: pressed ? colors.primaryGlow : colors.surfaceLight,
            borderColor: pressed ? colors.primary : colors.border,
          },
        ]}
      >
        <MaterialCommunityIcons name="calendar-edit" size={16} color={colors.primary} />
        <Text style={[styles.text, { color: colors.textSecondary }]} numberOfLines={1}>
          {formatDisplayDate(activeDateKey)}
        </Text>
      </Pressable>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modal, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>اختيار التاريخ</Text>
              <Pressable onPress={() => setModalVisible(false)} style={styles.iconButton}>
                <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.inputsRow}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>اليوم</Text>
                <TextInput
                  value={day}
                  onChangeText={(value) => {
                    setDay(value.replace(/\D/g, '').slice(0, 2));
                    setError('');
                  }}
                  keyboardType="number-pad"
                  placeholder="DD"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, { backgroundColor: colors.surfaceLight, borderColor: colors.border, color: colors.text }]}
                  textAlign="center"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>الشهر</Text>
                <TextInput
                  value={month}
                  onChangeText={(value) => {
                    setMonth(value.replace(/\D/g, '').slice(0, 2));
                    setError('');
                  }}
                  keyboardType="number-pad"
                  placeholder="MM"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, { backgroundColor: colors.surfaceLight, borderColor: colors.border, color: colors.text }]}
                  textAlign="center"
                />
              </View>

              <View style={[styles.inputGroup, styles.yearInputGroup]}>
                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>السنة</Text>
                <TextInput
                  value={year}
                  onChangeText={(value) => {
                    setYear(value.replace(/\D/g, '').slice(0, 4));
                    setError('');
                  }}
                  keyboardType="number-pad"
                  placeholder="YYYY"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, { backgroundColor: colors.surfaceLight, borderColor: colors.border, color: colors.text }]}
                  textAlign="center"
                />
              </View>
            </View>

            {!!error && <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>}

            <View style={styles.actionsRow}>
              <Pressable
                onPress={() => applyDate(getLocalDateKey())}
                style={[styles.secondaryButton, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>النهارده</Text>
              </Pressable>

              <Pressable
                onPress={handleConfirm}
                style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              >
                <MaterialCommunityIcons name="check" size={18} color="#fff" />
                <Text style={styles.primaryButtonText}>تأكيد</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
    maxWidth: 240,
    flexShrink: 1,
  },
  text: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '600',
    flexShrink: 1,
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.base,
  },
  modal: {
    width: '100%',
    maxWidth: 360,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.base,
  },
  modalTitle: {
    fontSize: Typography.fontSize.base,
    fontWeight: '800',
  },
  iconButton: {
    padding: Spacing.xs,
  },
  inputsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  inputGroup: {
    flex: 1,
  },
  yearInputGroup: {
    flex: 1.35,
  },
  inputLabel: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
  },
  errorText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    marginTop: Spacing.sm,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
  },
  secondaryButtonText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '800',
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: Typography.fontSize.sm,
    fontWeight: '800',
  },
});
