import { reloadAppAsync } from 'expo';
import { Component } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../theme/tokens';
import EmptyState from './EmptyState';
import PillButton from './PillButton';

// App-shell spec §9.2: catches render crashes in the route tree. It never
// resets on its own; only "Reload app" (a full JS reload) clears it.
export default class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

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
    if (!this.state.hasError) {
      return this.props.children;
    }
    return <RouteErrorFallback onReload={this.reload} />;
  }
}

export function RouteErrorFallback({ onReload }) {
  return (
    <SafeAreaView testID="route-error" style={styles.screen}>
      <View style={styles.region}>
        <View accessibilityLiveRegion="polite">
          <EmptyState
            title="Something went wrong"
            message="We hit a problem rendering this page. Reload the app to try again."
          />
        </View>
        <View style={styles.action}>
          <PillButton testID="route-error-reload" title="Reload app" variant="secondary" onPress={onReload} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingVertical: 32,
  },
  region: {
    flex: 1,
    minHeight: '60%',
    width: '100%',
    maxWidth: 576,
    alignSelf: 'center',
    justifyContent: 'center',
  },
  action: {
    marginTop: 20,
    alignItems: 'center',
  },
});
