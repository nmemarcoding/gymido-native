import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { routes } from '../../navigation/routes';
import EmptyState from '../../shared/components/EmptyState';
import ErrorAlert from '../../shared/components/ErrorAlert';
import { CAP_BODY, DISPLAY_TITLE_TEXT } from '../../shared/components/largeText';
import Loader from '../../shared/components/Loader';
import PillButton from '../../shared/components/PillButton';
import StateSlot from '../../shared/components/StateSlot';
import TextLink from '../../shared/components/TextLink';
import { useFocusRemountKey } from '../../shared/hooks/useFocusRemountKey';
import { breakpoints, colors, font, gradients, layout, spacing, textScale, typography } from '../../shared/theme/tokens';
import PlanIcon from '../plans/components/planIcons';
import ShellPage from '../shell/ShellPage';
import { isGeneratorAvailable, listMyPlans } from './api/myPlansApi';
import MyPlanCard from './components/MyPlanCard';
import OnHoldBox from './components/OnHoldBox';
import { myPlansLoadFailure } from './myPlanFormat';
import { myPlanRoutes } from './myPlanRoutes';

// The boards' page glow, glow-gold-ambient (0.18; the drawn 0.16 / 0.14
// fold into it): phone radial-gradient(110% 45% at 90% −8%, … 60%), tablet
// (70% 40% at 85% −8%, … 60%).
export const MY_PLANS_GLOW = Object.freeze({
  radial: Object.freeze({ cx: 0.9, cy: -0.08, rx: 1.1, ry: 0.45 }),
  colors: gradients.accountGlow.colors,
  stops: Object.freeze([0, 0.6]),
});
export const MY_PLANS_GLOW_TABLET = Object.freeze({
  radial: Object.freeze({ cx: 0.85, cy: -0.08, rx: 0.7, ry: 0.4 }),
  colors: gradients.accountGlow.colors,
  stops: Object.freeze([0, 0.6]),
});

// M1 (RN-SPEC-MEMBER-PLANS §M1), path /plans/mine; v2 look per UX H (My
// plans #14, Tablet: My plans #90). A fresh mount on every focus.
export default function MyPlansScreen() {
  const remountKey = useFocusRemountKey();
  const { width } = useWindowDimensions();
  const tablet = width >= breakpoints.md;
  return (
    <ShellPage testID="my-plans-screen" glow={tablet ? MY_PLANS_GLOW_TABLET : MY_PLANS_GLOW}>
      <MyPlansList key={remountKey} />
    </ShellPage>
  );
}

