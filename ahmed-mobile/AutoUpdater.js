import React, { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import * as Updates from 'expo-updates';

const MIN_CHECK_INTERVAL_MS = 60 * 1000;
const FOREGROUND_RETRY_INTERVAL_MS = 5 * 60 * 1000;

export default function AutoUpdater({ children }) {
  const lastCheckedAt = useRef(0);
  const checking = useRef(false);

  useEffect(() => {
    if (__DEV__ || Platform.OS === 'web' || !Updates.isEnabled) return undefined;

    let cancelled = false;

    const checkForUpdate = async (force = false) => {
      if (cancelled || checking.current) return;
      const now = Date.now();
      if (!force && now - lastCheckedAt.current < MIN_CHECK_INTERVAL_MS) return;

      checking.current = true;
      lastCheckedAt.current = now;
      try {
        const result = await Updates.checkForUpdateAsync();
        if (!result.isAvailable || cancelled) return;
        await Updates.fetchUpdateAsync();
        if (!cancelled && AppState.currentState === 'active') {
          await Updates.reloadAsync();
        }
      } catch {
        // A temporary connection error must not prevent subsequent foreground checks.
      } finally {
        checking.current = false;
      }
    };

    checkForUpdate(true);

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkForUpdate();
    });

    const interval = setInterval(() => {
      if (AppState.currentState === 'active') checkForUpdate();
    }, FOREGROUND_RETRY_INTERVAL_MS);

    return () => {
      cancelled = true;
      subscription.remove();
      clearInterval(interval);
    };
  }, []);

  return children;
}
