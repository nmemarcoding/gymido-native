import { useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { routes } from '../../../../navigation/routes';
import { getServerMessage, getStatus } from '../../../../shared/api/apiError';
import ConfirmDialog from '../../../../shared/components/ConfirmDialog';
import EmptyState from '../../../../shared/components/EmptyState';
import ErrorAlert from '../../../../shared/components/ErrorAlert';
import { CAP_BODY, DISPLAY_TITLE_TEXT, TITLE_TEXT, useLargeTextReflow } from '../../../../shared/components/largeText';
import Loader from '../../../../shared/components/Loader';
import PillButton from '../../../../shared/components/PillButton';
import StateSlot from '../../../../shared/components/StateSlot';
import TextLink from '../../../../shared/components/TextLink';
import { ToastTone, addToast } from '../../../../shared/components/toastStore';
import { useFocusRemountKey } from '../../../../shared/hooks/useFocusRemountKey';
import { breakpoints, colors, font, gradients, layout, radii, spacing, typography } from '../../../../shared/theme/tokens';
import ShellPage from '../../../shell/ShellPage';
import TrainerOnly from '../../TrainerOnly';
import { assignPlan } from '../../clients/api/clientsApi';
import { openClientSelection } from '../../clients/clientLinks';
import { listTrainerPlans } from '../api/plansApi';
import PlanCard from '../components/PlanCard';
import { CoachingChip, PlusIcon } from '../components/TrainerChips';
import { keepUnitsTogether } from '../../../../shared/format/counts';
import { HeroTitleMark } from '../../../shell/heroTitle';

export const BROWSE_SUBTITLE =
  'The public catalog plus your own private plans. You can edit the plans you created; to change any other plan, copy it first, then assign the copy.';

// TabletTrainerPlans' page wash (70 % 36 % at 90 % −6 %): the §8.5 gold
// ambient (0.18; the board's 0.16 folds onto the ladder). Phones: none.
export const TABLET_PLANS_GLOW = Object.freeze({
  radial: Object.freeze({ cx: 0.9, cy: -0.06, rx: 0.7, ry: 0.36 }),
  colors: gradients.accountGlow.colors,
  stops: Object.freeze([0, 0.7]),
});

// Grid columns (UX O): tablet 2; phone 2 in browse mode, ONE in assign mode
// (so View + Assign fit) and one above the §9 reflow point.
export function planColumns({ tablet, assigning, reflow }) {
  if (tablet) {
    return 2;
  }
  return assigning || reflow ? 1 : 2;
}

// Rows of `columns` cells; a short last row is padded with empty cells so
// every card keeps the column width.
export function chunkRows(items, columns) {
  const rows = [];
  for (let index = 0; index < items.length; index += columns) {
    rows.push(items.slice(index, index + columns));
  }
  return rows;
}

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
  const tablet = width >= breakpoints.md;
  const reflow = useLargeTextReflow();
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

  // §A4.4 assign flow: one request per tap. `assigningId` is the plan whose
  // request is in flight (its card shows busy from the first tap; the dialog
  // shows it for a replace). A double tap lands both presses before that
  // re-renders, so a SYNCHRONOUS ref guard, set before the POST and cleared in
  // `finally`, drops the 2nd tap (else it 409s and opens "Replace…").
  const [assigningId, setAssigningId] = useState(null);
  const [pendingAssign, setPendingAssign] = useState(null);
  const assignInFlight = useRef(false);

  async function assign(plan, replace) {
    if (assignInFlight.current) {
      return;
    }
    assignInFlight.current = true;
    setAssigningId(plan.id);
    try {
      await assignPlan(assignTo, plan.id, replace);
      addToast(ToastTone.success, replace ? 'Plan replaced' : 'Plan assigned', `${keepUnitsTogether(plan.name)} is now their active plan.`);
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
    } finally {
      assignInFlight.current = false;
      if (mounted.current) {
        setAssigningId(null);
      }
    }
  }

  const openCreate = () => navigation.push(routes.TrainerPlanCreate);
  // UX ruling 4: in assign mode "Create a plan" is glass (Assign is the gold
  // role); in browse mode it is the one gold action.
  const createButton = (
    <PillButton
      testID="plans-create"
      title="Create a plan"
      variant={assignTo ? 'secondary' : 'primary'}
      size={tablet ? 'default' : 'compact'}
      icon={({ color }) => <PlusIcon color={color} size={tablet ? 18 : 16} />}
      onPress={openCreate}
    />
  );

  return (
    <ShellPage testID="trainer-plans-screen" glow={tablet ? TABLET_PLANS_GLOW : false}>
      <View testID="plans-column" style={[styles.column, tablet && styles.columnTablet]}>
        <View testID="plans-header" style={[styles.header, reflow && styles.headerStacked]}>
          <View style={[styles.headerLeft, tablet && styles.headerLeftTablet]}>
            <CoachingChip testID="plans-eyebrow" />
            <HeroTitleMark />
            <Text
              {...(tablet ? DISPLAY_TITLE_TEXT : TITLE_TEXT)}
              accessibilityRole="header"
              style={tablet ? styles.titleTablet : styles.title}
            >
              Plans
            </Text>
            {tablet ? <Subtitle assignTo={assignTo} tablet /> : null}
          </View>
          {createButton}
        </View>
        {tablet ? null : <Subtitle assignTo={assignTo} />}
        {assignTo ? (
          // ⚠T1-2: the client is named by id.
          <TextLink testID="plans-back-to-client" label={`← Back to client #${assignTo}`} onPress={() => openClientSelection(assignTo)} />
        ) : null}
        {renderBody()}
      </View>
      <ConfirmDialog
        testID="replace-plan-dialog"
        isOpen={pendingAssign !== null}
        onClose={() => setPendingAssign(null)}
        onConfirm={() => assign(pendingAssign.plan, true)}
        title="Replace their current plan?"
        description={`This client already has an active plan. Assigning ${keepUnitsTogether(pendingAssign?.plan?.name) || 'this plan'} will end the current one and start this instead. Their history is kept.`}
        confirmLabel="Replace plan"
        tone="danger"
        loading={assigningId !== null}
      />
    </ShellPage>
  );

  function renderBody() {
    if (state.status === 'error') {
      return (
        <StateSlot>
          <ErrorAlert title="Could not load plans" description={state.error} onRetry={retry} />
        </StateSlot>
      );
    }
    if (state.status === 'loading') {
      return (
        <StateSlot>
          <Loader label="Loading plans" style={styles.loader} />
        </StateSlot>
      );
    }
    const { items, currentPage, totalPages, totalRecords } = state.result;
    if (items.length === 0) {
      return (
        <StateSlot>
          <EmptyState title="No plans yet" message="Create a private plan to build one for your clients." />
        </StateSlot>
      );
    }
    const columns = planColumns({ tablet, assigning: Boolean(assignTo), reflow });
    // UX ruling 2: the phone grid ends with the dashed "Create a plan" tile
    // (the header button's action), in browse mode.
    const cells = items.map((plan) => ({ key: `plan-${plan.id}`, plan }));
    if (!tablet && !assignTo) {
      cells.push({ key: 'create-tile', tile: true });
    }
    return (
      <>
        <View testID="plans-grid" style={[styles.grid, tablet && styles.gridTablet]}>
          {chunkRows(cells, columns).map((row) => (
            <View key={row[0].key} style={[styles.row, tablet && styles.rowTablet]}>
              {row.map((cell) =>
                cell.tile ? (
                  <CreateTile key={cell.key} onPress={openCreate} />
                ) : (
                  <PlanCard
                    key={cell.key}
                    plan={cell.plan}
                    tablet={tablet}
                    stacked={reflow}
                    style={styles.cell}
                    // ⚠T1-3: the spinner shows only while T1a's replace runs for this plan.
                    assignLoading={assigningId === cell.plan.id}
                    onAssign={assignTo ? () => assign(cell.plan, false) : undefined}
                    onView={() => navigation.push(routes.TrainerPlan, { planId: cell.plan.id })}
                  />
                ),
              )}
              {Array.from({ length: columns - row.length }, (_, index) => (
                <View key={`pad-${index}`} style={styles.cell} />
              ))}
            </View>
          ))}
        </View>
        {totalPages > 1 ? (
          <Pager
            tablet={tablet}
            reflow={reflow}
            currentPage={currentPage}
            totalPages={totalPages}
            totalRecords={totalRecords}
            onPage={setPage}
          />
        ) : null}
      </>
    );
  }
}

