import { reloadAppAsync } from 'expo';
import { Component } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii, shadows } from '../theme/tokens';

// RN-SPEC-app-shell §9.2: the crash safety net. A JS render crash anywhere in
// the route tree replaces the whole tree (shell, tab bar, header) with this
// fallback instead of closing the app. It catches errors thrown while
// rendering, in lifecycle methods and in constructors. It does NOT catch
// errors in event handlers or async code, or native crashes (the Android
// gradient crash kills the process before JS can react).
//
// No automatic reset: navigating, going back or refocusing never clears it; it
// stays tripped until "Reload app", a full JS reload (a cold start of the JS
// app: bootstrap reruns, in-memory state — a running rest included — is lost,
// and the O13 launch sweep ends any live countdown).

export function CrashFallback({ onReload }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  return (
    <View
      testID="route-error-fallback"
      style={[
        styles.screen,
        {
          paddingTop: 32 + insets.top,
          paddingBottom: 32 + insets.bottom,
          paddingLeft: 16 + insets.left,
          paddingRight: 16 + insets.right,
        },
      ]}
    >
      <View style={[styles.region, { minHeight: height * 0.6 }]}>
        <View accessibilityLiveRegion="polite" style={styles.card}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>We hit a problem rendering this page. Reload the app to try again.</Text>
          <Pressable
            testID="route-error-reload"
            accessibilityRole="button"
            onPress={onReload}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonLabel}>Reload app</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default class RouteErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    if (__DEV__) {
      console.error('Route render failed', error);
    }
  }

  reload = () => {
    (this.props.reload ?? reloadAppAsync)();
  };

  render() {
    return this.state.hasError ? <CrashFallback onReload={this.reload} /> : this.props.children;
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
  },
  region: {
    width: '100%',
    maxWidth: 576,
    alignSelf: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: 23.2,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
    boxShadow: shadows.soft,
    paddingHorizontal: 24,
    paddingVertical: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  message: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  button: {
    marginTop: 20,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    boxShadow: shadows.soft,
  },
  buttonPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  buttonLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
