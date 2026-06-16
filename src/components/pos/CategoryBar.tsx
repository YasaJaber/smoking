// ============================================================
// CategoryBar - Horizontal scrollable category filter
// ============================================================

import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Typography, Spacing, BorderRadius } from '../../constants/theme';
import { getCategoryEmoji } from '../../constants/categoryEmojis';
import { useSettingsStore } from '../../stores/settingsStore';
import type { Category } from '../../types';

const CHIP_HEIGHT = 34;

interface CategoryBarProps {
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function CategoryBar({ categories, selectedId, onSelect }: CategoryBarProps) {
  const darkMode = useSettingsStore((s) => s.settings.dark_mode);
  const colors = darkMode ? Colors.dark : Colors.light;

  const handlePress = (id: string | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(id);
  };

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.container}
      >
      {/* All button */}
      <Pressable
        onPress={() => handlePress(null)}
        style={[
          styles.chip,
          {
            backgroundColor: selectedId === null ? colors.primary : colors.surfaceLight,
            borderColor: selectedId === null ? colors.primary : colors.border,
          },
        ]}
      >
        <MaterialCommunityIcons
          name="view-grid"
          size={15}
          color={selectedId === null ? '#fff' : colors.textSecondary}
        />
        <Text
          style={[
            styles.chipText,
            { color: selectedId === null ? '#fff' : colors.textSecondary },
          ]}
          numberOfLines={1}
        >
          الكل
        </Text>
      </Pressable>

      {categories.map((cat) => {
        const isActive = selectedId === cat.id;
        return (
          <Pressable
            key={cat.id}
            onPress={() => handlePress(cat.id)}
            style={[
              styles.chip,
              {
                backgroundColor: isActive ? cat.color : colors.surfaceLight,
                borderColor: isActive ? cat.color : colors.border,
              },
            ]}
          >
            <Text style={styles.chipEmoji}>{getCategoryEmoji(cat)}</Text>
            <Text
              style={[
                styles.chipText,
                { color: isActive ? '#fff' : colors.text },
              ]}
              numberOfLines={1}
            >
              {cat.name}
            </Text>
          </Pressable>
        );
      })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexGrow: 0,
    flexShrink: 0,
  },
  scroll: {
    flexGrow: 0,
    maxHeight: CHIP_HEIGHT + Spacing.xs * 2,
  },
  container: {
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    height: CHIP_HEIGHT,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  chipText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '600',
    lineHeight: 14,
  },
  chipEmoji: {
    fontSize: 15,
    lineHeight: 18,
  },
});
