// ============================================================
// Login Screen - PIN-based Authentication
// Premium dark theme with animated PIN pad
// ============================================================

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  FadeIn,
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import { useAuthStore } from '../src/stores/authStore';
import { Colors, Gradients, Typography, Spacing, BorderRadius } from '../src/constants/theme';

const PIN_LENGTH = 4;
const PIN_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'delete'];

export default function LoginScreen() {
  const { width, height } = useWindowDimensions();
  const isCompact = width < 768;
  const keySize = width >= 768 ? 76 : width >= 360 ? 66 : 58;
  const keypadWidth = keySize * 3 + Spacing.md * 2;
  const [pin, setPin] = useState('');
  const { login, error, isLoading, clearError } = useAuthStore();
  const colors = Colors.dark;

  // Shake animation for error
  const shakeX = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const triggerShake = useCallback(() => {
    shakeX.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(0, { duration: 50 })
    );
  }, []);

  const handleKeyPress = useCallback(async (key: string) => {
    if (key === 'delete') {
      setPin((prev) => prev.slice(0, -1));
      clearError();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }

    if (key === '' || pin.length >= PIN_LENGTH) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newPin = pin + key;
    setPin(newPin);

    if (newPin.length === PIN_LENGTH) {
      const success = await login(newPin);
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/(auth)/pos');
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        triggerShake();
        setTimeout(() => setPin(''), 500);
      }
    }
  }, [pin, login, clearError, triggerShake]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Aurora background effect */}
      <LinearGradient
        colors={['rgba(99,102,241,0.08)', 'transparent', 'rgba(167,139,250,0.06)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Decorative circles */}
      <View style={[styles.decorCircle, styles.decorCircle1]} />
      <View style={[styles.decorCircle, styles.decorCircle2]} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { minHeight: height },
          isCompact && styles.contentCompact,
        ]}
      >
        {/* Left side - Branding */}
        <Animated.View
          entering={FadeInDown.duration(600).delay(100)}
          style={[styles.brandSection, isCompact && styles.brandSectionCompact]}
        >
          <View style={styles.logoContainer}>
            <LinearGradient
              colors={Gradients.primary as unknown as readonly [string, string, ...string[]]}
              style={[styles.logoGradient, isCompact && styles.logoGradientCompact]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <MaterialCommunityIcons name="store" size={48} color="#fff" />
            </LinearGradient>
          </View>
          <Text style={[styles.appName, { color: colors.text }]}>Smoking POS</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            نظام إدارة نقاط البيع
          </Text>
        </Animated.View>

        {/* Right side - PIN Pad */}
        <Animated.View
          entering={FadeInUp.duration(600).delay(200)}
          style={[styles.pinSection, isCompact && styles.pinSectionCompact]}
        >
          {/* PIN Dots */}
          <Text style={[styles.pinLabel, { color: colors.textSecondary }]}>
            أدخل رمز الدخول
          </Text>

          <Animated.View style={[styles.pinDotsRow, shakeStyle]}>
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.pinDot,
                  {
                    backgroundColor:
                      i < pin.length ? colors.primary : colors.surfaceLight,
                    borderColor:
                      i < pin.length ? colors.primary : colors.border,
                    transform: [{ scale: i < pin.length ? 1.2 : 1 }],
                  },
                ]}
              />
            ))}
          </Animated.View>

          {/* Error message */}
          {error && (
            <Animated.View entering={FadeIn.duration(200)}>
              <Text style={[styles.errorText, { color: colors.danger }]}>
                {error}
              </Text>
            </Animated.View>
          )}

          {/* Number Pad */}
          <View style={[styles.keypad, { width: keypadWidth }]}>
            {PIN_KEYS.map((key, index) => (
              <Pressable
                key={index}
                style={({ pressed }) => [
                  styles.key,
                  { width: keySize, height: isCompact ? keySize : 58 },
                  {
                    backgroundColor: pressed
                      ? colors.surfaceLight
                      : key === ''
                      ? 'transparent'
                      : colors.surface,
                    borderColor: key === '' ? 'transparent' : colors.border,
                    opacity: key === '' ? 0 : 1,
                  },
                ]}
                onPress={() => handleKeyPress(key)}
                disabled={key === '' || isLoading}
              >
                {key === 'delete' ? (
                  <MaterialCommunityIcons
                    name="backspace-outline"
                    size={24}
                    color={colors.textSecondary}
                  />
                ) : (
                  <Text style={[styles.keyText, { color: colors.text }]}>
                    {key}
                  </Text>
                )}
              </Pressable>
            ))}
          </View>

          {/* Hint */}
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            المدير: 1234 • الكاشير: 0000
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing['3xl'],
    paddingVertical: Spacing['3xl'],
    gap: 80,
  },
  contentCompact: {
    flexDirection: 'column',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing['2xl'],
    gap: Spacing['2xl'],
  },
  decorCircle: {
    position: 'absolute',
    borderRadius: 9999,
    opacity: 0.06,
  },
  decorCircle1: {
    width: 400,
    height: 400,
    backgroundColor: '#6366f1',
    top: -100,
    right: -100,
  },
  decorCircle2: {
    width: 300,
    height: 300,
    backgroundColor: '#a78bfa',
    bottom: -80,
    left: -80,
  },
  brandSection: {
    alignItems: 'center',
    flex: 0.4,
  },
  brandSectionCompact: {
    flex: 0,
  },
  logoContainer: {
    marginBottom: Spacing.lg,
  },
  logoGradient: {
    width: 96,
    height: 96,
    borderRadius: BorderRadius['2xl'],
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoGradientCompact: {
    width: 78,
    height: 78,
  },
  appName: {
    fontSize: Typography.fontSize['3xl'],
    fontWeight: '700',
    marginBottom: Spacing.xs,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: '500',
  },
  pinSection: {
    alignItems: 'center',
    flex: 0.35,
  },
  pinSectionCompact: {
    flex: 0,
  },
  pinLabel: {
    fontSize: Typography.fontSize.base,
    fontWeight: '500',
    marginBottom: Spacing.lg,
  },
  pinDotsRow: {
    flexDirection: 'row',
    gap: Spacing.base,
    marginBottom: Spacing.lg,
  },
  pinDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  errorText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '500',
    marginBottom: Spacing.md,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  key: {
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  keyText: {
    fontSize: Typography.fontSize.xl,
    fontWeight: '600',
  },
  hint: {
    fontSize: Typography.fontSize.xs,
    marginTop: Spacing.lg,
  },
});
