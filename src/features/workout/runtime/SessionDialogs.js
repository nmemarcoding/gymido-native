import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BlurLayer from '../../../shared/components/BlurLayer';
import GradientFill from '../../../shared/components/GradientFill';
import PillButton from '../../../shared/components/PillButton';
import { CAP_BODY, DISPLAY_TITLE_TEXT, TITLE_TEXT, useLargeTextReflow } from '../../../shared/components/largeText';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { useSheetFocus } from '../../../shared/hooks/useSheetFocus';
import { blur, breakpoints, colors, font, gradients, motion, radii, shadows, spacing, typography } from '../../../shared/theme/tokens';
import { LeaveIcon, TrashIcon } from './SessionIcons';

// F1 "Leave workout?" / "Discard workout?" (phone sheets, tablet cards).
// Phone: a floating sheet 10 from the edges (+ safe area), radius 32, the
// verb first (ND6). Tablet (≥ 768): a centred card 520 wide, radius 32, the
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
      <View style={[styles.host, tablet ? styles.hostTablet : styles.hostPhone, { paddingBottom: tablet ? spacing[6] : 10 + insets.bottom, paddingTop: insets.top + spacing[4] }]}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: progress }]}>
          <BlurLayer blurPx={tablet ? blur.scrimTablet : blur.scrim} overApp />
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
          style={[styles.card, tablet ? styles.cardTablet : styles.cardPhone, tablet && danger && styles.cardTabletDanger, motionStyle]}
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
    </Modal>
  );
}

// §24 Discard: Android Back = Keep going; no scrim dismiss (code).
export function DiscardWorkoutDialog({ open, onKeep, onDiscard }) {
  return (
    <SessionDialog
      testID="discard-dialog"
      open={open}
      onDismiss={onKeep}
      dismissOnScrim={false}
      tone="danger"
      title="Discard this workout?"
      body="Your progress won't be saved and this session will be discarded."
      verb={{ testID: 'discard-confirm', label: 'Discard', onPress: onDiscard }}
      keep={{ testID: 'discard-keep', label: 'Keep going', onPress: onKeep }}
    />
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
    paddingHorizontal: 10,
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
    borderRadius: radii.xxxl,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  cardPhone: {
    backgroundColor: colors.surfaceCard2,
    paddingTop: 10,
    paddingHorizontal: spacing[5],
    paddingBottom: spacing['5_5'],
    boxShadow: shadows.sheetUp,
  },
  cardTablet: {
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
