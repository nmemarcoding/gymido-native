import { useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { routes } from '../../../../navigation/routes';
import { getServerMessage, getStatus } from '../../../../shared/api/apiError';
import ConfirmDialog from '../../../../shared/components/ConfirmDialog';
import EmptyState from '../../../../shared/components/EmptyState';
import ErrorAlert from '../../../../shared/components/ErrorAlert';
import Loader from '../../../../shared/components/Loader';
import PillButton from '../../../../shared/components/PillButton';
import { ToastTone, addToast } from '../../../../shared/components/toastStore';
import { useFocusRemountKey } from '../../../../shared/hooks/useFocusRemountKey';
import { breakpoints, colors } from '../../../../shared/theme/tokens';
import TrainerOnly from '../../TrainerOnly';
import { assignPlan } from '../../clients/api/clientsApi';
import { openClientDetail } from '../../clients/clientLinks';
import { listTrainerPlans } from '../api/plansApi';
import PlanCard from '../components/PlanCard';
import { PageEyebrow, PlanPage, PageSubtitle, PageTitle, TextLink } from '../components/PlanPage';

// T1 (spec §A4): browse mode, or assign mode with the `assignTo` param.
export default function PlansListScreen() {
  const remountKey = useFocusRemountKey();
  const assignTo = useRoute().params?.assignTo;
  return (
    <TrainerOnly>
      <PlansList key={`${assignTo ?? 'browse'}-${remountKey}`} assignTo={assignTo} />
    </TrainerOnly>
  );
}

function PlansList({ assignTo }) {
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  // Two columns at ≥640: half of the 896-capped column minus the 16 gap.
  const halfWidth = width >= breakpoints.sm ? (Math.min(width - 32, 896) - 16) / 2 : null;
  const [page, setPage] = useState(1);
  const [reloadCount, setReloadCount] = useState(0);
  const [state, setState] = useState({ status: 'loading', result: null, error: '' });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let current = true;
    setState({ status: 'loading', result: null, error: '' });
    listTrainerPlans(page)
      .then((result) => {
        if (current && mounted.current) {
          setState({ status: 'loaded', result, error: '' });
        }
      })
      .catch((error) => {
        if (current && mounted.current) {
          setState({ status: 'error', result: null, error: getServerMessage(error) });
        }
      });
    return () => {
      current = false;
    };
  }, [page, reloadCount]);

  const retry = useCallback(() => setReloadCount((count) => count + 1), []);

  // §A4.4 assign flow.
  const [assigning, setAssigning] = useState(false);
  const [pendingAssign, setPendingAssign] = useState(null);

  async function assign(plan, replace) {
    setAssigning(true);
    try {
      await assignPlan(assignTo, plan.id, replace);
      addToast(ToastTone.success, replace ? 'Plan replaced' : 'Plan assigned', `${plan.name} is now their active plan.`);
      setPendingAssign(null);
    } catch (error) {
      const status = getStatus(error);
      if (status === 409 && !replace) {
        // The client already has an active plan: offer to replace it.
        setPendingAssign({ plan });
      } else {
        let message = 'We could not assign the plan. Please try again.';
        if (status === 404) {
          message = 'They are no longer one of your active clients.';
        } else if (status === 409) {
          message = getServerMessage(error);
        }
        addToast(ToastTone.error, 'Could not assign', message);
        setPendingAssign(null);
      }
    }
    if (mounted.current) {
      setAssigning(false);
    }
  }

  return (
    <PlanPage>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <PageEyebrow>Coaching</PageEyebrow>
          <PageTitle>Plans</PageTitle>
          <PageSubtitle>
            {assignTo
              ? `Pick a plan to assign to client #${assignTo}.`
              : 'The public catalog plus your own private plans. You can edit the plans you created; to change any other plan, copy it first, then assign the copy.'}
          </PageSubtitle>
        </View>
        <PillButton
          testID="plans-create"
          title="Create a plan"
          onPress={() => navigation.push(routes.TrainerPlanCreate)}
        />
      </View>
      {assignTo ? (
        // ⚠T1-2: the client is named by id.
        <TextLink testID="plans-back-to-client" label={`← Back to client #${assignTo}`} onPress={() => openClientDetail(assignTo)} />
      ) : null}
      {renderBody()}
      <ConfirmDialog
        testID="replace-plan-dialog"
        isOpen={pendingAssign !== null}
        onClose={() => setPendingAssign(null)}
        onConfirm={() => assign(pendingAssign.plan, true)}
        title="Replace their current plan?"
        description={`This client already has an active plan. Assigning ${pendingAssign?.plan?.name || 'this plan'} will end the current one and start this instead. Their history is kept.`}
        confirmLabel="Replace plan"
        tone="danger"
        loading={assigning}
      />
    </PlanPage>
  );

  function renderBody() {
    if (state.status === 'error') {
      return <ErrorAlert title="Could not load plans" description={state.error} onRetry={retry} />;
    }
    if (state.status === 'loading') {
      return <Loader label="Loading plans" style={styles.loader} />;
    }
    const { items, currentPage, totalPages, totalRecords } = state.result;
    if (items.length === 0) {
      return <EmptyState title="No plans yet" message="Create a private plan to build one for your clients." />;
    }
    return (
      <>
        <View style={styles.grid}>
          {items.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              style={halfWidth ? { width: halfWidth } : styles.fullCard}
              // ⚠T1-3: the spinner shows only while T1a's replace runs for this plan.
              assignLoading={assigning && pendingAssign?.plan?.id === plan.id}
              onAssign={assignTo ? () => assign(plan, false) : undefined}
              onView={() => navigation.push(routes.TrainerPlan, { planId: plan.id })}
            />
          ))}
        </View>
        {totalPages > 1 ? (
          <View style={styles.pager}>
            <Text style={styles.pagerText}>
              Page {currentPage} of {totalPages} · {totalRecords} total
            </Text>
            <View style={styles.pagerButtons}>
              <PillButton
                testID="plans-previous"
                title="Previous"
                variant="secondary"
                disabled={currentPage <= 1}
                onPress={() => setPage(currentPage - 1)}
              />
              <PillButton
                testID="plans-next"
                title="Next"
                variant="secondary"
                disabled={currentPage >= totalPages}
                onPress={() => setPage(currentPage + 1)}
              />
            </View>
          </View>
        ) : null}
      </>
    );
  }
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerLeft: {
    minWidth: 0,
    flexShrink: 1,
  },
  loader: {
    paddingVertical: 48,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  fullCard: {
    width: '100%',
  },
  pager: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  pagerText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  pagerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
});
