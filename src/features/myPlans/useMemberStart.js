import { CommonActions, useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { routes } from '../../navigation/routes';
import ConfirmDialog from '../../shared/components/ConfirmDialog';
import PillButton from '../../shared/components/PillButton';
import { ToastTone, addToast } from '../../shared/components/toastStore';
import { colors, radii } from '../../shared/theme/tokens';
import { openShellPath } from '../shell/shellLinks';
import { cancelEnrollment, getCurrentPlan, startPlan } from './api/myPlansApi';
import { statusBoxStyles } from './components/OnHoldBox';
import { canStartPlan, getStartHint, isCurrentPlan, runStartPlan } from './myPlanFormat';

const START_API = { cancelEnrollment, startPlan };

// §M3.4 "Start this plan": the member adapter's extension of the shared plan
// screen. Returns the header action, the banner area and the confirm dialog.
export function useMemberStart({ planId, plan, days }) {
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

  // Replace M3 with Workout in the Today stack carrying the message, as S2's
  // hand-off does (5-tab nav): drop M3 from the Plans stack, then open Workout.
  function handOff(message) {
    const state = navigation.getState();
    const remaining = state.routes.filter((item) => item.key !== route.key);
    openShellPath('/workout', { message });
    navigation.dispatch({
      ...CommonActions.reset({ ...state, routes: remaining, index: remaining.length - 1 }),
      target: state.key,
    });
  }

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
      handOff(outcome.message);
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
      loading={starting}
      disabled={!canStartPlan(plan, days)}
      onPress={pressStart}
    />
  );

  const banners = (
    <>
      {hint === 'current' ? (
        <View testID="my-plan-current" accessibilityRole="summary" style={statusBoxStyles.box}>
          <Text style={statusBoxStyles.title}>This is your current plan</Text>
          <Text style={statusBoxStyles.body}>
            Edits apply from your next workout.{' '}
            <Text
              testID="my-plan-change-days"
              accessibilityRole="link"
              style={styles.link}
              onPress={() => navigation.push(routes.PlanDetail, { planId: String(planId) })}
            >
              Change training days
            </Text>
          </Text>
        </View>
      ) : null}
      {hint === 'inactive' ? <Text style={styles.hint}>Activate this plan to start it.</Text> : null}
      {hint === 'noDays' ? <Text style={styles.hint}>Add a day to start this plan.</Text> : null}
      {startError ? (
        <View testID="my-plan-start-error" accessibilityRole="alert" style={styles.errorBox}>
          <Text style={styles.errorTitle}>Could not start this plan</Text>
          <Text style={styles.errorBody}>{startError}</Text>
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

const styles = StyleSheet.create({
  link: {
    fontWeight: '700',
    color: colors.brand700,
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  errorBox: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.errorFill,
    padding: 16,
  },
  errorTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  errorBody: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 24,
    color: colors.errorText,
  },
});
