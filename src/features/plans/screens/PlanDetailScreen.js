import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { routes } from '../../../navigation/routes';
import { getServerMessage, getStatus } from '../../../shared/api/apiError';
import Loader from '../../../shared/components/Loader';
import RemoteImage from '../../../shared/components/RemoteImage';
import Spinner from '../../../shared/components/Spinner';
import { InlineToast } from '../../../shared/components/ToastHost';
import { ToastTone } from '../../../shared/components/toastStore';
import { useFocusRemountKey } from '../../../shared/hooks/useFocusRemountKey';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { breakpoints, colors, radii, shadows } from '../../../shared/theme/tokens';
import { formatLocalDateForInput } from '../../../shared/time/format';
import CopyToMyPlansCard from '../../myPlans/components/CopyToMyPlansCard';
import ShellPage from '../../shell/ShellPage';
import { handOffToWorkout, openShellPath } from '../../shell/shellLinks';
import { getMuscleTileColors } from '../../trainer/plans/components/ExerciseThumb';
import { DumbbellIcon } from '../../trainer/plans/components/pickerIcons';
import {
  cancelEnrollment,
  createSchedule,
  enrollInPlan,
  getCurrentPlan,
  getPlan,
  listDayExercises,
  listPlanDays,
  replaceSchedule,
} from '../api/libraryApi';
import { ActiveBadge, Eyebrow, Pill, SectionHeading, planStyles } from '../components/PlanBits';
import WeekdayGrid from '../components/WeekdayGrid';
import {
  buildScheduleItems,
  dayMetaLabel,
  estimateMinutes,
  exerciseDetailId,
  exerciseNotes,
  formatSetSummary,
  initialWeekdays,
  muscleFocus,
  toggleWeekday,
  workoutDaysLabel,
} from '../libraryFormat';

const EASE = Easing.bezier(0.4, 0, 0.2, 1);

// S2 (RN-SPEC-plans §4). Every focus remounts and reloads (§8.1).
export default function PlanDetailScreen() {
  const remountKey = useFocusRemountKey();
  return (
    <ShellPage testID="plan-detail-screen">
      <PlanDetail key={remountKey} />
    </ShellPage>
  );
}

