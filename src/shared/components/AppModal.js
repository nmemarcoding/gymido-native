import { Children, Fragment, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKeyboardHeight } from '../hooks/useKeyboardHeight';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { blur, breakpoints, colors, motion, radii, shadows, spacing, typography } from '../theme/tokens';
import BlurLayer from './BlurLayer';
import FeedbackIcon from './FeedbackIcon';
import { CAP_BODY, DISPLAY_TITLE_TEXT, TITLE_TEXT, useLargeTextReflow } from './largeText';
import ToastHost from './ToastHost';
import { useToastHostStore } from './toastStore';

// RN-SPEC-v2-foundation §6 + UX's dialog ruling (26 Oct).
// Phone (< 768): every dialog is a bottom sheet that slides up 300 ms
// ease-spring (no slide under reduced motion). Tablet (≥ 768): a centred card
// over the scrim; `entrance="pop"` pops it in with ease-pop.
const EASE_SPRING = Easing.bezier(...motion.easeSpring);
const EASE_POP = Easing.bezier(...motion.easePop);
// v1's dialog pop length (RuntimeOverlays POP), kept.
const POP_MS = 260;
// Tablet card widths (UX ruling: confirm 448, forms/pickers/sheets 520–640,
// rest 600). The v1 size prop maps to the closest one:
//   md  (v1 448) → 448  confirms, WeightLogModal, DeleteAccountDialog
//   lg  (v1 512) → 560  forms: AddDay, EditPlanDetails, ChangePassword, InviteClient (boards 540–560)
//   2xl (v1 672) → 600  AddSet, WorkoutDetail, WeightHistory (boards 560–580; "rest" 600)
// UX (26 Oct): tablet confirms and Weight log 520, Delete account 560 (lg).
export const TABLET_WIDTHS = Object.freeze({ md: 520, lg: 560, '2xl': 600 });
const TABLET_REST_WIDTH = 600;
const TABLET_MARGIN = spacing[6];
const SHEET_TOP_GAP = spacing[4];

export function isTabletWidth(width) {
  return width >= breakpoints.md;
}

