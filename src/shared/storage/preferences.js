import { createMMKV } from 'react-native-mmkv';

// Non-sensitive user preferences only (e.g. last selected tab, UI toggles).
// Tokens and credentials NEVER go here — they are held by Auth0's
// Credentials Manager (iOS Keychain / Android Keystore).
export const preferences = createMMKV({ id: 'gymido.preferences' });
