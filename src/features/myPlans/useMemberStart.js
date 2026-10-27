import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { routes } from '../../navigation/routes';
import ConfirmDialog from '../../shared/components/ConfirmDialog';
import { CAP_BODY } from '../../shared/components/largeText';
import PillButton from '../../shared/components/PillButton';
import { ToastTone, addToast } from '../../shared/components/toastStore';
import { colors, font, radii, spacing } from '../../shared/theme/tokens';
import { StatusBox, builderStyles } from '../trainer/plans/components/builderParts';
import { handOffToWorkout } from '../shell/shellLinks';
import { cancelEnrollment, getCurrentPlan, startPlan } from './api/myPlansApi';
import { canStartPlan, getStartHint, isCurrentPlan, runStartPlan } from './myPlanFormat';

const START_API = { cancelEnrollment, startPlan };

// §M3.4 "Start this plan": the member adapter's extension of the shared plan
// screen. Returns the header action, the banner area and the confirm dialog.
// v2 look (UX phase4 I §1-2): the gold "Start this plan" (phone 52, flex 1
// in the action row; tablet the 44 compact pill), the neutral status box for
// the current plan, the 14 secondary hints, the danger-tint inline error.
export function useMemberStart({ planId, plan, days, tablet = false }) {
  const navigation = useNavigation();
  const route = useRoute();
  const mounted = useRef(true);
  // Lifecycle pairing: looked up once per mount and never refreshed, so the
  // banner reflects the mount-time lookup. The only local change: a cancel
  // that went through drops the old enrollment (it never was this plan, so
  // the banner is unaffected).
  const [current, setCurrent] = useState(null);
  const [starting, setStarting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Set by a failed start, cleared only by the next attempt or a remount (⚠M-3).
  const [startError, setStartError] = useState('');

  useEffect(() => {
    mounted.current = true;
    // 404 or any failure → "no current plan", silently (⚠M-1).
    getCurrentPlan()
      .then((value) => mounted.current && setCurrent(value ?? null))
      .catch(() => mounted.current && setCurrent(null));
    return () => {
      mounted.current = false;
    };
  }, []);

  const enrollment = current?.enrollment ?? null;
  const isCurrent = isCurrentPlan(current, planId);
  const hint = getStartHint({ isCurrent, plan, days });


  async function start() {
    setStarting(true);
    setStartError('');
    const outcome = await runStartPlan({ planId, planName: plan?.name, enrollment, api: START_API });
    // The old enrollment is gone even if the enrol failed: the next attempt
    // starts directly instead of cancelling it again (no remount needed).
    if (outcome.cancelled && mounted.current) {
      setCurrent(null);
    }
    if (outcome.type === 'success') {
      handOffToWorkout(navigation, route, outcome.message);
    } else if (outcome.type === 'inline') {
      if (mounted.current) {
        setStartError(outcome.message);
      }
    } else {
      addToast(ToastTone.error, 'Could not start this plan', outcome.message);
    }
    if (mounted.current) {
      setStarting(false);
      setConfirmOpen(false);
    }
  }

  function pressStart() {
    // D2: confirm only when a current enrollment is known.
    if (enrollment) {
      setConfirmOpen(true);
    } else {
      start();
    }
  }

  const headerActions = isCurrent ? null : (
    <PillButton
      testID="my-plan-start"
      title="Start this plan"
      size={tablet ? 'compact' : 'default'}
      fullWidth={!tablet}
      loading={starting}
      disabled={!canStartPlan(plan, days)}
      onPress={pressStart}
    />
  );

  const banners = (
    <>
      {hint === 'current' ? (
        <StatusBox testID="my-plan-current" accessibilityRole="summary" title="This is your current plan">
          <Text {...CAP_BODY} style={builderStyles.statusBody}>
            Edits apply from your next workout.{' '}
            <Text
              testID="my-plan-change-days"
              accessibilityRole="link"
              style={builderStyles.link}
              onPress={() => navigation.push(routes.PlanDetail, { planId: String(planId) })}
            >
              Change training days
            </Text>
          </Text>
        </StatusBox>
      ) : null}
      {hint === 'inactive' ? (
        <Text {...CAP_BODY} style={builderStyles.hint}>
          Activate this plan to start it.
        </Text>
      ) : null}
      {hint === 'noDays' ? (
        <Text {...CAP_BODY} style={builderStyles.hint}>
          Add a day to start this plan.
        </Text>
      ) : null}
      {startError ? (
        <View testID="my-plan-start-error" accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.errorBox}>
          <Text {...CAP_BODY} style={styles.errorTitle}>
            Could not start this plan
          </Text>
          <Text {...CAP_BODY} style={styles.errorBody}>
            {startError}
          </Text>
        </View>
      ) : null}
    </>
  );

  const overlays = (
    <ConfirmDialog
      testID="my-plan-switch-dialog"
      isOpen={confirmOpen}
      onClose={() => setConfirmOpen(false)}
      onConfirm={start}
      title="Switch to this plan?"
      description="Your current plan ends; its history is kept."
      confirmLabel="Switch plan"
      tone="primary"
      // ⚠M-2: the header button spins too.
      loading={starting}
    />
  );

  return { headerActions, banners, overlays };
}

// UX phase4 I "Inline start error": radius 20, danger-dot 8 % + 30 % edge;
// "Could not start this plan" 14/700 + the server text 14/22 danger-text.
const styles = StyleSheet.create({
  errorBox: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.dangerDotBorder,
    backgroundColor: colors.dangerDotTint,
    padding: spacing[4],
  },
  errorTitle: {
    ...font(700),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  errorBody: {
    ...font(400),
    marginTop: spacing[1],
    fontSize: 14,
    lineHeight: 22,
    color: colors.dangerText,
  },
});
