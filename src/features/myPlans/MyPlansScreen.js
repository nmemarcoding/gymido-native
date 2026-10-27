import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { routes } from '../../navigation/routes';
import EmptyState from '../../shared/components/EmptyState';
import ErrorAlert from '../../shared/components/ErrorAlert';
import Loader from '../../shared/components/Loader';
import PillButton from '../../shared/components/PillButton';
import StateSlot from '../../shared/components/StateSlot';
import { useFocusRemountKey } from '../../shared/hooks/useFocusRemountKey';
import { breakpoints, colors, textScale } from '../../shared/theme/tokens';
import { PageSubtitle, PageTitle, PlanPage, TextLink } from '../trainer/plans/components/PlanPage';
import { isGeneratorAvailable, listMyPlans } from './api/myPlansApi';
import MyPlanCard from './components/MyPlanCard';
import OnHoldBox from './components/OnHoldBox';
import { myPlansLoadFailure } from './myPlanFormat';
import { myPlanRoutes } from './myPlanRoutes';

// M1 (RN-SPEC-MEMBER-PLANS §M1), path /plans/mine. A fresh mount on every focus.
export default function MyPlansScreen() {
  const remountKey = useFocusRemountKey();
  return <MyPlansList key={remountKey} />;
}

function MyPlansList() {
  const navigation = useNavigation();
  const { width, fontScale } = useWindowDimensions();
  // UX §9 rule 4: above 1.3× text the empty state's button pair stacks, full
  // width ("Create a plan" stays on top).
  const stackEmpty = fontScale > textScale.reflowAbove;
  // Two columns at ≥640: half of the 896-capped column minus the 16 gap.
  const halfWidth = width >= breakpoints.sm ? (Math.min(width - 32, 896) - 16) / 2 : null;
  const [page, setPage] = useState(1);
  const [reloadCount, setReloadCount] = useState(0);
  // status: loading | loaded | error | onHold
  const [state, setState] = useState({ status: 'loading', result: null, message: '' });
  const [generator, setGenerator] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    // RN-SPEC-PLAN-GENERATOR G-E2: one profile read per focus (⚠G-1).
    isGeneratorAvailable().then((available) => mounted.current && setGenerator(available));
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let current = true;
    // Every reload clears the on-hold state first, so a reload shows the loader.
    setState({ status: 'loading', result: null, message: '' });
    listMyPlans(page)
      .then((result) => {
        if (current && mounted.current) {
          setState({ status: 'loaded', result, message: '' });
        }
      })
      .catch((error) => {
        if (current && mounted.current) {
          setState({ result: null, ...myPlansLoadFailure(error) });
        }
      });
    return () => {
      current = false;
    };
  }, [page, reloadCount]);

  const retry = useCallback(() => setReloadCount((count) => count + 1), []);
  const openCreate = () => navigation.push(myPlanRoutes.MyPlanCreate);
  const openCatalog = () => navigation.push(routes.PlansLibrary);
  const onHold = state.status === 'onHold';

  return (
    <PlanPage testID="my-plans-screen">
      <TextLink testID="my-plans-all-plans" label="← All plans" onPress={openCatalog} style={styles.backLink} />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {/* Batch A: no "Library" eyebrow; the title is the first line. */}
          <PageTitle style={styles.firstTitle}>My plans</PageTitle>
          <PageSubtitle>Plans you build or copy from the catalog. Only you can see them.</PageSubtitle>
        </View>
        {onHold ? null : (
          <View style={styles.headerButtons}>
            {/* Only while the generator screens are part of the build. */}
            {generator && myPlanRoutes.PlanGenerator ? (
              <PillButton
                testID="my-plans-generate"
                title="Build me a plan"
                variant="secondary"
                onPress={() => navigation.push(myPlanRoutes.PlanGenerator)}
              />
            ) : null}
            <PillButton testID="my-plans-create" title="Create a plan" onPress={openCreate} />
          </View>
        )}
      </View>
      {renderBody()}
    </PlanPage>
  );

  function renderBody() {
    if (onHold) {
      return <OnHoldBox message={state.message} />;
    }
    if (state.status === 'error') {
      return (
        <StateSlot>
          <ErrorAlert title="Could not load your plans" description={state.message} onRetry={retry} />
        </StateSlot>
      );
    }
    if (state.status === 'loading') {
      return (
        <StateSlot>
          <Loader label="Loading your plans" style={styles.loader} />
        </StateSlot>
      );
    }
    const { items, currentPage, totalPages, totalRecords } = state.result;
    if (items.length === 0) {
      return (
        // §D1: compact 44 actions, both glass: the header's "Create a plan"
        // is the page's one gold action (UX, 26 Oct 2026).
        <StateSlot style={styles.empty}>
          <EmptyState
            title="No plans yet"
            message="Create a plan from scratch, or copy one from the catalog to make it yours."
          />
          <View testID="my-plans-empty-buttons" style={[styles.emptyButtons, stackEmpty && styles.emptyButtonsStacked]}>
            <PillButton
              testID="my-plans-empty-create"
              title="Create a plan"
              variant="secondary"
              size="compact"
              fullWidth={stackEmpty}
              onPress={openCreate}
            />
            <PillButton
              testID="my-plans-browse"
              title="Browse the catalog"
              variant="secondary"
              size="compact"
              fullWidth={stackEmpty}
              onPress={openCatalog}
            />
          </View>
        </StateSlot>
      );
    }
    return (
      <>
        {/* ⚠M-6: server order, active and inactive mixed. */}
        <View style={styles.grid}>
          {items.map((plan) => (
            <MyPlanCard
              key={plan.id}
              plan={plan}
              style={halfWidth ? { width: halfWidth } : styles.fullCard}
              onOpen={() => navigation.push(myPlanRoutes.MyPlan, { planId: plan.id })}
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
                testID="my-plans-previous"
                title="Previous"
                variant="secondary"
                disabled={currentPage <= 1}
                onPress={() => setPage(currentPage - 1)}
              />
              <PillButton
                testID="my-plans-next"
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
  // Batch A: the 44pt text-link hit area.
  backLink: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
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
  firstTitle: {
    marginTop: 0,
  },
  headerButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  loader: {
    paddingVertical: 48,
  },
  empty: {
    gap: 12,
  },
  emptyButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  emptyButtonsStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
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
