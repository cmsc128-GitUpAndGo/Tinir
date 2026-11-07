import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { chunkedStorage, type KeyValueStore } from './secure-storage';
import { webStorage } from './web-storage';

export const sessionStorage: KeyValueStore = Platform.OS === 'web' ? webStorage() : chunkedStorage({
  getItem: SecureStore.getItemAsync,
  setItem: (key, value) => SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }),
  removeItem: SecureStore.deleteItemAsync,
});
