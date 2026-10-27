import { reloadAppAsync } from 'expo';
import { Component } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, layout, spacing, textScale, typography } from '../theme/tokens';
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
// Colours (UX §8.5): the icon tile's board danger 0.12 → danger-tint 0.14
// (the danger-dot fill; danger-text stays the glyph). Large text (UX §9): the title caps
// at textScale.title (28 = title-*), wraps by word and shrinks a single long
// word; the body at textScale.body; the card scrolls when it outgrows the
// screen (AX5), never clipped.
export function RouteErrorFallback({ onReload }) {
  return (
    <SafeAreaView testID="route-error" style={styles.screen}>
      <ScrollView testID="route-error-scroll" style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View testID="route-error-region" style={styles.region}>
          {/* One live region: the card (role alert, polite). */}
          <View testID="route-error-card" accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.card}>
            <View testID="route-error-icon" style={styles.iconTile}>
              <FeedbackIcon name="warning" size={26} color={colors.dangerText} />
            </View>
            <Text
              testID="route-error-title"
              accessibilityRole="header"
              maxFontSizeMultiplier={textScale.title}
              numberOfLines={3}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              textBreakStrategy="simple"
              style={styles.title}
            >
              Something went wrong
            </Text>
            <Text testID="route-error-body" maxFontSizeMultiplier={textScale.body} style={styles.body}>
              We hit a problem rendering this page. Reload the app to try again.
            </Text>
            <PillButton testID="route-error-reload" title="Reload app" onPress={onReload} style={styles.reload} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ground,
    paddingHorizontal: layout.gutter,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: spacing[8],
  },
  region: {
    flexGrow: 1,
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
    backgroundColor: colors.dangerTint,
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
