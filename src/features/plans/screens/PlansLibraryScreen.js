import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { routes } from '../../../navigation/routes';
import { getStatus } from '../../../shared/api/apiError';
import EmptyState from '../../../shared/components/EmptyState';
import { RetryButton } from '../../../shared/components/ErrorAlert';
import { InlineError } from '../../../shared/components/FeedbackBox';
import { CAP_BODY, CAP_PILL } from '../../../shared/components/largeText';
import PillButton from '../../../shared/components/PillButton';
import StateSlot from '../../../shared/components/StateSlot';
import { useFocusRemountKey } from '../../../shared/hooks/useFocusRemountKey';
import { colors, font, radii, spacing } from '../../../shared/theme/tokens';
import { listMyPlans } from '../../myPlans/api/myPlansApi';
import { myPlanRoutes } from '../../myPlans/myPlanRoutes';
import ShellPage from '../../shell/ShellPage';
import { openShellPath } from '../../shell/shellLinks';
import { getCurrentPlan, getCurrentToday, getCurrentWeek, listDifficultyLevels, listPlanDays, listPlans } from '../api/libraryApi';
import ActivePlanCard from '../components/ActivePlanCard';
import PhoneActivePlanCard from '../components/PhoneActivePlanCard';
import PlanCatalogCard from '../components/PlanCatalogCard';
import PlanEntryTiles from '../components/PlanEntryTiles';
import PlanIcon from '../components/planIcons';
import PlanOwnRows from '../components/PlanOwnRows';
import PlansSkeleton from '../components/PlansSkeleton';
import PlanTile from '../components/PlanTile';
import { useIsTablet, useReflow } from '../components/planUi';
import {
  activePlanMetaParts,
  catalogMeta,
  catalogPlans,
  deriveLibrary,
  exercisesCountLabel,
  levelNameOf,
  nextWorkout,
  planCountLabel,
  planDayTitle,
  weekChips,
  weekCircles,
} from '../libraryFormat';

// S1 (RN-SPEC-plans §3), v2 look per UX H (Plans #21, Tablet: Plans #88).
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
// pending and null when the call failed. The tablet makes none (unchanged).
const SIDE_PENDING = { week: undefined, today: undefined, days: undefined, levels: undefined };

function useSideData(load, enabled) {
  const [side, setSide] = useState(SIDE_PENDING);
  useEffect(() => {
    setSide(SIDE_PENDING);
    if (!enabled || load.status !== 'loaded') {
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
      settle('week', getCurrentWeek);
      settle('today', getCurrentToday);
      if (planId != null) {
        settle('days', () => listPlanDays(planId));
      }
    }
    return () => {
      alive = false;
    };
  }, [load, enabled]);
  return side;
}

