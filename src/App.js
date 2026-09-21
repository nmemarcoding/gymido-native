import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAuthLifecycle } from './features/auth/useAuthLifecycle';
import RootNavigator from './navigation/RootNavigator';
import { navigationRef } from './navigation/navigationRef';
import { hydrateServerOffset } from './shared/api/serverClock';
import { intlTimeZoneWorks } from './shared/utils/timestamps';
import ToastHost from './shared/components/ToastHost';

export default function App() {
  useAuthLifecycle();

  useEffect(() => {
    // RN-SPEC-time §1.2/§1.3: read the (never-written) offset like the web,
    // and self-test Hermes Intl time zones once at startup.
    hydrateServerOffset();
    intlTimeZoneWorks();
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef}>
        <RootNavigator />
      </NavigationContainer>
      <ToastHost />
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
