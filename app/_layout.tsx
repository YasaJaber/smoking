// ============================================================
// Root Layout - App Entry Point with Providers
// ============================================================

import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Platform, AppState } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initializeDatabase } from '../src/db/client';
import { seedDatabase } from '../src/db/seed';
import { useSettingsStore } from '../src/stores/settingsStore';
import { scheduleDateRollover, useDateStore } from '../src/stores/dateStore';
import { useNetworkStatus } from '../src/hooks/useNetworkStatus';
import { Colors } from '../src/constants/theme';

type NavigationBarApi = typeof NavigationBar & {
  setHidden?: (hidden: boolean) => void | Promise<void>;
};

async function hideAndroidNavigationBar() {
  if (Platform.OS !== 'android') {
    return;
  }

  const navigationBar = NavigationBar as NavigationBarApi;

  try {
    if (navigationBar.setHidden) {
      await Promise.resolve(navigationBar.setHidden(true));
      return;
    }

    await NavigationBar.setVisibilityAsync('hidden');
  } catch (error) {
    console.warn('Failed to hide Android navigation bar:', error);
  }
}

async function configureAndroidNavigationBar() {
  if (Platform.OS !== 'android') {
    return;
  }

  try {
    await NavigationBar.setBehaviorAsync('overlay-swipe');
    await hideAndroidNavigationBar();
  } catch (error) {
    console.warn('Failed to configure Android navigation bar:', error);
  }
}

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const darkMode = useSettingsStore((s) => s.settings.dark_mode);
  const colors = darkMode ? Colors.dark : Colors.light;

  useEffect(() => {
    async function prepare() {
      try {
        await initializeDatabase();
        await seedDatabase();
        await loadSettings();
      } catch (e) {
        console.error('Failed to initialize app:', e);
      } finally {
        setIsReady(true);
      }
    }
    prepare();
  }, []);

  if (!isReady) {
    return (
      <View style={[styles.loading, { backgroundColor: Colors.dark.background }]}>
        <ActivityIndicator size="large" color={Colors.dark.primary} />
      </View>
    );
  }

  return <ReadyApp darkMode={darkMode} colors={colors} />;
}

interface ReadyAppProps {
  darkMode: boolean;
  colors: typeof Colors.dark | typeof Colors.light;
}

function ReadyApp({ darkMode, colors }: ReadyAppProps) {
  // Connectivity monitoring + auto-sync starts only after SQLite is ready.
  useNetworkStatus();

  // Keep the shared business date aligned with the local calendar after midnight.
  useEffect(() => {
    useDateStore.getState().rolloverToTodayIfNeeded();
    const cancelRollover = scheduleDateRollover();
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        useDateStore.getState().rolloverToTodayIfNeeded();
      }
    });

    return () => {
      cancelRollover();
      appStateSubscription.remove();
    };
  }, []);

  // Keep Android in immersive mode and re-hide the system bar after temporary reveals.
  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    const scheduleHide = (delay = 0) => {
      if (hideTimer) {
        clearTimeout(hideTimer);
      }

      hideTimer = setTimeout(() => {
        void hideAndroidNavigationBar();
      }, delay);
    };

    void configureAndroidNavigationBar();

    const visibilitySubscription = NavigationBar.addVisibilityListener(({ visibility }) => {
      if (visibility === 'visible') {
        scheduleHide(250);
      }
    });

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        scheduleHide(100);
      }
    });

    return () => {
      if (hideTimer) {
        clearTimeout(hideTimer);
      }

      visibilitySubscription.remove();
      appStateSubscription.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={darkMode ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'fade',
        }}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
