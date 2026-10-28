import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PillButton from '../../../shared/components/PillButton';
import Screen from '../../../shared/components/Screen';
import { ToastTone, addToast } from '../../../shared/components/toastStore';
import { colors, gradients, spacing, textScale, titleTracking, typography } from '../../../shared/theme/tokens';
import { login, signup, takeAccountDeletedNotice } from '../authService';
import { AuthStatus, useAuthStore } from '../authStore';
import { DISPLAY_TITLE_TEXT, GTile, WelcomeRings, boardTop, isTabletWidth } from '../components/AuthArt';

// RN-SPEC-profile P1b.6 (T-43, native only): the notice after Delete account.
const DELETED_NOTICE_MS = 6000;

// UX A §Welcome / §Tablet: Welcome (ruling ND1: the phone's ring art scaled
// up on the tablet, no photos). `block` is the bottom content's board height
// (brand row + gap + two buttons + gap); `title` is the title's line height
// and `button` the CTA height (the parts that grow with the text size).
export const PHONE = { art: 300, tile: 44, bottom: 40, title: 48, gap: 36, button: 60, block: 48 + 36 + 60 + 12 + 60 };
export const TABLET = { art: 480, tile: 64, bottom: 80, title: 84, gap: 44, button: 64, block: 84 + 44 + 64 + 12 + 64 };
const BOARD_FRAME = 844;
const BOARD_ART_TOP = 150;
const ART_MIN = 160;
const ART_GAP = 24;
const BUTTON_GAP = 12;
// The kit CTA label's line height (PillButton cta, 17/22).
const CTA_LABEL_LINE = 22;

// UX §9: the bottom block at this text size. The title scales up to
// textScale.display, the button labels up to textScale.body; a button grows
// only when its label no longer fits its board height.
export function welcomeBlock(board, fontScale = 1) {
  const titleRow = Math.max(board.tile, board.title * Math.min(fontScale, textScale.display));
  const button = Math.max(board.button, CTA_LABEL_LINE * Math.min(fontScale, textScale.body));
  return Math.ceil(titleRow + board.gap + 2 * button + BUTTON_GAP);
}

// The art keeps the board's place (150 of 844 from the top) and shrinks on
// short windows (small phones, tablet landscape) and at large text sizes so
// it never runs into the title.
export function welcomeArt({ tablet, width, height, insets, fontScale = 1 }) {
  const board = tablet ? TABLET : PHONE;
  const top = boardTop(BOARD_ART_TOP, BOARD_FRAME, height, insets.top, 0);
  const room = height - insets.top - insets.bottom - board.bottom - welcomeBlock(board, fontScale) - top - ART_GAP;
  const size = Math.max(ART_MIN, Math.min(board.art, room, width - 2 * spacing[6]));
  return { top, size };
}

// Signed-out entry point. Auth0 opens only when the user taps a button.
// Continuity (UX §7.1): splash (G tile) → Session loading (the same tile in
// its ring) → this screen, through the root stack's fade, on the same ground
// and gold glow, with the same solid G tile beside the title.
export default function WelcomeScreen() {
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tablet = isTabletWidth(width);
  const authenticating = useAuthStore((state) => state.status === AuthStatus.authenticating);
  const [launching, setLaunching] = useState(false);
  const launchingRef = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    if (takeAccountDeletedNotice()) {
      addToast(ToastTone.info, 'Your account has been deleted', 'Thanks for training with Gymido.', DELETED_NOTICE_MS);
    }
    return () => {
      mounted.current = false;
    };
  }, []);

  // While the Auth0 sheet is open both buttons are disabled (0.5) and another
  // tap does nothing (no double launch); no spinner: the sheet is the feedback.
  const launch = async (open) => {
    if (launchingRef.current || authenticating) {
      return;
    }
    launchingRef.current = true;
    setLaunching(true);
    try {
      await open();
    } finally {
      launchingRef.current = false;
      if (mounted.current) {
        setLaunching(false);
      }
    }
  };

  const busy = launching || authenticating;
  const art = welcomeArt({ tablet, width, height, insets, fontScale });

  return (
    <Screen glow={gradients.welcomeGlow} style={[styles.content, tablet ? styles.contentTablet : styles.contentPhone]}>
      <WelcomeRings size={art.size} style={[styles.art, { top: art.top }]} />
      <View testID="welcome-column" style={[styles.column, tablet && styles.columnTablet]}>
        <View style={[styles.brand, tablet && styles.brandTablet]}>
          <GTile size={tablet ? TABLET.tile : PHONE.tile} />
          <Text testID="welcome-title" accessibilityRole="header" {...DISPLAY_TITLE_TEXT} style={tablet ? styles.titleTablet : styles.title}>
            Gymido
          </Text>
        </View>
        <View testID="welcome-buttons" style={[styles.buttons, tablet && styles.buttonsTablet]}>
          <PillButton
            fullWidth
            size="cta"
            variant="primary"
            testID="welcome-log-in"
            title="Log in"
            disabled={busy}
            onPress={() => launch(login)}
            style={tablet && styles.buttonTablet}
          />
          <PillButton
            fullWidth
            size="cta"
            variant="secondary"
            testID="welcome-sign-up"
            title="Sign up"
            disabled={busy}
            onPress={() => launch(signup)}
            style={tablet && styles.buttonTablet}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: 'flex-end',
  },
  contentPhone: {
    paddingHorizontal: spacing[6],
    paddingBottom: PHONE.bottom,
  },
  contentTablet: {
    paddingHorizontal: 64,
    paddingBottom: TABLET.bottom,
  },
  art: {
    position: 'absolute',
    alignSelf: 'center',
  },
  column: {
    width: '100%',
  },
  // Tablet: a 480 column, centred in portrait and landscape [O2].
  columnTablet: {
    maxWidth: 480,
    alignSelf: 'center',
    alignItems: 'center',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  brandTablet: {
    gap: spacing[4],
  },
  // flexShrink: a long title wraps/shrinks beside the tile, never off screen.
  title: {
    ...typography.displayMd,
    lineHeight: PHONE.title,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  titleTablet: {
    ...typography.displayMd,
    fontSize: 84,
    lineHeight: TABLET.title,
    letterSpacing: titleTracking(84, -0.06),
    color: colors.textPrimary,
    flexShrink: 1,
  },
  buttons: {
    marginTop: 36,
    gap: spacing[3],
  },
  buttonsTablet: {
    marginTop: 44,
    alignSelf: 'stretch',
  },
  // The tablet board's 64 tall buttons (the kit's label stays 17).
  buttonTablet: {
    minHeight: 64,
  },
});
