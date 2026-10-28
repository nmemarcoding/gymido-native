import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BlurLayer from '../../../shared/components/BlurLayer';
import GradientFill from '../../../shared/components/GradientFill';
import PillButton from '../../../shared/components/PillButton';
import { NoGlow } from '../../../shared/components/glowScope';
import { CAP_BODY, DISPLAY_TITLE_TEXT, TITLE_TEXT, useLargeTextReflow } from '../../../shared/components/largeText';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { useSheetFocus } from '../../../shared/hooks/useSheetFocus';
import { breakpoints, colors, font, gradients, motion, radii, shadows, spacing, typography } from '../../../shared/theme/tokens';
import { PROMPT_SCRIM_BLUR } from './AlertSheet';
import { LeaveIcon, TrashIcon } from './SessionIcons';
import useForegroundBlur from './useForegroundBlur';

// F1 "Leave workout?" (phone sheet, tablet card). Discard moved to the
// AlertSheet DiscardDialog (RuntimeOverlays; review M4: one Discard shell).
// Phone: the ONE attached bottom sheet (UX batch-1 ruling 2, as AppModal's:
// flush to the sides and bottom, top radius 28, handle, the safe area inside),
// the verb first (ND6). Tablet (≥ 768): a centred card 520 wide, radius 32, the
// verb on the right (Stay · Leave, Keep going · Discard); past 1.3× text the
// pair stacks, the verb on top (UX §9 rule 4). Reduced motion: fade only.
export const SESSION_DIALOG_TABLET_WIDTH = 520;
const EASE_SPRING = Easing.bezier(...motion.easeSpring);

function SessionDialog({ open, onDismiss, dismissOnScrim, tone, title, body, verb, keep, testID }) {
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tablet = width >= breakpoints.md;
  const stacked = useLargeTextReflow();
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const keepRef = useRef(null);
  const { showBlur, blurKey } = useForegroundBlur();
  // Initial focus on the non-destructive action (F1 states).
  useSheetFocus(open, { initialRef: keepRef });

  useEffect(() => {
    if (!open) {
      progress.setValue(0);
      return undefined;
    }
    if (reducedMotion) {
      progress.setValue(1);
      return undefined;
    }
    const animation = Animated.timing(progress, { toValue: 1, duration: motion.durationSlow, easing: EASE_SPRING, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [open, progress, reducedMotion]);

  const danger = tone === 'danger';
  const row = tablet && !stacked;
  const motionStyle =
    tablet || reducedMotion
      ? { opacity: progress, transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [reducedMotion ? 1 : 0.95, 1] }) }] }
      : { transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }] };
  const verbButton = (
    <PillButton
      testID={verb.testID}
      title={verb.label}
      variant={danger ? 'danger' : 'light'}
      onPress={verb.onPress}
      fullWidth={!row}
      style={row ? styles.actionTablet : styles.action}
    />
  );
  const keepButton = (
    <PillButton
      ref={keepRef}
      testID={keep.testID}
      title={keep.label}
      variant="secondary"
      onPress={keep.onPress}
      fullWidth={!row}
      style={row ? styles.actionTablet : styles.action}
    />
  );
  return (
    <Modal transparent visible={open} animationType="none" onRequestClose={onDismiss} statusBarTranslucent>
      {/* T-86: no gold glow on a button inside a dialog / sheet. */}
      <NoGlow>
      <View style={[styles.host, tablet ? styles.hostTablet : styles.hostPhone, { paddingBottom: tablet ? spacing[6] : 0, paddingTop: insets.top + spacing[4] }]}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: progress }]}>
          {/* M5: the one prompt blur (8), drawn only in the foreground and
              remounted on return (useForegroundBlur, the A2 Android fix). */}
          {showBlur ? <BlurLayer key={blurKey} blurPx={PROMPT_SCRIM_BLUR} overApp /> : null}
          <View style={[StyleSheet.absoluteFill, styles.scrim]} />
        </Animated.View>
        <Pressable
          testID={`${testID}-scrim`}
          accessible={false}
          style={StyleSheet.absoluteFill}
          onPress={dismissOnScrim ? onDismiss : undefined}
        />
        <Animated.View
          testID={testID}
          accessibilityViewIsModal
          accessibilityLabel={title}
          style={[
            styles.card,
            tablet ? styles.cardTablet : [styles.cardPhone, { paddingBottom: spacing['5_5'] + insets.bottom }],
            tablet && danger && styles.cardTabletDanger,
            motionStyle,
          ]}
        >
          {tablet ? (
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.cardClip]}>
              <GradientFill angle={danger ? gradients.dangerCard.angle : gradients.card.angle} colors={danger ? gradients.dangerCard.colors : gradients.card.colors} />
            </View>
          ) : (
            <View testID={`${testID}-handle`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.handle} />
          )}
          {/* QA F1 (iOS): content remounts on a new text scale. */}
          <View key={`text-scale-${fontScale}`} style={tablet ? styles.contentTablet : styles.contentPhone}>
            <View style={[styles.iconTile, tablet && styles.iconTileTablet, { backgroundColor: danger ? colors.dangerTint : colors.goldTint }]}>
              {danger ? <TrashIcon size={tablet ? 32 : 26} color={colors.dangerText} /> : <LeaveIcon size={tablet ? 32 : 26} color={colors.gold} />}
            </View>
            <Text {...(tablet ? DISPLAY_TITLE_TEXT : TITLE_TEXT)} accessibilityRole="header" style={[styles.title, tablet && styles.titleTablet]}>
              {title}
            </Text>
            <Text {...CAP_BODY} style={[styles.body, tablet && styles.bodyTablet]}>
              {body}
            </Text>
            <View style={[styles.actions, row ? styles.actionsRow : styles.actionsColumn]}>
              {row ? (
                <>
                  {keepButton}
                  {verbButton}
                </>
              ) : (
                <>
                  {verbButton}
                  {keepButton}
                </>
              )}
            </View>
          </View>
        </Animated.View>
      </View>
      </NoGlow>
    </Modal>
  );
}

