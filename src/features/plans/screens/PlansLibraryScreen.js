import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { routes } from '../../../navigation/routes';
import { getStatus } from '../../../shared/api/apiError';
import EmptyState from '../../../shared/components/EmptyState';
import { RetryButton } from '../../../shared/components/ErrorAlert';
import { InlineError } from '../../../shared/components/FeedbackBox';
import { CAP_BODY } from '../../../shared/components/largeText';
import PillButton from '../../../shared/components/PillButton';
import StateSlot from '../../../shared/components/StateSlot';
import { useFocusRemountKey } from '../../../shared/hooks/useFocusRemountKey';
import { breakpoints, colors, font, layout, spacing } from '../../../shared/theme/tokens';
import { listMyPlans } from '../../myPlans/api/myPlansApi';
import { myPlanRoutes } from '../../myPlans/myPlanRoutes';
import { RAIL } from '../../shell/railMetrics';
import ShellPage from '../../shell/ShellPage';
import { openShellPath } from '../../shell/shellLinks';
import { listCompletedWorkouts } from '../../workout/api/workoutApi';
import { notStartedCaption } from '../weekByDate';
import { getCurrentPlan, getCurrentToday, getCurrentWeek, listDifficultyLevels, listPlanDays, listPlans } from '../api/libraryApi';
import PhoneActivePlanCard from '../components/PhoneActivePlanCard';
import PlanCatalogCard from '../components/PlanCatalogCard';
import PlanIcon from '../components/planIcons';
import PlanOwnRows from '../components/PlanOwnRows';
import PlansSkeleton from '../components/PlansSkeleton';
import { gridColumns, rowsOf, useIsTablet, useReflow } from '../components/planUi';
import {
  activePlanMetaParts,
  catalogMeta,
  catalogPlans,
  deriveLibrary,
  exercisesCountLabel,
  isValidWeek,
  levelNameOf,
  nextWorkout,
  planCountLabel,
  planDayTitle,
  weekCircles,
} from '../libraryFormat';

// S1 (RN-SPEC-plans §3), v2 look per UX H (Plans #21); T-60 on the phone and,
// since the UX native final audit (27 Oct 2026, B203/B204), on the tablet.
// Every focus remounts and reloads (§8.1).
export default function PlansLibraryScreen() {
  const remountKey = useFocusRemountKey();
  return (
    <ShellPage testID="plans-library-screen">
      <PlansLibrary key={remountKey} />
    </ShellPage>
  );
}

// §3.1: a 404 on the current plan means "no active plan"; any other error
// fails the load.
function loadLibrary() {
  const current = getCurrentPlan().catch((error) => {
    if (getStatus(error) === 404) {
      return null;
    }
    throw error;
  });
  return Promise.all([listPlans(), current]);
}

// N1 (approved 27 Oct): tablet "New plan" (→ My plan create), hidden for a
// member ON HOLD, the same rule as My plans' Create (GET /my-custom-plans
// 403, chosen by status). Hidden until the check answers.
function useCanCreatePlan(enabled) {
  const [canCreate, setCanCreate] = useState(false);
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    let alive = true;
    Promise.resolve()
      .then(() => listMyPlans(1))
      .then(
        () => alive && setCanCreate(true),
        (error) => alive && setCanCreate(getStatus(error) !== 403)
      );
    return () => {
      alive = false;
    };
  }, [enabled]);
  return enabled && canCreate;
}

// Dated change (27 Oct 2026, owner T-60): the PHONE page's side data, four
// existing GETs, each FAIL-SOFT (a failure hides only its part; the page
// never errors on them). /week, /today and the plan's days only with a
// current plan; the level names once per load. Each value is undefined while
// pending and null when the call failed. The tablet makes the same calls
// (UX native final audit 27 Oct 2026, B203/B204: T-60 §6 on the tablet).
// T-81 (PM ruling 4): + the week's completed workouts (GET /workouts
// ?status=completed for week[0].date..week[6].date, after /week answers) for
// the date strip; null when /week or that call failed (the circles then keep
// the pre-T-81 look).
const SIDE_PENDING = { week: undefined, today: undefined, days: undefined, levels: undefined, completed: undefined };