// Trainer plans spec §A3.1. RN <Modal> gives the paired scroll lock for free;
// Android back and the scrim both call onClose.
// `hideClose` hides the tablet header Close while the dialog is busy (sending,
// done), as on web; the scrim/Back rules stay the caller's.
// `eyebrow` (optional, default none; RN-SPEC-v2-phase5 §1 M 3): shown ABOVE
// the title. A string is the gold eyebrow line (12/600, 6 above the title),
// e.g. the client's name on the tablet client modals; a node is rendered as
// given (the caller styles and hides it from AT as needed).
export default function AppModal({ isOpen, onClose, title, description, size = 'lg', footer, children, testID, entrance = 'slide', compact = false, hideClose = false, role, eyebrow, sheetTopGap = SHEET_TOP_GAP }) {
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tablet = isTabletWidth(width);
  const reducedMotion = useReducedMotion();
  const keyboardHeight = useKeyboardHeight();
  const keyboardOpen = keyboardHeight > 0;
  // An open keyboard replaces the bottom inset so the sheet / card stays above it.
  const bottomInset = keyboardOpen ? keyboardHeight : insets.bottom;
  const progress = useRef(new Animated.Value(0)).current;
  // BUG-N4: while open, this modal's window hosts the toasts (it sits above
  // the app-level ToastHost); the topmost open modal wins.
  const toastHostId = useRef(Symbol('modal-toast-host')).current;
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    useToastHostStore.getState().pushModalHost(toastHostId);
    return () => useToastHostStore.getState().popModalHost(toastHostId);
  }, [isOpen, toastHostId]);
  const pop = tablet && entrance === 'pop';

  useEffect(() => {
    if (!isOpen) {
      progress.setValue(0);
      return undefined;
    }
    if (reducedMotion) {
      progress.setValue(1);
      return undefined;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: pop ? POP_MS : motion.durationSlow,
      easing: pop ? EASE_POP : EASE_SPRING,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [isOpen, progress, reducedMotion, pop]);

  let motionStyle;
  if (!tablet) {
    // The sheet slides up from below the window; it does not fade.
    motionStyle = { transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }] };
  } else if (pop) {
    motionStyle = { opacity: progress, transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }] };
  } else {
    motionStyle = {
      opacity: progress,
      transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [motion.cardOffsetY, 0] }) }],
    };
  }

  const frame = tablet
    ? {
        scrim: { paddingTop: TABLET_MARGIN + insets.top, paddingBottom: TABLET_MARGIN + bottomInset },
        card: {
          maxWidth: TABLET_WIDTHS[size] ?? TABLET_REST_WIDTH,
          maxHeight: height - 2 * TABLET_MARGIN - insets.top - bottomInset,
        },
      }
    : {
        // C10 + §6 [O2]: the sheet hugs the bottom edge and pads the safe
        // area itself; an open keyboard lifts the whole sheet instead.
        scrim: { paddingTop: sheetTopGap + insets.top, paddingBottom: keyboardOpen ? keyboardHeight : 0 },
        card: {
          paddingBottom: spacing[6] + (keyboardOpen ? 0 : insets.bottom),
          maxHeight: height - sheetTopGap - insets.top - (keyboardOpen ? keyboardHeight : 0),
        },
      };

  const hasChildren = Children.toArray(children).length > 0;
  // UX Phase 1 review: with the keyboard open a phone sheet has little height,
  // and a fixed footer clipped the last field (the Unit select). The footer
  // then scrolls with the content, so the fields keep their full height.
  const footerInScroll = !tablet && keyboardOpen;
  const footerView = footer ? <View style={tablet ? styles.footerTablet : styles.footer}>{footer}</View> : null;

  return (
    <Modal transparent visible={isOpen} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View testID="app-modal-overlay" style={[styles.scrim, tablet ? styles.scrimTablet : styles.scrimPhone, frame.scrim]}>
        {/* UX §8.7 U12: the scrim blurs 4 on phones, 6 on tablets. */}
        <BlurLayer blurPx={tablet ? blur.scrimTablet : blur.scrim} overApp />
        <Pressable style={[StyleSheet.absoluteFill, styles.scrimColor]} onPress={onClose} accessibilityLabel="Close" />
        <Animated.View
          testID={testID}
          accessibilityViewIsModal
          accessibilityRole="none"
          // RN `role` (e.g. "alertdialog" for confirms; it isn't a valid
          // accessibilityRole). Unset unless a caller asks.
          role={role}
          accessibilityLabel={title}
          style={[styles.card, tablet ? styles.cardTablet : styles.cardPhone, frame.card, motionStyle]}
        >
          {/* QA F1, iOS (the ShellPage fix): after a live text-size change
              React's next commit lays out unchanged texts with their old
              measurements, so the dialog's content remounts on a new text
              scale. The Modal, its open state and the entrance progress live
              above this key and are kept; the caller's state is kept too. */}
          <Fragment key={`text-scale-${fontScale}`}>
            {tablet && !hideClose ? (
              // §6 tablet header Close (UX, 26 Oct): a 36 glass circle with a 44
              // hit area; the scrim and Back still close the dialog too.
              <Pressable
                testID="app-modal-close"
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={4}
                onPress={onClose}
                style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
              >
                <FeedbackIcon name="close" size={16} color={colors.textPrimary} />
              </Pressable>
            ) : null}
            {tablet ? null : (
              <View
                testID="app-modal-grab-handle"
                style={styles.grabHandle}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              />
            )}
            <ScrollView
              style={styles.scroll}
              overScrollMode="never"
              bounces={false}
              keyboardShouldPersistTaps="handled"
            >
              {typeof eyebrow === 'string' && eyebrow ? (
                <Text {...CAP_BODY} testID="app-modal-eyebrow" style={[styles.eyebrow, tablet && styles.eyebrowTablet]}>
                  {eyebrow}
                </Text>
              ) : null}
              {eyebrow && typeof eyebrow !== 'string' ? <View testID="app-modal-eyebrow">{eyebrow}</View> : null}
              {/* UX §9 title rule: the phone title is title-sm (1.6× cap), the
                  tablet one is 34 px, a page-size title (1.3× cap); both wrap by
                  word, max 3 lines, and a long word shrinks. */}
              <Text {...(tablet ? DISPLAY_TITLE_TEXT : TITLE_TEXT)} accessibilityRole="header" style={tablet ? styles.titleTablet : styles.title}>
                {title}
              </Text>
              {description ? (
                <Text {...CAP_BODY} style={[styles.description, tablet && !compact && styles.descriptionTablet, tablet && styles.descriptionTabletGap]}>
                  {description}
                </Text>
              ) : null}
              {hasChildren ? <View style={tablet ? styles.childrenTablet : styles.children}>{children}</View> : null}
              {footerInScroll ? footerView : null}
            </ScrollView>
            {footerInScroll ? null : footerView}
          </Fragment>
        </Animated.View>
      </View>
      <ToastHost hostId={toastHostId} />
    </Modal>
  );
}

