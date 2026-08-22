import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Updates from 'expo-updates';

export default function AutoUpdater({ children }) {
  const checked = useRef(false);

  useEffect(() => {
    if (__DEV__ || Platform.OS === 'web' || checked.current || !Updates.isEnabled) return undefined;
    checked.current = true;
    let cancelled = false;

    (async () => {
      try {
        const result = await Updates.checkForUpdateAsync();
        if (!result.isAvailable) return;

        await Updates.fetchUpdateAsync();
        if (!cancelled) await Updates.reloadAsync();
      } catch (error) {
        // Keep the currently installed version running if the update server is temporarily unavailable.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return children;
}
