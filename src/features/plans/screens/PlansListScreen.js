import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { routes } from '../../../navigation/routes';
import { LargeTitleHeader } from '../../../navigation/shell/PageHeaders';
import PageLayout from '../../../navigation/shell/PageLayout';
import { useFocusGeneration } from '../../../navigation/shell/useFocusGeneration';
import { EmptyState, InlineError, Loader } from '../../../shared/components/feedback';
import { colors, textStyles } from '../../../shared/theme/tokens';
import { getCurrentPlan, getWorkoutPlans } from '../api/plansApi';
import { ActivePlanCard, PlanCard } from '../components/PlanCards';
import { SectionHeading } from '../components/PlanBits';
import { derivePlansList, plural } from '../planRules';

// S1 content. Keyed on the focus generation, so each focus starts from the
// initial state and reloads (RN-SPEC-plans §8.1).
function PlansListContent({ generation, isCurrent }) {
  const navigation = useNavigation();
  const [plans, setPlans] = useState([]);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const alive = () => isMounted && isCurrent(generation);

    const load = async () => {
      setStatus('loading');
      setError(null);
      try {
        const [plansResult, currentPlanResult] = await Promise.all([
          getWorkoutPlans(),
          getCurrentPlan().catch((currentPlanError) => {
            if (currentPlanError?.response?.status === 404) {
              return null;
            }
            throw currentPlanError;
          }),
        ]);
        if (!alive()) {
          return;
        }
        setPlans(plansResult?.items || []);
        setCurrentPlan(currentPlanResult);
        setStatus('loaded');
      } catch (loadError) {
        if (!alive()) {
          return;
        }
        setError(loadError);
        setStatus('error');
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [generation, isCurrent]);

  if (status === 'loading') {
    return <Loader label="Loading plans" />;
  }

  if (status === 'error') {
    // Transport message, no retry button (⚠4).
    return <InlineError title="Plans unavailable" message={error?.message || 'Please try again.'} />;
  }

  const {
    hasActivePlan,
    activePlanDetail,
    activeWeekdays,
    groups,
    browseCount,
    showCategoryHeaders,
    noPlansAtAll,
  } = derivePlansList(plans, currentPlan);

  const openPlan = (planId) => navigation.push(routes.PlanDetail, { planId: String(planId) });

  return (
    <View style={styles.content}>
      {hasActivePlan ? (
        <ActivePlanCard
          plan={activePlanDetail}
          weekdays={activeWeekdays}
          onGoToWorkout={() => navigation.navigate(routes.WorkoutTab)}
          onViewPlan={() => openPlan(activePlanDetail.id)}
        />
      ) : null}

      {noPlansAtAll ? (
        <EmptyState title="No plans available" message="No active workout plans were returned by the backend." />
      ) : null}

      {browseCount > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <SectionHeading>{hasActivePlan ? 'Switch your plan' : 'Choose your next plan'}</SectionHeading>
            <View style={styles.countPill}>
              <Text style={styles.countText}>{`${browseCount} ${plural(browseCount, 'plan')}`}</Text>
            </View>
          </View>
          {groups.map(([categoryName, groupPlans]) => (
            <View key={categoryName} style={styles.group}>
              {showCategoryHeaders ? <Text style={styles.categoryHeading}>{categoryName}</Text> : null}
              {groupPlans.map((plan) => (
                <PlanCard key={plan.id} plan={plan} onPress={() => openPlan(plan.id)} />
              ))}
            </View>
          ))}
        </View>
      ) : !hasActivePlan && !noPlansAtAll ? (
        <SectionHeading style={styles.soloHeading}>Choose your next plan</SectionHeading>
      ) : null}
    </View>
  );
}

// S1 — Plans list ("Library").
export default function PlansListScreen() {
  const { generation, isCurrent } = useFocusGeneration();
  return (
    <PageLayout testID="plans-list-screen">
      <LargeTitleHeader title="Library" />
      {generation === 0 ? (
        <Loader label="Loading plans" />
      ) : (
        <PlansListContent key={generation} generation={generation} isCurrent={isCurrent} />
      )}
    </PageLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 20,
    paddingBottom: 16,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 4,
  },
  countPill: {
    borderRadius: 9999,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countText: {
    ...textStyles.pill,
    color: colors.textMuted,
  },
  group: {
    gap: 12,
  },
  categoryHeading: {
    ...textStyles.categorySubheading,
    color: colors.textMuted,
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  soloHeading: {
    paddingHorizontal: 4,
  },
});