function useSideData(load) {
  const [side, setSide] = useState(SIDE_PENDING);
  useEffect(() => {
    setSide(SIDE_PENDING);
    if (load.status !== 'loaded') {
      return undefined;
    }
    let alive = true;
    const settle = (key, call) => {
      Promise.resolve()
        .then(call)
        .then(
          (value) => alive && setSide((current) => ({ ...current, [key]: value ?? null })),
          () => alive && setSide((current) => ({ ...current, [key]: null }))
        );
    };
    settle('levels', listDifficultyLevels);
    const planId = load.currentPlan?.enrollment?.plan?.id;
    if (load.currentPlan?.enrollment?.plan) {
      const weekCall = Promise.resolve().then(getCurrentWeek);
      settle('week', () => weekCall);
      settle('completed', () =>
        weekCall.then((week) =>
          isValidWeek(week) && week[0]?.date && week[6]?.date ? listCompletedWorkouts({ startDate: week[0].date, endDate: week[6].date }) : null
        )
      );
      settle('today', getCurrentToday);
      if (planId != null) {
        settle('days', () => listPlanDays(planId));
      }
    }
    return () => {
      alive = false;
    };
  }, [load]);
  return side;
}

function PlansLibrary() {
  const navigation = useNavigation();
  const tablet = useIsTablet();
  const reflow = useReflow();
  const canCreate = useCanCreatePlan(tablet);
  const [reloadCount, setReloadCount] = useState(0);
  const [load, setLoad] = useState({ status: 'loading', plans: [], currentPlan: null, error: null });
  const side = useSideData(load);
  const { width } = useWindowDimensions();
  // The tablet column's width (T-60 §6 grids): measured, else the window
  // less the rail and its two content gutters, capped at the content max.
  const [measured, setMeasured] = useState(null);
  const columnWidth = measured ?? Math.min(layout.contentMax, width - layout.railWidth - 2 * RAIL.contentGutter);

  useEffect(() => {
    let alive = true;
    setLoad({ status: 'loading', plans: [], currentPlan: null, error: null });
    loadLibrary()
      .then(([plans, currentPlan]) => {
        if (alive) {
          setLoad({ status: 'loaded', plans, currentPlan, error: null });
        }
      })
      .catch((error) => {
        if (alive) {
          setLoad({ status: 'error', plans: [], currentPlan: null, error });
        }
      });
    return () => {
      alive = false;
    };
  }, [reloadCount]);

  const header = canCreate ? (
    <View testID="plans-header-actions" style={styles.headerRow}>
      <PillButton
        testID="plans-new-plan"
        title="New plan"
        variant="secondary"
        size="compact"
        icon={({ color }) => <PlanIcon name="plus" size={18} color={color} />}
        onPress={() => navigation.push(myPlanRoutes.MyPlanCreate)}
      />
    </View>
  ) : null;

  if (load.status === 'loading') {
    // T-60 (UX X5): the page-shaped skeleton at every width, as web's
    // PlansSkeleton; the tablet keeps its page header above it.
    if (!tablet) {
      return <PlansSkeleton />;
    }
    return (
      <>
        {header}
        <PlansSkeleton />
      </>
    );
  }
  if (load.status === 'error') {
    // N2 (approved): the transport message + the one Retry style; Retry
    // re-runs the page load. §D1: the 640 column under the header.
    return (
      <>
        {header}
        <StateSlot>
          <InlineError testID="plans-error" title="Plans unavailable" message={load.error?.message || 'Please try again.'} />
          <RetryButton testID="plans-retry" style={styles.retry} onPress={() => setReloadCount((count) => count + 1)} />
        </StateSlot>
      </>
    );
  }

  const library = deriveLibrary(load.plans, load.currentPlan);
  const openPlan = (planId) => navigation.push(routes.PlanDetail, { planId: String(planId) });

  if (!tablet) {
    return <T60Plans library={library} load={load} side={side} compact={width < 360} openPlan={openPlan} />;
  }

  // UX native final audit 27 Oct 2026, B203/B204 (T-60 §6): the tablet draws
  // the same page in its column at the web ≥768 sizes. Two-column card body
  // at ≥1024; above 1.3× text everything stacks (§9 rule 4).
  return (
    <>
      {header}
      <T60Plans
        library={library}
        load={load}
        side={side}
        openPlan={openPlan}
        tablet={{
          size: !reflow && width >= breakpoints.lg ? 'wide' : 'tablet',
          ownColumns: reflow ? 1 : gridColumns(columnWidth, OWN_MIN, GRID_GAP),
          catalogColumns: reflow ? 1 : gridColumns(columnWidth, CATALOG_MIN, GRID_GAP),
          onLayout: (event) => setMeasured(event.nativeEvent.layout.width),
        }}
      />
    </>
  );
}

// T-60 §6 grid minimums: "Make it your own" auto-fit 340, the catalog
// auto-fill 360, both gap 16.
const OWN_MIN = 340;
const CATALOG_MIN = 360;
const GRID_GAP = spacing[4];