// Native "Leave workout?" (dated change 23 Oct): Leave = pop to Home, the
// session stays active; Stay, the scrim and system Back = close.
export function LeaveWorkoutDialog({ open, onStay, onLeave }) {
  return (
    <SessionDialog
      testID="leave-workout-dialog"
      open={open}
      onDismiss={onStay}
      dismissOnScrim
      tone="light"
      title="Leave workout?"
      body="Your workout stays saved. You can pick it up from Today."
      verb={{ testID: 'leave-workout-leave', label: 'Leave', onPress: onLeave }}
      keep={{ testID: 'leave-workout-stay', label: 'Stay', onPress: onStay }}
    />
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    alignItems: 'center',
  },
  hostPhone: {
    justifyContent: 'flex-end',
  },
  hostTablet: {
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
  },
  scrim: {
    backgroundColor: colors.scrim,
  },
  card: {
    width: '100%',
    borderColor: colors.hairlineStrong,
  },
  // Ruling 2: attached (AppModal's phone sheet): radius 28 28 0 0, a 1 px top
  // hairline, no side or bottom margin.
  cardPhone: {
    borderTopWidth: 1,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    backgroundColor: colors.surfaceCard2,
    paddingTop: 10,
    paddingHorizontal: spacing[5],
    // paddingBottom: 22 + the safe area, set inline.
    boxShadow: shadows.sheetUp,
  },
  cardTablet: {
    borderRadius: radii.xxxl,
    borderWidth: 1,
    maxWidth: SESSION_DIALOG_TABLET_WIDTH,
    padding: 36,
    boxShadow: shadows.sheet,
  },
  cardTabletDanger: {
    borderColor: colors.dangerLine,
  },
  cardClip: {
    borderRadius: radii.xxxl,
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: radii.full,
    backgroundColor: colors.grabHandle,
  },
  contentPhone: {
    alignItems: 'center',
  },
  contentTablet: {
    alignItems: 'flex-start',
  },
  iconTile: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing[5],
    borderRadius: radii.md,
  },
  iconTileTablet: {
    width: 72,
    height: 72,
    marginTop: 0,
    borderRadius: radii.lgPlus,
  },
  title: {
    ...typography.titleMd,
    marginTop: spacing[4],
    textAlign: 'center',
    color: colors.textPrimary,
  },
  titleTablet: {
    ...typography.titleXl,
    marginTop: spacing[5],
    textAlign: 'left',
  },
  body: {
    ...typography.body,
    maxWidth: 320,
    marginTop: spacing[2],
    textAlign: 'center',
    color: colors.textSecondary,
  },
  bodyTablet: {
    ...font(400),
    maxWidth: undefined,
    marginTop: spacing['2_5'],
    fontSize: 17,
    lineHeight: 26,
    textAlign: 'left',
  },
  actions: {
    alignSelf: 'stretch',
    gap: spacing['2_5'],
    marginTop: spacing[6],
  },
  actionsColumn: {
    flexDirection: 'column',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[7],
  },
  action: {
    minHeight: 56,
  },
  actionTablet: {
    flex: 1,
    minHeight: 62,
  },
});
