import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { InlineToast } from '../../shared/components/ToastHost';
import { ToastTone } from '../../shared/components/toastStore';
import { useFocusRemountKey } from '../../shared/hooks/useFocusRemountKey';
import { breakpoints, colors, textScale, typography } from '../../shared/theme/tokens';
import { useAuthStore } from '../auth/authStore';
import { getCurrentPlan, listPlanDays } from '../plans/api/libraryApi';
import { applySavedWeightLog, useProfileStore } from '../profile/profileStore';
import ShellPage from '../shell/ShellPage';
import { openPlanDetailAlone, openShellPath } from '../shell/shellLinks';
import { getCurrentWeek, getDashboard } from './api/homeApi';
import {
  avatarInitials,
  defaultWeightUnit,
  greetingLine,
  heroDayTitle,
  heroImageUrl,
  recentWorkoutMeta,
  todayCard,
  todayDateLabel,
  todayEmptyStats,
  weekRing,
  weekStrip,
  weightCard,
} from './homeFormat';
import { RecentWorkouts, TodayHero, TodayStats, WeekCard, WeightCard, WeightValues } from './TodayPlanView';
import { LARGE_TEXT as LT, TodayEmpty, TodayError, TodayHeader, TodayLoading, useReflow } from './TodayStates';
import WeightLogModal from './WeightLogModal';

const SAVED_TOAST_MS = 3500;
// Stat values (18–20 px): the title cap, never shrunk.
const VALUE_TEXT = { maxFontSizeMultiplier: textScale.title };

