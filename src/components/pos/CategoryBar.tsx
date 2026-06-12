// ============================================================
// CategoryBar - Horizontal scrollable category filter
// ============================================================

import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Colors, Typography, Spacing, BorderRadius } from '../../constants/theme';
import { useSettingsStore } from '../../stores/settingsStore';
import type { Category } from '../../types';

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
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
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
          size={18}
          color={selectedId === null ? '#fff' : colors.textSecondary}
        />
        <Text
          style={[
            styles.chipText,
            { color: selectedId === null ? '#fff' : colors.textSecondary },
          ]}
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
            <MaterialCommunityIcons
              name={(cat.icon as any) || 'folder'}
              size={18}
              color={isActive ? '#fff' : cat.color}
            />
            <Text
              style={[
                styles.chipText,
                { color: isActive ? '#fff' : colors.text },
              ]}
            >
              {cat.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  chipText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
  },
});