function PlansLibrary() {
  const navigation = useNavigation();
  const tablet = useIsTablet();
  const reflow = useReflow();
  const canCreate = useCanCreatePlan(tablet);
  const [reloadCount, setReloadCount] = useState(0);
  const [load, setLoad] = useState({ status: 'loading', plans: [], currentPlan: null, error: null });
  const side = useSideData(load, !tablet);
  const { width } = useWindowDimensions();

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
  const columns = reflow ? 1 : 2;

  if (!tablet) {
    return <PhonePlans library={library} load={load} side={side} compact={width < 360} openPlan={openPlan} />;
  }

  return (
    <View style={[styles.page, tablet && styles.pageTablet]}>
      {header}
      {library.hasActivePlan ? (
        <ActivePlanCard plan={library.activePlanDetail} chips={weekChips(load.currentPlan?.schedule)} onView={openPlan} />
      ) : null}
      {/* M4, then G-E1 right after it (RN-SPEC-MEMBER-PLANS §M4, PLAN-GENERATOR §G0). */}
      <PlanEntryTiles />
      {library.noPlansAtAll ? (
        <EmptyState title="No plans available" message="No active workout plans were returned by the backend." />
      ) : null}
      {library.browseCount > 0 ? (
        <View style={[styles.section, tablet && styles.sectionTablet]}>
          <View style={[styles.sectionRow, reflow && styles.sectionRowStacked]}>
            <Text {...CAP_BODY} accessibilityRole="header" style={tablet ? styles.headingTablet : styles.heading}>
              {library.hasActivePlan ? 'Switch your plan' : 'Choose your next plan'}
            </Text>
            {tablet ? (
              <View style={styles.countPill}>
                <Text {...CAP_PILL} style={styles.countPillText}>
                  {planCountLabel(library.browseCount)}
                </Text>
              </View>
            ) : (
              <Text {...CAP_BODY} style={styles.count}>
                {planCountLabel(library.browseCount)}
              </Text>
            )}
          </View>
          {library.groups.map(([category, plans]) => (
            <View key={category} style={[styles.section, tablet && styles.sectionTablet]}>
              {library.showCategoryHeaders ? (
                <Text {...CAP_BODY} style={styles.category}>
                  {category}
                </Text>
              ) : null}
              {rowsOf(plans, columns).map((row) => (
                <View key={row.map((plan) => plan.id).join('-')} testID="plans-tile-row" style={[styles.tileRow, tablet && styles.tileRowTablet]}>
                  {row.map((plan) => (
                    <PlanTile key={plan.id} plan={plan} tablet={tablet} style={styles.tileCell} onPress={() => openPlan(plan.id)} />
                  ))}
                  {row.length < columns ? <View style={styles.tileCell} /> : null}
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : !library.hasActivePlan && !library.noPlansAtAll ? (
        <Text {...CAP_BODY} accessibilityRole="header" style={[tablet ? styles.headingTablet : styles.heading, styles.headingAlone]}>
          Choose your next plan
        </Text>
      ) : null}
    </View>
  );
}

// Dated change (27 Oct 2026, owner T-60; UX T60-plans-spec §1–§5): the PHONE
// page: the active plan card, "Make it your own", the catalog (no category
// sub-headings; the same plans in the same order). Same destinations.
function PhonePlans({ library, load, side, compact, openPlan }) {
  const schedule = load.currentPlan?.schedule;
  const now = new Date();
  const plan = library.activePlanDetail;
  const circles = side.week === undefined ? null : weekCircles({ week: side.week, schedule, now });
  const found = side.week === undefined || side.today === undefined ? null : nextWorkout({ today: side.today, week: side.week, schedule, now });
  const count = found && Array.isArray(side.days) ? side.days.find((day) => String(day?.id) === String(found.planDay?.id))?.exercises_count : null;
  const next = found ? { when: found.when, title: planDayTitle(found.planDay), count: exercisesCountLabel(count), gold: found.gold } : null;
  const plans = catalogPlans(library);

  return (
    <View style={styles.page}>
      {library.hasActivePlan ? (
        <PhoneActivePlanCard
          plan={plan}
          meta={activePlanMetaParts(plan, levelNameOf(plan, side.levels))}
          circles={circles}
          next={next}
          compact={compact}
          onStart={() => openShellPath('/workout')}
          onView={openPlan}
        />
      ) : null}
      <PlanOwnRows />
      {library.noPlansAtAll ? (
        <EmptyState title="No plans available" message="No active workout plans were returned by the backend." />
      ) : null}
      {plans.length > 0 ? (
        <View testID="plans-catalog" style={styles.section}>
          <View style={styles.catalogHeader}>
            <Text {...CAP_BODY} testID="plans-catalog-heading" accessibilityRole="header" style={styles.phoneHeading}>
              {library.hasActivePlan ? 'Try a different plan' : 'Choose your next plan'}
            </Text>
            <Text {...CAP_BODY} testID="plans-catalog-count" style={styles.phoneCount}>
              {planCountLabel(plans.length)}
            </Text>
          </View>
          {plans.map((item) => (
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

function rowsOf(items, size) {
  const rows = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
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
  // margin 12 4 0, baseline row.
  sectionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing[3],
    marginTop: spacing[3],
    paddingHorizontal: spacing[1],
  },
  sectionRowStacked: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: spacing[1],
  },
  // 15/600 (phone) · 18/600 (tablet).
  heading: {
    ...font(600),
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  headingTablet: {
    ...font(600),
    flexShrink: 1,
    fontSize: 18,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  headingAlone: {
    paddingHorizontal: spacing[1],
  },
  count: {
    ...font(400),
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  countPill: {
    minHeight: 28,
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
    borderRadius: radii.full,
    backgroundColor: colors.fillSkeleton,
  },
  countPillText: {
    ...font(500),
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  // Undrawn, kept: 13/600 secondary, padding 4 4 0.
  category: {
    ...font(600),
    paddingTop: spacing[1],
    paddingHorizontal: spacing[1],
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  tileRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  tileRowTablet: {
    gap: spacing[4],
  },
  tileCell: {
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
