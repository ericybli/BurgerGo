/**
 * Better Auth client. Session cookie lives in SecureStore (expoClient);
 * lib/api/client.ts attaches it to every backend fetch. `wasSignedIn` is an
 * AsyncStorage latch so OFFLINE launches skip the login gate and run on cache.
 *
 * baseURL gotcha: better-auth only auto-appends its `/api/auth` basePath when
 * the baseURL has no path component (`withPath` in better-auth/utils/url).
 * API_BASE ends in `/burgergo`, so the basePath must be folded in explicitly —
 * requests hit `${API_BASE}/api/auth/*` (server basePath /burgergo/api/auth).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createAuthClient } from 'better-auth/react';
import { expoClient } from '@better-auth/expo/client';
import { API_BASE } from './api/base';

export const authClient = createAuthClient({
  baseURL: `${API_BASE}/api/auth`,
  plugins: [
    expoClient({
      scheme: 'burgergo',
      storagePrefix: 'burgergo',
      storage: SecureStore,
    }),
  ],
});

/** Cookie header value for plain fetch() calls; '' on web (browser cookies). */
export function sessionCookie(): string {
  if (Platform.OS === 'web') return '';
  try {
    return authClient.getCookie() ?? '';
  } catch {
    return '';
  }
}

const SIGNED_IN_KEY = 'bg.auth.wasSignedIn';
export const setWasSignedIn = (v: boolean) =>
  v ? AsyncStorage.setItem(SIGNED_IN_KEY, '1') : AsyncStorage.removeItem(SIGNED_IN_KEY);
export const getWasSignedIn = async () => (await AsyncStorage.getItem(SIGNED_IN_KEY)) === '1';
