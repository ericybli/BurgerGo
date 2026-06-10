/**
 * Connectivity hook. Writes are online-only across the app; screens gate their
 * mutating affordances on this. Mirrors the web app's `navigator.onLine` checks.
 */
import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      // Treat null (unknown) as online so we never wrongly block on first paint.
      setOnline(state.isConnected !== false);
    });
    return unsub;
  }, []);
  return online;
}
