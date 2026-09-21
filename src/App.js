import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAuthLifecycle } from './features/auth/useAuthLifecycle';
import RootNavigator from './navigation/RootNavigator';
import { navigationRef } from './navigation/navigationRef';
import { hydrateServerOffset } from './shared/api/serverClock';
import ToastHost from './shared/components/ToastHost';

export default function App() {
  useAuthLifecycle();

  useEffect(() => {
    hydrateServerOffset();
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
