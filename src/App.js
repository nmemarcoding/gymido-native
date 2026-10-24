import { NavigationContainer } from '@react-navigation/native';
import { BlurTargetView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAuthLifecycle } from './features/auth/useAuthLifecycle';
import RootNavigator from './navigation/RootNavigator';
import { navigationRef } from './navigation/navigationRef';
import RouteErrorBoundary from './shared/components/RouteErrorBoundary';
import { appBlurTargetRef } from './shared/components/blurTarget';
import ToastHost from './shared/components/ToastHost';
import { initRestAlerts } from './features/workout/runtime/restAlertPlatform';
import { unlockTabletOrientation } from './shared/device/tabletOrientation';
import { restCountdown } from './shared/time/restCountdown';

// RN-SPEC-time O13.3 launch sweep, before anything rest-related: a cold
// start holds no rest, so no countdown may outlive the last process.
restCountdown.end().catch(() => {});
// O4: the notification handler and Android channels, once at startup.
initRestAlerts();
// app-shell O2: Android tablets rotate; phones stay portrait from the manifest.
unlockTabletOrientation();

// Only Android's blur reads a target; iOS skips the extra wrapper.
const AppBlurTarget = Platform.OS === 'android' ? BlurTargetView : View;

export default function App() {
  useAuthLifecycle();

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        {/* Android blur source for Modal scrims (expo-blur 57). */}
        <AppBlurTarget ref={appBlurTargetRef} style={styles.root}>
          <NavigationContainer ref={navigationRef}>
            {/* App-shell §9.2: render crashes show the reload screen; toasts stay outside. */}
            <RouteErrorBoundary>
              <RootNavigator />
            </RouteErrorBoundary>
          </NavigationContainer>
        </AppBlurTarget>
        <ToastHost />
        <StatusBar style="dark" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
