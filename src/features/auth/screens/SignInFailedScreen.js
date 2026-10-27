import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, Text, View, findNodeHandle, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ErrorAlert from '../../../shared/components/ErrorAlert';
import PillButton from '../../../shared/components/PillButton';
import Screen from '../../../shared/components/Screen';
import { colors, font, gradients, radii, spacing, typography } from '../../../shared/theme/tokens';
import { retryLastAttempt } from '../authService';
import { useAuthStore } from '../authStore';
import { IconTile, PadlockRing, TabletAuthCard, boardTop, isTabletWidth } from '../components/AuthArt';

// The title takes focus once the screen has settled (after the alert's own
// announcement); Try again follows in reading order.
export const FOCUS_DELAY_MS = 300;

// UX A §Sign-in failed (phone) and §Tablet: Sign in failed (a 600 card).
// Behaviour (ND6 = today's code): Try again restarts the last Auth0 attempt;
// a cancelled sheet returns to Welcome silently (authService). An empty
// Auth0 message hides the second line; the alert title always shows.
export default function SignInFailedScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tablet = isTabletWidth(width);
  const signInError = useAuthStore((state) => state.signInError);
  const message = typeof signInError === 'string' ? signInError.trim() : '';
  const [retrying, setRetrying] = useState(false);
  const retryingRef = useRef(false);
  const mounted = useRef(true);
  const titleRef = useRef(null);

  useEffect(() => {
    mounted.current = true;
    const timer = setTimeout(() => {
      const node = findNodeHandle(titleRef.current);
      if (node) {
        AccessibilityInfo.setAccessibilityFocus(node);
      }
    }, FOCUS_DELAY_MS);
    return () => {
      mounted.current = false;
      clearTimeout(timer);
    };
  }, []);

  // Disabled (0.5) until the Auth0 sheet has opened; one launch at a time.
  const handleRetry = async () => {
    if (retryingRef.current) {
      return;
    }
    retryingRef.current = true;
    setRetrying(true);
    try {
      await retryLastAttempt();
    } finally {
      retryingRef.current = false;
      if (mounted.current) {
        setRetrying(false);
      }
    }
  };

  const title = (
    <Text
      ref={titleRef}
      testID="sign-in-failed-title"
      accessibilityRole="header"
      textBreakStrategy="simple"
      style={tablet ? styles.titleTablet : styles.title}
    >
      Sign-in failed
    </Text>
  );
  const alert = (
    <ErrorAlert
      testID="sign-in-failed-alert"
      title="Something went wrong"
      description={message || undefined}
      style={tablet ? styles.alertTablet : styles.alertPhone}
    />
  );
  const tryAgain = (
    <PillButton
      fullWidth={!tablet}
      size="cta"
      variant="primary"
      testID="sign-in-failed-try-again"
      title="Try again"
      disabled={retrying}
      onPress={handleRetry}
      style={tablet ? styles.tryAgainTablet : styles.tryAgainPhone}
    />
  );

  if (tablet) {
    return (
      <Screen glow={gradients.signInFailedGlowTablet} style={styles.screenTablet}>
        <ScrollView contentContainerStyle={styles.scrollTablet}>
          <TabletAuthCard testID="sign-in-failed-card" width={600}>
            <PadlockRing />
            <Text style={[styles.eyebrow, styles.eyebrowTablet]}>Sign-in</Text>
            {title}
            <Text style={styles.bodyTablet}>Auth0 rejected the login request.</Text>
            {alert}
            {tryAgain}
          </TabletAuthCard>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen glow={gradients.signInFailedGlow} style={styles.screenPhone}>
      <ScrollView contentContainerStyle={styles.scrollPhone}>
        <View testID="sign-in-failed-header" style={[styles.header, { marginTop: boardTop(180, 844, height, insets.top) }]}>
          <IconTile testID="sign-in-failed-icon" icon="circle-alert" color={colors.dangerText} backgroundColor={colors.dangerDotTintStrong} />
          <Text style={[styles.eyebrow, styles.eyebrowPhone]}>Sign-in</Text>
          {title}
          <Text style={styles.body}>Auth0 rejected the login request.</Text>
        </View>
        {alert}
        <View style={styles.spacer} />
        {tryAgain}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenPhone: {
    paddingHorizontal: 0,
    justifyContent: 'flex-start',
  },
  scrollPhone: {
    flexGrow: 1,
    paddingHorizontal: spacing[6],
    paddingBottom: 40,
  },
  header: {
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  eyebrow: {
    ...font(600),
    fontSize: 14,
    lineHeight: 20,
    color: colors.gold,
  },
  eyebrowPhone: {
    marginTop: spacing[3],
  },
  title: {
    ...font(700),
    fontSize: 40,
    lineHeight: 42,
    letterSpacing: -1.8,
    color: colors.textPrimary,
  },
  body: {
    ...typography.bodyLg,
    color: colors.textSecondary,
  },
  // Board: the surface card with the danger-dot edge, radius 20, padding 16.
  alertPhone: {
    marginTop: spacing[7],
    padding: spacing[4],
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderColor: colors.dangerDotBorderSoft,
  },
  // margin-top:auto on the board: the CTA sits at the bottom, at least 24
  // under the alert.
  spacer: {
    flexGrow: 1,
    minHeight: spacing[6],
  },
  tryAgainPhone: {},
  screenTablet: {
    paddingHorizontal: 0,
  },
  scrollTablet: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[8],
  },
  eyebrowTablet: {
    marginTop: spacing['1_5'],
  },
  titleTablet: {
    ...font(700),
    fontSize: 54,
    lineHeight: 56,
    letterSpacing: -2.7,
    color: colors.textPrimary,
  },
  bodyTablet: {
    ...font(400),
    fontSize: 18,
    lineHeight: 26,
    color: colors.textSecondary,
  },
  // Board: the tinted box (the kit's fill and edge), padding 20 22.
  alertTablet: {
    marginTop: spacing['1_5'],
    paddingVertical: spacing[5],
    paddingHorizontal: spacing['5_5'],
  },
  tryAgainTablet: {
    marginTop: spacing['2_5'],
    alignSelf: 'flex-start',
    paddingHorizontal: 40,
  },
});