// Home (RN-SPEC-home), the Today tab root. Every focus is a fresh mount
// (plans §8.1). v2 Phase 2 B3: the Today header in every state, and the
// empty / error / loading states (TodayStates.js); the ambient gold glow
// from the first render.
export default function HomeScreen() {
  const remountKey = useFocusRemountKey();
  return (
    <ShellPage glow>
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
  const { width } = useWindowDimensions();
  // Fixed per mount (every Today focus remounts): the states draw gradients,
  // which are never swapped on a later change (Android render rule).
  const [tablet] = useState(() => width >= breakpoints.md);
  // §9 reflow (live): stat columns → label/value rows, trailing pills below,
  // the button pair stacks.
  const reflow = useReflow();
  const [load, setLoad] = useState({ status: 'loading', dashboard: null, error: null });
  // T-24 (25 Oct 2026): the ProfileGate already loaded the profile; Home reads the store.
  const profile = useProfileStore((state) => state.profile);
  const [setupDayCount, setSetupDayCount] = useState(null);
  // U1: the week strip; null (hidden) until loaded or on any failure.
  const [week, setWeek] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const mounted = useRef(true);

  useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );

  // H1.1 (T-24, 25 Oct 2026): only GET /dashboard; no profile request.
  useEffect(() => {
    const setupLoad = loadSetupDayCount().then((count) => mounted.current && setSetupDayCount(count));
    // U1: optional, never blocks or fails the page.
    getCurrentWeek().then((days) => mounted.current && setWeek(days));
    Promise.allSettled([getDashboard(), setupLoad]).then(([dashboard]) => {
      if (!mounted.current) {
        return;
      }
      if (dashboard.status === 'fulfilled') {
        setLoad({ status: 'loaded', dashboard: dashboard.value, error: null });
      } else {
        setLoad({ status: 'error', dashboard: null, error: dashboard.reason });
      }
    });
  }, []);

  // H1.7: after a weight log, refresh quietly; failures keep the old content.
  // T-24: the dashboard only; the profile store was patched from the log.
  const quietRefresh = useCallback(() => {
    getDashboard()
      .then((dashboard) => mounted.current && setLoad((current) => ({ ...current, dashboard })))
      .catch(() => {});
  }, []);

  // ⚠H-8: the timer starts when the message first appears; a second log sets
  // the same text and does not restart it.
  useEffect(() => {
    if (!successMessage) {
      return undefined;
    }
    const timer = setTimeout(() => setSuccessMessage(''), SAVED_TOAST_MS);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const header = (
    <TodayHeader
      tablet={tablet}
      initials={avatarInitials(profile, email)}
      dateLabel={todayDateLabel()}
      greeting={greetingLine(profile, email)}
    />
  );

  if (load.status === 'loading') {
    return (
      <View style={styles.page}>
        {header}
        <TodayLoading tablet={tablet} />
      </View>
    );
  }
  if (load.status === 'error') {
    // ⚠H-1: the transport text, no retry.
    return (
      <View style={styles.page}>
        {header}
        <TodayError tablet={tablet} message={load.error?.message} />
      </View>
    );
  }

  const { dashboard } = load;
  const plan = dashboard?.current_plan?.enrollment?.plan;
  const weight = weightCard(dashboard, profile);
  const unit = defaultWeightUnit(profile);
  const recent = dashboard?.recent_workouts ?? [];
  const toast = successMessage ? (
    <InlineToast testID="home-saved-toast" tone={ToastTone.success} title="Saved" message={successMessage} />
  ) : null;
  const weightValues = <WeightValues weight={weight} reflow={reflow} StatRow={StatRow} />;
  const recentList = <RecentWorkouts recent={recent} metaOf={(workout) => recentWorkoutMeta(workout, unit)} tablet={tablet} reflow={reflow} />;
  const weightModal = (
    <WeightLogModal
      isOpen={modalOpen}
      onClose={() => setModalOpen(false)}
      defaultUnit={unit}
      onSuccess={(saved) => {
        applySavedWeightLog(saved);
        setSuccessMessage('Weight logged successfully.');
        quietRefresh();
      }}
    />
  );

  if (!plan) {
    return (
      <View style={styles.page}>
        {toast}
        {header}
        <TodayEmpty
          tablet={tablet}
          stats={todayEmptyStats(dashboard)}
          weight={weight}
          weightValues={weightValues}
          recentEmpty={recent.length === 0}
          recentList={recentList}
          onChoosePlan={() => openShellPath('/plans')}
          onBuildPlan={() => openShellPath('/plans/generate')}
          onSeeProgress={() => openShellPath('/progress')}
          onAddWeight={() => setModalOpen(true)}
        />
        {weightModal}
      </View>
    );
  }

  const strip = weekStrip(week);
  const card = todayCard(dashboard, setupDayCount);
  return (
    <View style={[styles.page, tablet && styles.pageTablet]}>
      {toast}
      {header}
      <TodayHero
        plan={plan}
        card={card}
        tablet={tablet}
        reflow={reflow}
        imageUrl={heroImageUrl(dashboard)}
        dayTitle={heroDayTitle(dashboard, card)}
        dayOfWeek={strip?.dayOfWeek}
        onPrimary={() => openShellPath('/workout')}
        onViewPlan={() => openPlanDetailAlone(plan.id)}
      />
      <TodayStats ring={weekRing(dashboard)} tablet={tablet} reflow={reflow} />
      {strip ? <WeekCard strip={strip} tablet={tablet} reflow={reflow} onSeeProgress={() => openShellPath('/progress')} /> : null}
      <WeightCard
        hasData={weight.hasData}
        weightValues={weightValues}
        tablet={tablet}
        reflow={reflow}
        onSeeProgress={() => openShellPath('/progress')}
        onAddWeight={() => setModalOpen(true)}
      />
      {recentList}
      {weightModal}
    </View>
  );
}

// §9 rule 4: a stat column past 1.3 becomes a label → value row.
function StatRow({ label, value, first, valueStyle }) {
  return (
    <View testID={`home-stat-row-${label}`} style={[styles.statRow, !first && styles.statRowDivider]}>
      <Text {...LT.body} style={[styles.statLabel, styles.statRowLabel]}>
        {label}
      </Text>
      <Text {...VALUE_TEXT} style={[valueStyle, styles.statRowValue]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: 12,
    paddingBottom: 24,
  },
  pageTablet: {
    gap: 16,
  },
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 12,
    paddingVertical: 8,
  },
  statRowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  statRowLabel: {
    flexShrink: 1,
  },
  statRowValue: {
    flexShrink: 1,
    textAlign: 'right',
  },
});
