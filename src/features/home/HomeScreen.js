import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import EmptyState from '../../shared/components/EmptyState';
import { InlineError } from '../../shared/components/FeedbackBox';
import Loader from '../../shared/components/Loader';
import { InlineToast } from '../../shared/components/ToastHost';
import { ToastTone } from '../../shared/components/toastStore';
import { useFocusRemountKey } from '../../shared/hooks/useFocusRemountKey';
import { colors, radii, shadows } from '../../shared/theme/tokens';
import { useAuthStore } from '../auth/authStore';
import { getCurrentPlan, listPlanDays } from '../plans/api/libraryApi';
import { getProfile } from '../profile/api/profileApi';
import { setStoredProfile } from '../profile/profileStore';
import ShellPage from '../shell/ShellPage';
import { openPlanDetailAlone, openShellPath } from '../shell/shellLinks';
import { getDashboard } from './api/homeApi';
import { defaultWeightUnit, greetingName, quickStats, recentWorkoutMeta, todayCard, weightCard } from './homeFormat';
import WeightLogModal from './WeightLogModal';

const SAVED_TOAST_MS = 3500;

const PILL_TONES = {
  success: { background: colors.successTint, text: colors.success700, dot: colors.success },
  brand: { background: colors.brand50, text: colors.brand700, dot: colors.brand400 },
  warning: { background: 'rgba(245, 158, 11, 0.10)', text: colors.warning700, dot: colors.warning },
  // A1: the muted pill text is text-secondary.
  muted: { background: colors.surfaceMuted, text: colors.textSecondary, dot: colors.textMuted },
};

// Home (RN-SPEC-home), the Today tab root. Every focus is a fresh mount
// (plans §8.1).
export default function HomeScreen() {
  const remountKey = useFocusRemountKey();
  return (
    <ShellPage>
      <Home key={remountKey} />
    </ShellPage>
  );
}

// Batch B #3: days > 0 and no schedule → the day count, else null. Any
// failure simply means no setup card.
async function loadSetupDayCount() {
  try {
    const current = await getCurrentPlan();
    const planId = current?.enrollment?.plan?.id;
    if (!planId) {
      return null;
    }
    const days = await listPlanDays(planId);
    return days.length > 0 && (current.schedule || []).length === 0 ? days.length : null;
  } catch {
    return null;
  }
}