// Dated change (27 Oct 2026, owner T-60; UX T60-plans-spec §1–§5): the PHONE
// page: the active plan card, "Make it your own", the catalog (no category
// sub-headings; the same plans in the same order). Same destinations.
// `tablet` (null on the phone): { size, ownColumns, catalogColumns, onLayout }.
function T60Plans({ library, load, side, compact = false, openPlan, tablet = null }) {
  const schedule = load.currentPlan?.schedule;
  const now = new Date();
  const plan = library.activePlanDetail;
  // T-81: the circles wait for the completed workouts too (no Missed → Done
  // flicker); started_on is date-only (weekByDate takes its first 10 chars).
  const circles =
    side.week === undefined || side.completed === undefined
      ? null
      : weekCircles({ week: side.week, schedule, completed: side.completed, startedOn: load.currentPlan?.enrollment?.started_on, now });
  const weekCaption = circles ? notStartedCaption(circles, load.currentPlan?.enrollment?.started_on) : null;
  const found = side.week === undefined || side.today === undefined ? null : nextWorkout({ today: side.today, week: side.week, schedule, now });
  const count = found && Array.isArray(side.days) ? side.days.find((day) => String(day?.id) === String(found.planDay?.id))?.exercises_count : null;
  const next = found ? { when: found.when, title: planDayTitle(found.planDay), count: exercisesCountLabel(count), gold: found.gold } : null;
  const plans = catalogPlans(library);

  return (
    <View testID="plans-page" style={[styles.page, tablet && styles.pageTablet]} onLayout={tablet?.onLayout}>
      {library.hasActivePlan ? (
        <PhoneActivePlanCard
          size={tablet?.size ?? 'phone'}
          plan={plan}
          meta={activePlanMetaParts(plan, levelNameOf(plan, side.levels))}
          circles={circles}
          weekCaption={weekCaption}
          next={next}
          compact={compact}
          onStart={() => openShellPath('/workout')}
          onView={openPlan}
        />
      ) : null}
      <PlanOwnRows tablet={Boolean(tablet)} columns={tablet?.ownColumns} />
      {library.noPlansAtAll ? (
        <EmptyState title="No plans available" message="No active workout plans were returned by the backend." />
      ) : null}
      {plans.length > 0 ? (
        <View testID="plans-catalog" style={[styles.section, tablet && styles.sectionTablet]}>
          <View style={styles.catalogHeader}>
            <Text {...CAP_BODY} testID="plans-catalog-heading" accessibilityRole="header" style={styles.phoneHeading}>
              {library.hasActivePlan ? 'Try a different plan' : 'Choose your next plan'}
            </Text>
            <Text {...CAP_BODY} testID="plans-catalog-count" style={styles.phoneCount}>
              {planCountLabel(plans.length)}
            </Text>
          </View>
          {tablet
            ? // auto-fill: the last line keeps its empty cells.
              rowsOf(plans, tablet.catalogColumns).map((line) => (
                <View key={line.map((item) => item.id).join('-')} testID="plans-catalog-row" style={styles.gridLine}>
                  {line.map((item) => (
                    <PlanCatalogCard
                      key={item.id}
                      tablet
                      plan={item}
                      meta={catalogMeta(item, levelNameOf(item, side.levels))}
                      style={styles.gridCell}
                      onPress={() => openPlan(item.id)}
                    />
                  ))}
                  {Array.from({ length: tablet.catalogColumns - line.length }, (_, index) => (
                    <View key={`empty-${index}`} style={styles.gridCell} />
                  ))}
                </View>
              ))
            : plans.map((item) => (
                <PlanCatalogCard key={item.id} plan={item} meta={catalogMeta(item, levelNameOf(item, side.levels))} onPress={() => openPlan(item.id)} />
              ))}
        </View>
      ) : !library.hasActivePlan && !library.noPlansAtAll ? (
        <Text {...CAP_BODY} accessibilityRole="header" style={[styles.phoneHeading, styles.headingAlone]}>
          Choose your next plan
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: spacing[3],
    paddingBottom: spacing[4],
  },
  pageTablet: {
    gap: spacing[4],
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  retry: {
    alignSelf: 'flex-start',
    marginTop: spacing[3],
  },
  section: {
    gap: spacing[3],
  },
  sectionTablet: {
    gap: spacing[4],
  },
  headingAlone: {
    paddingHorizontal: spacing[1],
  },
  // T-60 §6 grids: gap 16.
  gridLine: {
    flexDirection: 'row',
    gap: spacing[4],
  },
  gridCell: {
    flex: 1,
    minWidth: 0,
  },
  // T-60 phone: header row margin 16 4 0 (baseline); 20/26/700 −0.02em; the
  // count 14 secondary.
  catalogHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing[3],
    marginTop: spacing[4],
    paddingHorizontal: spacing[1],
  },
  phoneHeading: {
    ...font(700),
    flexShrink: 1,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.4,
    color: colors.textPrimary,
  },
  phoneCount: {
    ...font(400),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
});