function Subtitle({ assignTo, tablet = false }) {
  return (
    <Text testID="plans-subtitle" {...CAP_BODY} style={tablet ? styles.subtitleTablet : styles.subtitle}>
      {assignTo ? `Pick a plan to assign to client #${assignTo}.` : BROWSE_SUBTITLE}
    </Text>
  );
}

function CreateTile({ onPress }) {
  return (
    <Pressable
      testID="plans-create-tile"
      accessibilityRole="button"
      accessibilityLabel="Create a plan"
      onPress={onPress}
      style={[styles.cell, styles.tile]}
    >
      {({ pressed }) => (
        <>
          {pressed ? <View testID="plans-create-tile-pressed" pointerEvents="none" style={[StyleSheet.absoluteFill, styles.tilePressed]} /> : null}
          <PlusIcon color={colors.textSecondary} size={22} />
          <Text {...CAP_BODY} style={styles.tileText}>
            Create a plan
          </Text>
        </>
      )}
    </Pressable>
  );
}

// "Page {c} of {t} · {n} total" (code; the board's "Sample data" is an
// annotation). Phone: Previous | text | Next on one row (text first and the
// buttons below at large text); tablet: the glass pill with the text at the
// left and Previous + a LIGHT Next at the right.
function Pager({ tablet, reflow, currentPage, totalPages, totalRecords, onPage }) {
  const text = (
    <Text
      testID="plans-page-status"
      {...CAP_BODY}
      accessibilityLiveRegion="polite"
      style={[styles.pagerText, tablet && styles.pagerTextTablet, !tablet && !reflow && styles.pagerTextPhone]}
    >
      Page {currentPage} of {totalPages} · {totalRecords} total
    </Text>
  );
  const previous = (
    <PillButton
      testID="plans-previous"
      title="Previous"
      variant="secondary"
      size="compact"
      disabled={currentPage <= 1}
      onPress={() => onPage(currentPage - 1)}
    />
  );
  const next = (
    <PillButton
      testID="plans-next"
      title="Next"
      variant={tablet ? 'light' : 'secondary'}
      size="compact"
      disabled={currentPage >= totalPages}
      onPress={() => onPage(currentPage + 1)}
    />
  );
  if (tablet) {
    return (
      <View testID="plans-pager" accessibilityLabel="Pagination" style={[styles.pagerTablet, reflow && styles.pagerStacked]}>
        {text}
        <View style={styles.pagerButtons}>
          {previous}
          {next}
        </View>
      </View>
    );
  }
  if (reflow) {
    return (
      <View testID="plans-pager" accessibilityLabel="Pagination" style={styles.pagerStacked}>
        {text}
        <View style={styles.pagerButtons}>
          {previous}
          {next}
        </View>
      </View>
    );
  }
  return (
    <View testID="plans-pager" accessibilityLabel="Pagination" style={styles.pager}>
      {previous}
      {text}
      {next}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    width: '100%',
    alignSelf: 'center',
    gap: spacing['3_5'],
    paddingBottom: spacing[6],
  },
  columnTablet: {
    maxWidth: layout.contentMax,
    gap: spacing[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing[3],
    paddingHorizontal: spacing[1],
  },
  // UX §9 reflow: the header action drops below the title.
  headerStacked: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flexShrink: 1,
    minWidth: 0,
    gap: spacing[2],
  },
  headerLeftTablet: {
    maxWidth: 440,
    gap: 0,
  },
  // title-xl (board 34/40).
  title: {
    ...typography.titleXl,
    color: colors.textPrimary,
  },
  // display-xl (board 60/58 −0.06em).
  titleTablet: {
    ...typography.displayXl,
    marginTop: spacing[3],
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.bodySm,
    marginTop: -spacing['1_5'],
    paddingHorizontal: spacing[1],
    color: colors.textMuted,
  },
  subtitleTablet: {
    ...typography.bodySm,
    lineHeight: 21,
    marginTop: spacing['2_5'],
    color: colors.textSecondary,
  },
  loader: {
    paddingVertical: 48,
  },
  grid: {
    gap: spacing[3],
  },
  gridTablet: {
    gap: spacing['3_5'],
  },
  row: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  rowTablet: {
    gap: spacing['3_5'],
  },
  cell: {
    flex: 1,
    minWidth: 0,
  },
  // The dashed tile: radius 24, padding 16, 1 px dashed white (board 0.16 →
  // hairlineBright 0.18, the nearest white edge), icon 22 + 14/500.
  tile: {
    minHeight: 112,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    padding: spacing[4],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.hairlineBright,
  },
  tilePressed: {
    borderRadius: radii.xl,
    backgroundColor: colors.pressOverlay,
  },
  tileText: {
    ...typography.bodySm,
    ...font(500),
    textAlign: 'center',
    color: colors.textSecondary,
  },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
    paddingHorizontal: spacing[1],
  },
  pagerStacked: {
    gap: spacing[3],
  },
  pagerTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    paddingVertical: spacing['1_5'],
    paddingLeft: spacing['4_5'],
    paddingRight: spacing['1_5'],
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.choiceBorder,
    backgroundColor: colors.glass,
  },
  pagerText: {
    ...typography.label,
    ...font(400),
    color: colors.textMuted,
  },
  pagerTextPhone: {
    flexShrink: 1,
    textAlign: 'center',
  },
  pagerTextTablet: {
    ...typography.bodySm,
    flexShrink: 1,
  },
  pagerButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing['2_5'],
  },
});