function PlanDetail() {
  const navigation = useNavigation();
  const route = useRoute();
  const planId = route.params?.planId;
  const [load, setLoad] = useState({ status: 'loading' });
  const [selectedDayId, setSelectedDayId] = useState(null);
  const [selectedWeekdays, setSelectedWeekdays] = useState([]);
  const [activationError, setActivationError] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [lockedEnrollmentId, setLockedEnrollmentId] = useState(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // §4.2: everything is allSettled, so no single failure fails the page (⚠8).
  useEffect(() => {
    let alive = true;
    (async () => {
      const [planResult, daysResult, currentResult] = await Promise.allSettled([
        getPlan(planId),
        listPlanDays(planId),
        getCurrentPlan(),
      ]);
      const current = currentResult.status === 'fulfilled' ? currentResult.value : null;
      const days = daysResult.status === 'fulfilled' ? daysResult.value : [];
      const exerciseResults = await Promise.allSettled(days.map((day) => listDayExercises(planId, day.id)));
      if (!alive) {
        return;
      }
      const exercisesByDay = {};
      days.forEach((day, index) => {
        const result = exerciseResults[index];
        exercisesByDay[day.id] = result.status === 'fulfilled' ? result.value : [];
      });
      const value = planResult.status === 'fulfilled' ? planResult.value : null;
      const matchingPlan = value ? value.plan || value : null;
      const enrolledPlan =
        Number(current?.enrollment?.workout_plan_id) === Number(planId) ? current.enrollment.plan : null;
      const plan = matchingPlan || enrolledPlan;
      const requiredDays = days.length;
      // M5: only a plan the public endpoint returned can be copied.
      const isPublic = planResult.status === 'fulfilled';
      setLoad({ status: 'loaded', plan, days, exercisesByDay, current, requiredDays, isPublic });
      setSelectedDayId(days[0]?.id ?? null);
      setSelectedWeekdays(initialWeekdays({ currentPlan: current, plan, requiredDays }));
    })();
    return () => {
      alive = false;
    };
  }, [planId]);

  if (load.status === 'loading') {
    return <Loader label="Loading plan" />;
  }

  const { plan, days, exercisesByDay, current, requiredDays, isPublic } = load;
  // ⚠8: compared literally, so no enrollment and no plan is `undefined === undefined`.
  const isCurrentPlan = current?.enrollment?.plan?.id === plan?.id;
  const currentEnrollmentId = current?.enrollment?.id;
  const isTrainerLocked = lockedEnrollmentId !== null && lockedEnrollmentId === current?.enrollment?.id;
  const totalExercises = days.reduce((sum, day) => sum + (exercisesByDay[day.id]?.length ?? 0), 0);
  const difficulty = plan?.difficulty_level?.name;


  // §4.7, exactly.
  async function handleActivate() {
    setActivationError('');
    if (selectedWeekdays.length !== requiredDays) {
      setActivationError(`Select ${workoutDaysLabel(requiredDays)} to continue.`);
      return;
    }
    setIsActivating(true);
    const items = buildScheduleItems(days, selectedWeekdays, requiredDays);
    const name = plan?.name || 'Plan';
    try {
      if (isCurrentPlan && currentEnrollmentId) {
        await replaceSchedule(currentEnrollmentId, items);
        handOffToWorkout(navigation, route, `${name} schedule updated.`);
        return;
      }
      if (currentEnrollmentId) {
        try {
          await cancelEnrollment(currentEnrollmentId);
          // The old enrollment is gone even if the enrol below fails: a retry
          // starts directly instead of cancelling it again (as M3 does).
          if (mounted.current) {
            setLoad((previous) => ({ ...previous, current: null }));
          }
        } catch (error) {
          if (getStatus(error) === 409) {
            if (mounted.current) {
              setLockedEnrollmentId(currentEnrollmentId);
              setActivationError(getServerMessage(error));
            }
            return;
          }
          throw error;
        }
      }
      const created = await enrollInPlan({ workout_plan_id: Number(planId), started_on: formatLocalDateForInput() });
      const enrollmentId = created.enrollment?.id ?? created.id;
      try {
        await createSchedule(enrollmentId, items);
      } catch (error) {
        if (getStatus(error) !== 409) {
          throw error;
        }
        await replaceSchedule(enrollmentId, items);
      }
      handOffToWorkout(navigation, route, `${name} activated.`);
    } catch (error) {
      if (mounted.current) {
        setActivationError(getServerMessage(error));
      }
    } finally {
      if (mounted.current) {
        setIsActivating(false);
      }
    }
  }

  return (
    <View style={styles.page}>
      <View style={styles.topBar}>
        <Pressable
          testID="plan-detail-back"
          accessibilityRole="link"
          accessibilityLabel="Plans"
          onPress={() => navigation.push(routes.PlansLibrary)}
          style={styles.backLink}
        >
          {({ pressed }) => (
            <>
              <Text style={[styles.backGlyph, pressed && styles.backPressed]}>‹</Text>
              <Text style={[styles.backLabel, pressed && styles.backPressed]}>Plans</Text>
            </>
          )}
        </Pressable>
        {isCurrentPlan ? <ActiveBadge testID="plan-detail-current" label="Current plan" /> : null}
      </View>

      <View style={[planStyles.card, styles.summary]}>
        <Eyebrow>{plan?.category?.name || 'Workout plan'}</Eyebrow>
        <Text accessibilityRole="header" textBreakStrategy="simple" style={[planStyles.title2xl, styles.mt6]}>
          {plan?.name}
        </Text>
        {plan?.description ? (
          <Text numberOfLines={3} ellipsizeMode="tail" style={[planStyles.body, styles.mt8]}>
            {plan.description}
          </Text>
        ) : null}
        <View style={styles.stats}>
          <Stat value={days.length} label="Days" />
          <Stat value={totalExercises} label="Exercises" divider />
          <Stat value={difficulty || '—'} label="Level" divider text />
        </View>
        <View style={styles.pillRow}>
          <Pill>{`${days.length}× / week`}</Pill>
        </View>
      </View>

      <View>
        <SectionHeading style={styles.daysHeading}>Workout days</SectionHeading>
        <View style={styles.dayList}>
          {days.map((day) => (
            <DayRow
              key={day.id}
              day={day}
              exercises={exercisesByDay[day.id] ?? []}
              isOpen={selectedDayId === day.id}
              onToggle={() => setSelectedDayId((open) => (open === day.id ? null : day.id))}
              onOpenExercise={(item) => navigation.push(routes.ExerciseDetail, { exerciseId: String(exerciseDetailId(item)) })}
            />
          ))}
        </View>
      </View>

      <View>
        {activationError ? (
          <InlineToast
            testID="plan-activation-error"
            tone={ToastTone.error}
            title="Plan activation failed"
            message={activationError}
            style={styles.toast}
          />
        ) : null}
        {isTrainerLocked ? <TrainerLockBanner /> : null}
        <ScheduleCard
          isCurrentPlan={isCurrentPlan}
          requiredDays={requiredDays}
          selected={selectedWeekdays}
          onToggle={(id) => setSelectedWeekdays((selected) => toggleWeekday(selected, id, requiredDays))}
          isActivating={isActivating}
          disabled={isActivating || (isTrainerLocked && !isCurrentPlan)}
          onSubmit={handleActivate}
        />
        {isPublic ? <CopyToMyPlansCard planId={planId} style={styles.copyCard} /> : null}
      </View>
    </View>
  );
}

// Batch A (A4): a text value (Level) is 13px / 800 on up to 2 lines, never a
// 1-line truncation; numeric values are unchanged.
function Stat({ value, label, divider = false, text = false }) {
  return (
    <View style={[styles.stat, divider && styles.statDivider]}>
      <Text textBreakStrategy="simple" numberOfLines={text ? 2 : undefined} style={[styles.statValue, text && styles.statValueText]}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// §4.4: accordion row; content appears instantly, the chevron turns in 200 ms.
function DayRow({ day, exercises, isOpen, onToggle, onOpenExercise }) {
  const reducedMotion = useReducedMotion();
  const turn = useRef(new Animated.Value(isOpen ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion) {
      turn.setValue(isOpen ? 1 : 0);
      return undefined;
    }
    const animation = Animated.timing(turn, { toValue: isOpen ? 1 : 0, duration: 200, easing: EASE, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [isOpen, reducedMotion, turn]);

  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const minutes = estimateMinutes(exercises);
  const focus = muscleFocus(exercises).slice(0, 3);
  const title = day.title || `Day ${day.day_number}`;

  return (
    <View testID={`plan-day-${day.id}`} style={[planStyles.card, styles.dayCard]}>
      <Pressable
        testID={`plan-day-toggle-${day.id}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        onPress={onToggle}
        style={({ pressed }) => [styles.dayHeader, pressed && styles.dayHeaderPressed]}
      >
        <View style={styles.dayHeaderLeft}>
          <View style={[styles.dayNumber, isOpen ? styles.dayNumberOpen : styles.dayNumberClosed]}>
            <Text numberOfLines={1} textBreakStrategy="simple" style={[styles.dayNumberText, { color: isOpen ? colors.navy : colors.textSecondary }]}>
              {day.day_number || '•'}
            </Text>
          </View>
          <View style={styles.textColumn}>
            <Text numberOfLines={1} style={styles.dayTitle}>
              {title}
            </Text>
            <Text style={planStyles.meta}>{dayMetaLabel(exercises.length, minutes)}</Text>
          </View>
        </View>
        <Animated.Text style={[styles.chevron, { transform: [{ rotate }] }]} accessibilityElementsHidden importantForAccessibility="no">
          ⌄
        </Animated.Text>
      </Pressable>
      {isOpen ? (
        <View style={styles.dayBody}>
          {focus.length ? (
            <View style={styles.focusRow}>
              {focus.map((name) => (
                <View key={name} style={styles.focusChip}>
                  <Text style={styles.focusText}>{name}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <View style={styles.exerciseList}>
            {exercises.map((item, index) => (
              <ExerciseRow key={item.id} item={item} position={index + 1} onPress={() => onOpenExercise(item)} />
            ))}
            {exercises.length === 0 ? (
              <View style={styles.emptyDay}>
                <Text style={styles.emptyDayText}>{`No exercises were returned for ${day.title || 'this day'}.`}</Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

// §4.4 ExerciseRow with the exercise photo (owner, 23 Oct; UX row spec
// R1–R7): a thumbnail well with the order badge, or the C11 colour tile with
// a dumbbell (no text, so nothing overflows), also once every image
// candidate has failed (R3); notes span the full row.
export function ExerciseRow({ item, position, onPress }) {
  const { width } = useWindowDimensions();
  const wide = width >= breakpoints.sm;
  const notes = exerciseNotes(item);
  const exercise = item.exercise ?? {};
  const muscle = exercise.primary_muscle_group?.name;
  const summary = formatSetSummary(item);
  const [imageFailed, setImageFailed] = useState(false);
  const url = imageFailed ? null : exercise.thumbnail?.url;
  const [tileColor, iconColor] = getMuscleTileColors(exercise.primary_muscle_group?.code);
  const well = wide ? styles.wellWide : styles.wellPhone;

  return (
    <Pressable
      testID={`plan-exercise-${item.id}`}
      accessibilityRole="link"
      accessibilityLabel={[`Exercise ${position}: ${exercise.name ?? ''}`, muscle, summary].filter(Boolean).join(', ')}
      onPress={onPress}
      style={({ pressed }) => [styles.exerciseRow, pressed && styles.exerciseRowPressed]}
    >
      <View style={styles.exerciseTop}>
        <View
          style={[styles.well, well, !url && { backgroundColor: tileColor }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {url ? (
            <RemoteImage url={url} style={styles.wellImage} onExhausted={() => setImageFailed(true)} />
          ) : (
            <DumbbellIcon color={iconColor} size={wide ? 28 : 24} />
          )}
          <View style={styles.orderBadge}>
            <Text numberOfLines={1} textBreakStrategy="simple" style={styles.orderText}>{position}</Text>
          </View>
        </View>
        <View style={styles.textColumn}>
          <Text textBreakStrategy="simple" numberOfLines={2} ellipsizeMode="tail" style={styles.exerciseName}>
            {exercise.name}
          </Text>
          {muscle ? (
            <Text numberOfLines={1} style={styles.exerciseMuscle}>
              {muscle}
            </Text>
          ) : null}
          <Text style={styles.setSummary}>{summary}</Text>
        </View>
        <View style={[styles.chevronBox, { height: wide ? 80 : 64 }]} accessibilityElementsHidden importantForAccessibility="no">
          <Text style={styles.rowChevron}>›</Text>
        </View>
      </View>
      {notes ? <Text style={styles.exerciseNotes}>{notes}</Text> : null}
    </Pressable>
  );
}

// §4.5
function TrainerLockBanner() {
  const [pressed, setPressed] = useState(false);
  return (
    <View testID="plan-trainer-lock" accessibilityRole="text" style={styles.lockBanner}>
      <Text style={styles.lockTitle}>This plan is managed by your trainer</Text>
      <Text style={styles.lockBody}>
        You can’t switch plans while your trainer is coaching you. Your workouts, progress and training days all still
        work as normal — end coaching from{' '}
        <Text
          testID="plan-trainer-lock-link"
          accessibilityRole="link"
          onPress={() => openShellPath('/my-trainer')}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          style={[styles.lockLink, pressed && styles.lockLinkPressed]}
        >
          My trainer
        </Text>{' '}
        if you want your plan back.
      </Text>
    </View>
  );
}

// §4.6
function ScheduleCard({ isCurrentPlan, requiredDays, selected, onToggle, isActivating, disabled, onSubmit }) {
  return (
    <View testID="plan-schedule-card" style={[planStyles.card, styles.scheduleCard]}>
      <Eyebrow>{isCurrentPlan ? 'Schedule' : 'Start this plan'}</Eyebrow>
      <Text textBreakStrategy="simple" style={[planStyles.titleXl, styles.mt6]}>
        {isCurrentPlan ? 'Your training days' : `Pick ${workoutDaysLabel(requiredDays)}`}
      </Text>
      <Text style={[planStyles.body, styles.mt6]}>
        {isCurrentPlan
          ? `These are the ${requiredDays} day${requiredDays === 1 ? '' : 's'} you train on. Adjust them and tap update to reschedule.`
          : 'Choose the weekdays to train. Activating this plan replaces any current active plan.'}
      </Text>
      <WeekdayGrid selected={selected} onToggle={onToggle} testIDPrefix="plan-weekday" />
      <Pressable
        testID="plan-activate"
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onSubmit}
        style={({ pressed }) => [styles.cta, pressed && !disabled && styles.ctaPressed, disabled && styles.ctaDisabled]}
      >
        {isActivating ? <Spinner size={20} thickness={2} color={colors.navy} track="rgba(17, 24, 39, 0.4)" /> : null}
        <Text numberOfLines={1} textBreakStrategy="simple" style={styles.ctaText}>{isCurrentPlan ? 'UPDATE SCHEDULE' : 'START WORKOUT PLAN'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  copyCard: {
    marginTop: 20,
  },
  page: {
    gap: 20,
    paddingBottom: 24,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 12,
  },
  // Batch A (A3): 44 pt touch height.
  backLink: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: -8,
    borderRadius: radii.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  backGlyph: {
    fontSize: 18,
    lineHeight: 18,
    color: colors.textMuted,
  },
  backLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.textMuted,
  },
  backPressed: {
    color: colors.textPrimary,
  },
  summary: {
    padding: 20,
  },
  stats: {
    flexDirection: 'row',
    marginTop: 16,
    borderRadius: radii.xxl,
    backgroundColor: colors.background,
    paddingVertical: 12,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  statValue: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  statValueText: {
    paddingHorizontal: 4,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  // Batch 2 #24: the 11px minimum (tracking 0.15em).
  statLabel: {
    fontSize: 11,
    lineHeight: 16.5,
    fontWeight: '700',
    letterSpacing: 1.65,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  daysHeading: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  dayList: {
    gap: 12,
  },
  dayCard: {
    overflow: 'hidden',
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
  },
  dayHeaderPressed: {
    backgroundColor: colors.rowPressed,
  },
  dayHeaderLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dayNumber: {
    width: 40,
    height: 40,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumberOpen: {
    backgroundColor: colors.brand400,
  },
  dayNumberClosed: {
    backgroundColor: colors.surfaceMuted,
  },
  dayNumberText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '900',
  },
  textColumn: {
    flex: 1,
    minWidth: 0,
  },
  dayTitle: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  chevron: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textMuted,
  },
  dayBody: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  focusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  focusChip: {
    borderRadius: radii.full,
    backgroundColor: colors.brand50,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  focusText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: colors.brand700,
  },
  exerciseList: {
    gap: 8,
  },
  exerciseRow: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 12,
  },
  exerciseRowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  exerciseTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  well: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
  },
  wellPhone: {
    width: 80,
    height: 64,
    borderRadius: 18,
  },
  wellWide: {
    width: 96,
    height: 80,
    borderRadius: 24,
  },
  wellImage: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  orderBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    boxShadow: shadows.lift1,
  },
  orderText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  exerciseName: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  exerciseMuscle: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  setSummary: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  chevronBox: {
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowChevron: {
    fontSize: 18,
    lineHeight: 24,
    color: colors.textMuted,
  },
  exerciseNotes: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  emptyDay: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 16,
  },
  emptyDayText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  toast: {
    marginBottom: 16,
  },
  lockBanner: {
    marginBottom: 16,
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.trainerLockBorder,
    backgroundColor: colors.brand50,
    padding: 16,
  },
  lockTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  lockBody: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  lockLink: {
    fontWeight: '700',
    color: colors.brand700,
  },
  lockLinkPressed: {
    textDecorationLine: 'underline',
  },
  scheduleCard: {
    padding: 20,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    borderRadius: radii.xxl,
    backgroundColor: colors.brand400,
    paddingVertical: 16,
    // Batch 2 #23: soft, not the glow.
    boxShadow: shadows.soft,
  },
  ctaPressed: {
    backgroundColor: colors.brand500,
  },
  ctaDisabled: {
    opacity: 0.6,
  },
  ctaText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '900',
    letterSpacing: 0.4,
    color: colors.navy,
  },
  mt6: {
    marginTop: 6,
  },
  mt8: {
    marginTop: 8,
  },
});
