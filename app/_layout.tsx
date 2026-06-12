// ============================================================
// Root Layout - App Entry Point with Providers
// ============================================================

import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initializeDatabase } from '../src/db/client';
import { seedDatabase } from '../src/db/seed';
import { useSettingsStore } from '../src/stores/settingsStore';
import { useNetworkStatus } from '../src/hooks/useNetworkStatus';
import { Colors } from '../src/constants/theme';

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const darkMode = useSettingsStore((s) => s.settings.dark_mode);
  const colors = darkMode ? Colors.dark : Colors.light;

  // Connectivity monitoring + auto-sync (on start, reconnect, and interval)
  useNetworkStatus();

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
