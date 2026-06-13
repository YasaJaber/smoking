// ============================================================
// useNetworkStatus - Monitor connectivity and drive auto-sync
//
// - Tracks online/offline via NetInfo and feeds it into the sync store.
// - Triggers a sync when connectivity is regained.
// - Runs a periodic background sync while online + configured.
// ============================================================

import { useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useSyncStore } from '../stores/syncStore';
import { APP_CONFIG } from '../constants/config';

export function useNetworkStatus() {
  const setOnline = useSyncStore((s) => s.setOnline);
  const sync = useSyncStore((s) => s.sync);
  const refreshStatus = useSyncStore((s) => s.refreshStatus);
  const wasOnline = useRef<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    // Initial state + status refresh
    NetInfo.fetch()
      .then((state) => {
        if (cancelled) return;
        const online = Boolean(state.isConnected && state.isInternetReachable !== false);
        wasOnline.current = online;
        setOnline(online);
        refreshStatus();
        if (online) sync(true);
      })
      .catch((error) => {
        console.error('Error reading network status:', error);
      });

    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected && state.isInternetReachable !== false);
      setOnline(online);
      // Just came back online -> trigger a catch-up sync
      if (online && !wasOnline.current) {
        sync(true);
      }
      wasOnline.current = online;
    });

    // Periodic background sync
    const interval = setInterval(() => {
      if (wasOnline.current) sync(true);
    }, APP_CONFIG.syncIntervalMs);

    return () => {
      cancelled = true;
      unsubscribe();
      clearInterval(interval);
    };
  }, [setOnline, sync, refreshStatus]);
}