function Home() {
  const email = useAuthStore((state) => state.user?.email);
  const [load, setLoad] = useState({ status: 'loading', dashboard: null, error: null });
  const [profile, setProfile] = useState(null);
  const [setupDayCount, setSetupDayCount] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const mounted = useRef(true);

  useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );

  // A fetched profile also refreshes the shared profile store (P1 reads it).
  const applyProfile = useCallback((body) => {
    const fresh = body?.profile ?? null;
    if (fresh) {
      setStoredProfile(fresh);
    }
    if (mounted.current) {
      setProfile(fresh);
    }
  }, []);

  // H1.1: dashboard + profile in parallel; the profile can't fail the page.
  useEffect(() => {
    const profileLoad = getProfile()
      .then(applyProfile)
      .catch(() => {});
    const setupLoad = loadSetupDayCount().then((count) => mounted.current && setSetupDayCount(count));
    Promise.allSettled([getDashboard(), profileLoad, setupLoad]).then(([dashboard]) => {
      if (!mounted.current) {
        return;
      }
      if (dashboard.status === 'fulfilled') {
        setLoad({ status: 'loaded', dashboard: dashboard.value, error: null });
      } else {
        setLoad({ status: 'error', dashboard: null, error: dashboard.reason });
      }
    });
  }, [applyProfile]);

  // H1.7: after a weight log, refresh quietly; failures keep the old content.
  const quietRefresh = useCallback(() => {
    getDashboard()
      .then((dashboard) => mounted.current && setLoad((current) => ({ ...current, dashboard })))
      .catch(() => {});
    getProfile()
      .then(applyProfile)
      .catch(() => {});
  }, [applyProfile]);

  // ⚠H-8: the timer starts when the message first appears; a second log sets
  // the same text and does not restart it.
  useEffect(() => {
    if (!successMessage) {
      return undefined;
    }
    const timer = setTimeout(() => setSuccessMessage(''), SAVED_TOAST_MS);
    return () => clearTimeout(timer);
  }, [successMessage]);

  if (load.status === 'loading') {
    return <Loader label="Loading dashboard" />;
  }
  if (load.status === 'error') {
    // ⚠H-1: the transport text, no retry.
    return <InlineError testID="home-error" title="Dashboard unavailable" message={load.error?.message || 'Please try again.'} />;
  }

  const { dashboard } = load;
  const plan = dashboard?.current_plan?.enrollment?.plan;
  const stats = quickStats(dashboard);
  const weight = weightCard(dashboard, profile);
  const recent = dashboard?.recent_workouts ?? [];

  return (
    <View style={styles.page}>
      {successMessage ? (
        <InlineToast testID="home-saved-toast" tone={ToastTone.success} title="Saved" message={successMessage} />
      ) : null}
      <Text testID="home-greeting" style={styles.greeting}>{`Welcome back, ${greetingName(profile, email)}`}</Text>

      {plan ? (
        <TodayCard plan={plan} card={todayCard(dashboard, setupDayCount)} />
      ) : (
        <EmptyState
          title="No active plan yet"
          message="Pick a workout plan to unlock your weekly schedule and guided workouts."
          actionLabel="Choose a plan"
          actionTestID="home-choose-plan"
          onAction={() => openShellPath('/plans')}
        />
      )}

      <View>
        <View testID="home-stats" style={[styles.strip, styles.card]}>
          {stats.items.map((item, index) => (
            <View key={item.label} style={[styles.stripItem, index > 0 && styles.divider]}>
              <Text numberOfLines={1} textBreakStrategy="simple" style={styles.stripValue}>{item.value}</Text>
              <Text style={styles.stripLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
        {stats.lastWorkout ? <Text style={styles.lastWorkout}>{stats.lastWorkout}</Text> : null}
      </View>

      <View testID="home-weight" style={[styles.card, styles.weightCard]}>
        <View style={styles.weightHeader}>
          <Text style={styles.sectionTitle}>Weight</Text>
          <Pressable testID="home-see-progress" accessibilityRole="link" hitSlop={12} onPress={() => openShellPath('/progress')}>
            <Text style={styles.link}>See progress</Text>
          </Pressable>
        </View>
        {weight.hasData ? (
          <>
            <View style={styles.weightValues}>
              {[
                ['Current', weight.current],
                ['Goal', weight.goal],
                ['To goal', weight.toGoal],
              ].map(([label, value], index) => (
                <View key={label} style={[styles.weightItem, index > 0 && styles.divider]}>
                  <Text numberOfLines={1} textBreakStrategy="simple" style={styles.weightValue}>{value}</Text>
                  <Text style={styles.stripLabel}>{label}</Text>
                </View>
              ))}
            </View>
            <Pressable
              testID="home-add-weight"
              accessibilityRole="button"
              onPress={() => setModalOpen(true)}
              style={({ pressed }) => [styles.secondaryButton, styles.mt16, pressed && styles.secondaryPressed]}
            >
              <Text style={styles.secondaryText}>Add weight log</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.noWeight}>
            <Text style={styles.noWeightText}>Log today's weight to start tracking your trend.</Text>
            <Pressable
              testID="home-add-weight"
              accessibilityRole="button"
              onPress={() => setModalOpen(true)}
              style={({ pressed }) => [styles.smallPrimary, pressed && styles.primaryPressed]}
            >
              <Text numberOfLines={1} textBreakStrategy="simple" style={styles.primaryText}>Add weight log</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View>
        <Text accessibilityRole="header" style={[styles.sectionTitle, styles.recentHeading]}>
          Recent workouts
        </Text>
        {recent.length === 0 ? (
          <EmptyState title="No completed workouts yet" message="Once you finish a workout, it will show up here." />
        ) : (
          <View style={styles.recentList}>
            {recent.map((workout, index) => (
              <View key={workout.id ?? index} testID={`home-recent-${workout.id ?? index}`} style={[styles.card, styles.recentRow]}>
                <View style={styles.textColumn}>
                  <Text numberOfLines={1} style={styles.recentTitle}>
                    {workout.workout_plan_day?.title || 'Workout session'}
                  </Text>
                  <Text numberOfLines={1} style={styles.recentMeta}>
                    {recentWorkoutMeta(workout)}
                  </Text>
                </View>
                {/* ⚠H-7: always the success tone, with the raw status text. */}
                <StatusPill tone="success" label={workout.status} />
              </View>
            ))}
          </View>
        )}
      </View>

      <WeightLogModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultUnit={defaultWeightUnit(profile)}
        onSuccess={() => {
          setSuccessMessage('Weight logged successfully.');
          quietRefresh();
        }}
      />
    </View>
  );
}

// H1.3 (23 Oct: no "TODAY" eyebrow; the sub-line is the plan name, 2 lines).
function TodayCard({ plan, card }) {
  return (
    <View testID="home-today-card" style={[styles.todayCard, styles.card]}>
      <View style={[styles.accent, { backgroundColor: card.state === 'missed' ? colors.warning : colors.brand400 }]} />
      <View style={styles.todayContent}>
        <View style={styles.todayTop}>
          <View style={styles.textColumn}>
            <Text textBreakStrategy="simple" style={styles.headline}>{card.headline}</Text>
            <Text numberOfLines={2} ellipsizeMode="tail" style={styles.sub}>
              {card.sub ?? plan.name}
            </Text>
            {card.moreMissed ? <Text style={styles.moreMissed}>{card.moreMissed}</Text> : null}
          </View>
          <StatusPill tone={card.tone} label={card.pill} />
        </View>
        <View style={styles.buttons}>
          <Pressable
            testID="home-today-primary"
            accessibilityRole="button"
            onPress={() => openShellPath('/workout')}
            style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
          >
            <Text numberOfLines={1} textBreakStrategy="simple" style={styles.primaryText}>{card.primary}</Text>
          </Pressable>
          <Pressable
            testID="home-view-plan"
            accessibilityRole="button"
            onPress={() => openPlanDetailAlone(plan.id)}
            style={({ pressed }) => [styles.viewPlan, pressed && styles.secondaryPressed]}
          >
            <Text style={styles.secondaryText}>View plan</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// H1.8
function StatusPill({ tone, label }) {
  const look = PILL_TONES[tone];
  return (
    <View style={[styles.pill, { backgroundColor: look.background }]}>
      <View style={[styles.pillDot, { backgroundColor: look.dot }]} accessibilityElementsHidden importantForAccessibility="no" />
      <Text style={[styles.pillText, { color: look.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: 20,
    paddingBottom: 24,
  },
  greeting: {
    marginBottom: 4,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  card: {
    borderRadius: radii.xxxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    boxShadow: shadows.soft,
  },
  todayCard: {
    flexDirection: 'row',
    overflow: 'hidden',
  },
  accent: {
    width: 6,
  },
  todayContent: {
    flex: 1,
    minWidth: 0,
    padding: 20,
  },
  todayTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  textColumn: {
    flex: 1,
    minWidth: 0,
  },
  headline: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  sub: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  moreMissed: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.warning700,
  },
  buttons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
  },
  primary: {
    flex: 1,
    alignItems: 'center',
    borderRadius: radii.xl,
    backgroundColor: colors.brand400,
    paddingVertical: 12,
    boxShadow: shadows.glow,
  },
  primaryPressed: {
    backgroundColor: colors.brand500,
  },
  primaryText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '900',
    color: colors.navy,
  },
  viewPlan: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 12,
  },
  secondaryPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  secondaryText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexShrink: 0,
    gap: 6,
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  strip: {
    flexDirection: 'row',
    paddingVertical: 16,
  },
  stripItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  divider: {
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  stripValue: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  stripLabel: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 14.88,
    fontWeight: '700',
    letterSpacing: 1.19,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  lastWorkout: {
    marginTop: 8,
    paddingHorizontal: 4,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  weightCard: {
    padding: 20,
  },
  weightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  link: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: colors.brand700,
  },
  weightValues: {
    flexDirection: 'row',
    marginTop: 12,
  },
  weightItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  weightValue: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  noWeight: {
    alignItems: 'center',
    marginTop: 12,
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  noWeightText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  smallPrimary: {
    marginTop: 12,
    borderRadius: radii.xl,
    backgroundColor: colors.brand400,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  recentHeading: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  recentList: {
    gap: 10,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: radii.xxl,
    padding: 16,
  },
  recentTitle: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  recentMeta: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  mt16: {
    marginTop: 16,
  },
});