// Footer actions of the dialogs: children are [Cancel, verb]. Phone: stacked
// full width, the verb on top (column-reverse). Tablet: a row at the right,
// Cancel left, the verb right (§6).
// UX §9 rule 4: past 1.3× the tablet row stacks too, like the phone column
// (primary on top, both full width).
// `fill`: in the tablet row the actions share the width equally (boards that
// draw flex:1 buttons, e.g. Change password, or one full-width Done).
export function ModalActions({ children, fill = false }) {
  const { width } = useWindowDimensions();
  const stacked = useLargeTextReflow();
  const row = isTabletWidth(width) && !stacked;
  const items =
    row && fill
      ? Children.toArray(children).map((child, index) => (
          <View key={child?.key ?? index} testID="modal-actions-fill" style={styles.actionFill}>
            {child}
          </View>
        ))
      : children;
  return <View style={row ? styles.actionsTablet : styles.actionsPhone}>{items}</View>;
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    alignItems: 'center',
  },
  scrimColor: {
    backgroundColor: colors.scrim,
  },
  scrimPhone: {
    justifyContent: 'flex-end',
  },
  scrimTablet: {
    justifyContent: 'center',
    paddingHorizontal: TABLET_MARGIN,
  },
  card: {
    width: '100%',
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.hairlineStrong,
    overflow: 'hidden',
  },
  // §6 bottom sheet: radius 28 28 0 0, 1 px top hairline, padding 12 22 24.
  // UX §8.7 U11: every bottom sheet casts shadow-sheet-up.
  cardPhone: {
    boxShadow: shadows.sheetUp,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    borderTopWidth: 1,
    paddingTop: spacing[3],
    paddingHorizontal: spacing['5_5'],
  },
  // §6 modal ≥ 768: radius 28, 1 px hairline all round.
  // §5 / §8.6: a centred dialog casts shadow-sheet.
  cardTablet: {
    boxShadow: shadows.sheet,
    borderRadius: radii.xxl,
    borderWidth: 1,
    padding: spacing[8],
  },
  grabHandle: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: radii.full,
    backgroundColor: colors.grabHandle,
    marginBottom: spacing[4],
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  eyebrow: {
    ...typography.eyebrow,
    marginBottom: spacing['1_5'],
  },
  // Clear of the tablet Close, like the title.
  eyebrowTablet: {
    paddingRight: 48,
  },
  title: {
    ...typography.titleSm,
    color: colors.textPrimary,
  },
  // Tablet dialog title 34/38 (UX, 26 Oct: the boards' 34–40 range),
  // clear of the Close button.
  titleTablet: {
    ...typography.titleXl,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -1.36,
    color: colors.textPrimary,
    paddingRight: 48,
  },
  close: {
    position: 'absolute',
    top: spacing[6],
    right: spacing[6],
    zIndex: 1,
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: colors.fillSkeleton,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closePressed: {
    backgroundColor: colors.hairlineButton,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing['1_5'],
  },
  descriptionTablet: {
    ...typography.bodyLg,
  },
  descriptionTabletGap: {
    marginTop: spacing['2_5'],
  },
  children: {
    gap: spacing[3],
    marginTop: spacing[4],
  },
  childrenTablet: {
    gap: spacing[4],
    marginTop: spacing[6],
  },
  footer: {
    flexShrink: 0,
    paddingTop: spacing[5],
  },
  footerTablet: {
    flexShrink: 0,
    paddingTop: spacing[7],
  },
  actionsPhone: {
    flexDirection: 'column-reverse',
    gap: spacing[2],
  },
  actionsTablet: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing[3],
  },
  actionFill: {
    flex: 1,
  },
});
