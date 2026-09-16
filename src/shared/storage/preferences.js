import AsyncStorage from '@react-native-async-storage/async-storage';

// Non-sensitive user preferences only (e.g. the selected workspace).
// Tokens and credentials NEVER go here — they are held by Auth0's
// Credentials Manager (iOS Keychain / Android Keystore).
// Reads and writes are best-effort: a storage failure must not break a screen.

export async function getPreference(key) {
  try {
    return await AsyncStorage.getItem(key);
  } catch (error) {
    if (__DEV__) {
      console.warn(`[preferences] read failed for ${key}:`, error?.message);
    }
    return null;
  }
}

export async function setPreference(key, value) {
  try {
    await AsyncStorage.setItem(key, value);
  } catch (error) {
    if (__DEV__) {
      console.warn(`[preferences] write failed for ${key}:`, error?.message);
    }
  }
}
