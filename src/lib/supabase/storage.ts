import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { chunkedStorage, type KeyValueStore } from './secure-storage';

export const sessionStorage: KeyValueStore = Platform.OS === 'web' ? {
  getItem: async (key) => typeof window === 'undefined' ? null : window.sessionStorage.getItem(key),
  setItem: async (key, value) => { if (typeof window !== 'undefined') window.sessionStorage.setItem(key, value); },
  removeItem: async (key) => { if (typeof window !== 'undefined') window.sessionStorage.removeItem(key); },
} : chunkedStorage({
  getItem: SecureStore.getItemAsync,
  setItem: (key, value) => SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }),
  removeItem: SecureStore.deleteItemAsync,
});
