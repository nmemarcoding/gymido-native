import { reloadAppAsync } from 'expo';
import { Component } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, layout, spacing, typography } from '../theme/tokens';
import FeedbackIcon from './FeedbackIcon';
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

// Dated change (RN-SPEC-v2-phase2 §A7, ruling ND3; was RN-SPEC-app-shell
// §9.2's no icon + secondary button): the Route error board AS DRAWN. A
// surface card (max 560, radius 32, 1 px hairline, padding 40 32) with the
// danger icon tile, "Something went wrong", the body and the GOLD "Reload
// app". Full width with 16 sides (+ safe areas), centred; no tab bar (the
// boundary sits outside the shell); the ToastHost still draws above it.
export function RouteErrorFallback({ onReload }) {
  return (
    <SafeAreaView testID="route-error" style={styles.screen}>
      <View testID="route-error-region" style={styles.region}>
        {/* One live region: the card (role alert, polite). */}
        <View testID="route-error-card" accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.card}>
          <View testID="route-error-icon" style={styles.iconTile}>
            <FeedbackIcon name="warning" size={26} color={colors.dangerText} />
          </View>
          <Text accessibilityRole="header" textBreakStrategy="simple" style={styles.title}>
            Something went wrong
          </Text>
          <Text style={styles.body}>We hit a problem rendering this page. Reload the app to try again.</Text>
          <PillButton testID="route-error-reload" title="Reload app" onPress={onReload} style={styles.reload} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ground,
    paddingHorizontal: layout.gutter,
    paddingVertical: spacing[8],
  },
  region: {
    flex: 1,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    paddingVertical: 40,
    paddingHorizontal: spacing[8],
    alignItems: 'center',
  },
  iconTile: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.dangerTextTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[5],
  },
  title: {
    ...typography.titleLg,
    fontSize: 28,
    letterSpacing: -0.84,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  body: {
    ...typography.body,
    marginTop: spacing['2_5'],
    lineHeight: 23,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  reload: {
    marginTop: spacing[6],
    paddingHorizontal: spacing[7],
  },
});
