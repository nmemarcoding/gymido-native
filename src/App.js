import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAuthLifecycle } from './features/auth/useAuthLifecycle';
import RootNavigator from './navigation/RootNavigator';
import { navigationRef } from './navigation/navigationRef';
import { hydrateServerOffset } from './shared/api/serverClock';
import { applyOrientationPolicy } from './shared/device/orientationPolicy';
import { configureRestNotifications } from './shared/time/restAlerts';
import { RestCountdown } from './shared/time/restCountdown';
import { intlTimeZoneWorks } from './shared/utils/timestamps';
import ToastHost from './shared/components/ToastHost';

export default function App() {
  useAuthLifecycle();

  useEffect(() => {
    // RN-SPEC-time §1.2/§1.3: read the (never-written) offset like the web,
    // and self-test Hermes Intl time zones once at startup.
    hydrateServerOffset();
    intlTimeZoneWorks();
    // [O2]: Android tablets rotate; phones stay portrait.
    applyOrientationPolicy();
    // [O4]: the foreground handler and the Android rest-timer channel.
    configureRestNotifications();
    // [O13.3] Launch sweep: a cold start holds no rest, so any countdown still
    // on the lock screen belongs to one that no longer exists.
    RestCountdown.end();
    // Debug builds only: dev menu → "Trigger render crash" (RN-SPEC-app-shell §9.2).
    if (__DEV__) {
      require('./dev/debugCrash').registerDebugCrashMenuItem();
    }
  }, []);

  return (
    <SafeAreaProvider>
      {/* app-root: lets UI tests tell the loaded app from the Expo dev launcher on every screen. */}
      <View testID="app-root" style={styles.root}>
        <NavigationContainer ref={navigationRef}>
          <RootNavigator />
        </NavigationContainer>
        <ToastHost />
      </View>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
