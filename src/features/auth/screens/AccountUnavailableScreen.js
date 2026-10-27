import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, Text, View, findNodeHandle, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PillButton from '../../../shared/components/PillButton';
import Screen from '../../../shared/components/Screen';
import { colors, font, gradients, spacing } from '../../../shared/theme/tokens';
import { logout } from '../authService';
import { BODY_TEXT, DISPLAY_TITLE_TEXT, AccountArt, IconTile, TabletAuthCard, boardTop, isTabletWidth } from '../components/AuthArt';

export const TITLE = "We couldn't open your account";
export const FOCUS_DELAY_MS = 300;

// Shown when /auth/me fails after a valid Auth0 sign-in (any HTTP error
// response; offline/timeout soft-degrades instead, authService). UX A
// §Account unavailable (phone) and §Tablet: Account unavailable (a 620 card,
// ruling ND2: the GOLD Sign out). PM parity (26 Oct): Sign out takes the
// initial focus and is disabled while signing out (no double call); the title
// is announced once, politely.
export default function AccountUnavailableScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tablet = isTabletWidth(width);
  const [signingOut, setSigningOut] = useState(false);
  const signingOutRef = useRef(false);
  const mounted = useRef(true);
  const signOutRef = useRef(null);

  useEffect(() => {
    mounted.current = true;
    AccessibilityInfo.announceForAccessibility(TITLE);
    const timer = setTimeout(() => {
      const node = findNodeHandle(signOutRef.current);
      if (node) {
        AccessibilityInfo.setAccessibilityFocus(node);
      }
    }, FOCUS_DELAY_MS);
    return () => {
      mounted.current = false;
      clearTimeout(timer);
    };
  }, []);

  const handleSignOut = async () => {
    if (signingOutRef.current) {
      return;
    }
    signingOutRef.current = true;
    setSigningOut(true);
    try {
      await logout();
    } finally {
      signingOutRef.current = false;
      if (mounted.current) {
        setSigningOut(false);
      }
    }
  };

  const title = (
    <Text testID="account-unavailable-title" accessibilityRole="header" {...DISPLAY_TITLE_TEXT} style={tablet ? styles.titleTablet : styles.title}>
      {TITLE}
    </Text>
  );
  const body = (
    <Text {...BODY_TEXT} style={tablet ? styles.bodyTablet : styles.body}>
      You signed in, but this login isn't connected to a Gymido account. If you normally sign in with an email and
      password, sign out and use that instead.
    </Text>
  );
  const signOut = (
    <PillButton
      ref={signOutRef}
      fullWidth={!tablet}
      size="cta"
      variant="primary"
      testID="account-unavailable-sign-out"
      title="Sign out"
      disabled={signingOut}
      onPress={handleSignOut}
      style={tablet && styles.signOutTablet}
    />
  );

  if (tablet) {
    return (
      <Screen glow={gradients.accountGlowTablet} style={styles.screenTablet}>
        <ScrollView contentContainerStyle={styles.scrollTablet}>
          <TabletAuthCard testID="account-unavailable-card" width={620} cornerGlow={320}>
            <AccountArt />
            <Text {...BODY_TEXT} style={[styles.eyebrow, styles.eyebrowTablet]}>Account</Text>
            {title}
            {body}
            {signOut}
          </TabletAuthCard>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen glow={gradients.accountGlow} style={styles.screenPhone}>
      <ScrollView contentContainerStyle={styles.scrollPhone}>
        <View testID="account-unavailable-header" style={[styles.header, { marginTop: boardTop(180, 844, height, insets.top) }]}>
          <IconTile testID="account-unavailable-icon" icon="user-x" color={colors.gold} backgroundColor={colors.goldTint} />
          <Text {...BODY_TEXT} style={[styles.eyebrow, styles.eyebrowPhone]}>Account</Text>
          {title}
          {body}
        </View>
        <View style={styles.spacer} />
        {signOut}
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
    fontSize: 38,
    lineHeight: 40,
    letterSpacing: -1.71,
    color: colors.textPrimary,
  },
  body: {
    ...font(400),
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  // margin-top:auto on the board, at least 24 under the text.
  spacer: {
    flexGrow: 1,
    minHeight: spacing[6],
  },
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
    marginTop: spacing[1],
  },
  titleTablet: {
    ...font(700),
    fontSize: 46,
    lineHeight: 50,
    letterSpacing: -2.07,
    color: colors.textPrimary,
  },
  bodyTablet: {
    ...font(400),
    fontSize: 17,
    lineHeight: 27,
    color: colors.textSecondary,
  },
  signOutTablet: {
    marginTop: spacing['2_5'],
    alignSelf: 'flex-start',
    paddingHorizontal: 40,
  },
});
