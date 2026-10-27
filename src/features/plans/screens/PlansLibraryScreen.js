import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { routes } from '../../../navigation/routes';
import { getStatus } from '../../../shared/api/apiError';
import EmptyState from '../../../shared/components/EmptyState';
import { RetryButton } from '../../../shared/components/ErrorAlert';
import { InlineError } from '../../../shared/components/FeedbackBox';
import { CAP_BODY, CAP_PILL } from '../../../shared/components/largeText';
import Loader from '../../../shared/components/Loader';
import PillButton from '../../../shared/components/PillButton';
import StateSlot from '../../../shared/components/StateSlot';
import { useFocusRemountKey } from '../../../shared/hooks/useFocusRemountKey';
import { colors, font, radii, spacing } from '../../../shared/theme/tokens';
import { listMyPlans } from '../../myPlans/api/myPlansApi';
import { myPlanRoutes } from '../../myPlans/myPlanRoutes';
import ShellPage from '../../shell/ShellPage';
import { getCurrentPlan, listPlans } from '../api/libraryApi';
import ActivePlanCard from '../components/ActivePlanCard';
import PlanEntryTiles from '../components/PlanEntryTiles';
import PlanIcon from '../components/planIcons';
import PlanTile from '../components/PlanTile';
import { useIsTablet, useReflow } from '../components/planUi';
import { deriveLibrary, planCountLabel, weekChips } from '../libraryFormat';

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

function PlansLibrary() {
  const navigation = useNavigation();
  const tablet = useIsTablet();
  const reflow = useReflow();
  const canCreate = useCanCreatePlan(tablet);
  const [reloadCount, setReloadCount] = useState(0);
  const [load, setLoad] = useState({ status: 'loading', plans: [], currentPlan: null, error: null });

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
    return (
      <>
        {header}
        <StateSlot loader>
          <Loader label="Loading plans" />
        </StateSlot>
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
});