function MyPlansList() {
  const navigation = useNavigation();
  const { width, fontScale } = useWindowDimensions();
  const tablet = width >= breakpoints.md;
  // UX §9 rule 4: above 1.3× text button pairs stack, full width ("Create a
  // plan" stays on top), and the tablet grid becomes one column.
  const stackEmpty = fontScale > textScale.reflowAbove;
  // UX native final audit 27 Oct 2026, B215 (button-pair rule): the labels
  // never wrap. The pair needs PAIR_ONE_LINE × the font scale for both on one
  // line (wider than 21rem), so a narrower row (every phone) stacks: gold
  // "Create a plan" full width over the glass "Build me a plan". The row is
  // measured; until then it is the window minus the phone gutters.
  const [rowWidth, setRowWidth] = useState(null);
  const pairRow = rowWidth ?? width - layout.gutter * 2;
  const [generator, setGenerator] = useState(false);
  const pairTooNarrow = Boolean(generator && myPlanRoutes.PlanGenerator) && pairRow < PAIR_ONE_LINE * fontScale;
  const reflow = stackEmpty || pairTooNarrow;
  const [page, setPage] = useState(1);
  const [reloadCount, setReloadCount] = useState(0);
  // status: loading | loaded | error | onHold
  const [state, setState] = useState({ status: 'loading', result: null, message: '' });
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

  const showGenerator = generator && myPlanRoutes.PlanGenerator;

  return (
    <View testID="my-plans-content" style={[styles.column, tablet && styles.columnTablet]}>
      <TextLink testID="my-plans-all-plans" label="← All plans" onPress={openCatalog} />
      <View style={styles.header}>
        {/* Batch A: no "Library" eyebrow; the title is the first line. */}
        <Text {...DISPLAY_TITLE_TEXT} accessibilityRole="header" style={tablet ? styles.titleTablet : styles.title}>
          My plans
        </Text>
        <Text {...CAP_BODY} style={tablet ? styles.subtitleTablet : styles.subtitle}>
          Plans you build or copy from the catalog. Only you can see them.
        </Text>
      </View>
      {onHold ? null : (
        <View
          testID="my-plans-actions"
          onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)}
          style={[styles.actions, tablet && styles.actionsTablet, reflow && styles.actionsStacked]}
        >
          <PillButton
            testID="my-plans-create"
            title="Create a plan"
            icon={({ color }) => <PlanIcon name="plus" size={18} color={color} />}
            fullWidth={reflow}
            style={!tablet && !reflow ? styles.actionGrow : null}
            onPress={openCreate}
          />
          {/* Only while the generator screens are part of the build. */}
          {showGenerator ? (
            <PillButton
              testID="my-plans-generate"
              title="Build me a plan"
              variant="secondary"
              icon={({ color }) => <PlanIcon name="spark" size={18} color={color} />}
              fullWidth={reflow}
              style={!tablet && !reflow ? styles.actionGrow : null}
              onPress={() => navigation.push(myPlanRoutes.PlanGenerator)}
            />
          ) : null}
        </View>
      )}
      {renderBody()}
    </View>
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
        {/* ⚠M-6: server order, active and inactive mixed. Tablet: the first
            card is featured (full width), the rest a 2-column grid. */}
        <View testID="my-plans-list" accessibilityRole="list" style={[styles.list, tablet && styles.listTablet]}>
          {listRows(items, tablet && !stackEmpty).map((row) => (
            <View key={row.map((plan) => plan.id).join('-')} style={[styles.row, tablet && styles.rowTablet]}>
              {row.map((plan) => (
                <MyPlanCard
                  key={plan.id}
                  plan={plan}
                  tablet={tablet}
                  featured={tablet && plan === items[0]}
                  style={styles.cell}
                  onOpen={() => navigation.push(myPlanRoutes.MyPlan, { planId: plan.id })}
                />
              ))}
              {tablet && !stackEmpty && row.length === 1 && row[0] !== items[0] ? <View style={styles.cell} /> : null}
            </View>
          ))}
        </View>
        {totalPages > 1 ? (
          <View testID="my-plans-pager" style={styles.pager}>
            <Text {...CAP_BODY} style={styles.pagerText}>
              Page {currentPage} of {totalPages} · {totalRecords} total
            </Text>
            <View style={styles.pagerButtons}>
              <PillButton
                testID="my-plans-previous"
                title="Previous"
                variant="secondary"
                size="compact"
                disabled={currentPage <= 1}
                onPress={() => setPage(currentPage - 1)}
              />
              <PillButton
                testID="my-plans-next"
                title="Next"
                variant="secondary"
                size="compact"
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

// Tablet rows: the featured first card alone, then pairs; phone (or past
// 1.3× text): one card per row.
function listRows(items, paired) {
  if (!paired) {
    return items.map((item) => [item]);
  }
  const rows = items.length ? [[items[0]]] : [];
  for (let index = 1; index < items.length; index += 2) {
    rows.push(items.slice(index, index + 2));
  }
  return rows;
}

// B215: two 52 pills (24 + 24 padding, 18 icon + 8 gap) with the 16/600
// labels "Create a plan" (≈ 108) and "Build me a plan" (≈ 125), + the 8 gap
// ≈ 389; rounded up.
const PAIR_ONE_LINE = 400;

const styles = StyleSheet.create({
  column: {
    width: '100%',
    maxWidth: layout.contentMax,
    alignSelf: 'center',
    gap: spacing[3],
    paddingBottom: spacing[6],
  },
  columnTablet: {
    gap: spacing['4_5'],
  },
  header: {
    paddingHorizontal: spacing[1],
  },
  // 46/46/700 −0.05em (phone) · 60/60/700 −0.055em (tablet), as drawn.
  title: {
    ...font(700),
    fontSize: 46,
    lineHeight: 48,
    letterSpacing: -2.3,
    color: colors.textPrimary,
  },
  titleTablet: {
    ...font(700),
    fontSize: 60,
    lineHeight: 62,
    letterSpacing: -3.3,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    marginTop: spacing['1_5'],
    color: colors.textSecondary,
  },
  subtitleTablet: {
    ...typography.bodyLg,
    marginTop: spacing[2],
    color: colors.textSecondary,
  },
  // Phone: padding 4 0 8, gap 8, both flex 1; tablet: inline, gap 10.
  actions: {
    flexDirection: 'row',
    gap: spacing[2],
    paddingTop: spacing[1],
    paddingBottom: spacing[2],
  },
  actionsTablet: {
    gap: spacing['2_5'],
  },
  actionsStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  actionGrow: {
    flex: 1,
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
  list: {
    gap: spacing[3],
  },
  listTablet: {
    gap: spacing[4],
  },
  row: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  rowTablet: {
    gap: spacing[4],
  },
  cell: {
    flex: 1,
    minWidth: 0,
  },
  pager: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  pagerText: {
    ...typography.bodySm,
    color: colors.textSecondary,
  },
  pagerButtons: {
    flexDirection: 'row',
    gap: spacing[3],
  },
});
