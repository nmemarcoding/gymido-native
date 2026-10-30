import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, Text, View, findNodeHandle, useWindowDimensions } from 'react-native';

import Chip from '../../../../shared/components/Chip';
import EmptyState from '../../../../shared/components/EmptyState';
import ErrorAlert from '../../../../shared/components/ErrorAlert';
import IconButton from '../../../../shared/components/IconButton';
import { CAP_BODY, NAME_TEXT, useLargeTextReflow } from '../../../../shared/components/largeText';
import Loader from '../../../../shared/components/Loader';
import StateSlot from '../../../../shared/components/StateSlot';
import StatusPill from '../../../../shared/components/StatusPill';
import { useFocusRemountKey } from '../../../../shared/hooks/useFocusRemountKey';
import { breakpoints, colors, font, gradients, radii, spacing } from '../../../../shared/theme/tokens';
import GradientFill from '../../../../shared/components/GradientFill';
import ShellPage from '../../../shell/ShellPage';
import TrainerOnly from '../../TrainerOnly';
import {
  ClientFilter,
  activityOf,
  anyActivity,
  filterClients,
  filterCounts,
  inviteLabel,
  isOnTrack,
  planNameOf,
  rowInitials,
  rowReason,
  rowStatusChip,
  weekRatio,
} from '../clientActivity';
import { clientRowLabel } from '../clientFormat';
import { openClientDetail } from '../clientLinks';
import ClientAvatar from '../components/ClientAvatar';
import { ListCard, ListRow, PageIntro, PHONE_WEEK_RING, PlanLine, WEEK_RING, WeekRing, clientStyles } from '../components/ClientsUi';
import { PlusGlyph } from '../components/clientIcons';
import PillSearchField from '../components/PillSearchField';
import InviteClientModal from '../components/InviteClientModal';
import { useTrainerOverview } from '../useTrainerOverview';
import ClientDetailContent from './ClientDetailContent';
import { keepUnitsTogether } from '../../../../shared/format/counts';

// C1 (trainer clients spec §C3; v2 phase 6 §2 Clients, UX N). Phone: the
// list page (a row pushes Client detail). Tablet (≥ 768): master/detail, the
// list (320) beside the selected client's full detail (approved).
// Every focus is a fresh mount.
// T-55 (merged in t55m) + RN-SPEC-TRAINER-CLIENTS dated change 27 Oct
// (07c6d708): the tablet selection is kept in the route params
// (`navigation.setParams({ client })`, web's ?client=), so leaving from the
// pane ("Change plan" → Plans) and coming Back, a remount or a list refresh
// re-selects that client while it is in the shown list (else the first shown
// row). End coaching / "Back to clients" in the pane clear it, refresh the
// list quietly (no loader) and move focus to the newly selected row, or to the
// "Clients" heading when none is left. Phones ignore the param (no push on a
// resize).
export const LIST_PANE_WIDTH = 320;

// The kept id (a string, as in the route), else the first client, else none.
// T-121 L11: a chip is cut at the right edge (more than a pixel hidden).
export function chipsCut({ view, content, x }) {
  return view > 0 && content - (x + view) > 1;
}

export function selectedClientId(selected, clients) {
  if (selected !== undefined && selected !== null && String(selected) !== '') {
    return String(selected);
  }
  return clients[0] ? String(clients[0].client_user_id) : null;
}

function paramId(value) {
  return value !== undefined && value !== null && String(value) !== '' ? String(value) : null;
}

export default function ClientsListScreen() {
  const remountKey = useFocusRemountKey();
  return (
    <TrainerOnly>
      <ClientsList key={remountKey} />
    </TrainerOnly>
  );
}

function ClientsList() {
  const navigation = useNavigation();
  const kept = useRoute()?.params?.client;
  const { width } = useWindowDimensions();
  const tablet = width >= breakpoints.md;
  const reflow = useLargeTextReflow();
  const { clients, outgoing, loading, error, reload } = useTrainerOverview();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [chipEdge, setChipEdge] = useState({ view: 0, content: 0, x: 0 });
  const [filter, setFilter] = useState(ClientFilter.all);
  // Mirrors the `client` param so a tap swaps the pane at once.
  const [selectedId, setSelectedId] = useState(() => paramId(kept));
  const [paneKey, setPaneKey] = useState(0);
  const [focusAfterRefresh, setFocusAfterRefresh] = useState(false);
  const rowRefs = useRef(new Map());
  const headingRef = useRef(null);

  const hasData = anyActivity(clients);
  // ND-8: Missed only once BE's weekly data exists; counts from the loaded list.
  const activeFilter = !hasData && filter === ClientFilter.missed ? ClientFilter.all : filter;
  const shown = filterClients({ clients, invited: outgoing, filter: activeFilter, query });
  const counts = filterCounts({ clients, invited: outgoing });
  const selected = tablet ? shown.clients.find((row) => String(row.client_user_id) === selectedId) ?? shown.clients[0] ?? null : null;

  // After a quiet refresh: focus the newly selected row, else the heading.
  useEffect(() => {
    if (!focusAfterRefresh) {
      return;
    }
    setFocusAfterRefresh(false);
    const target = selected ? rowRefs.current.get(selected.client_user_id) : headingRef.current;
    const node = target ? findNodeHandle(target) : null;
    if (node) {
      AccessibilityInfo.setAccessibilityFocus(node);
    }
  }, [focusAfterRefresh, selected]);

  const invite = (
    <IconButton
      testID="clients-invite"
      accessibilityLabel="Invite a client"
      accessibilityState={{ selected: false }}
      active
      onPress={() => setInviteOpen(true)}
    >
      {({ color }) => <PlusGlyph size={20} color={color} />}
    </IconButton>
  );

  return (
    <ShellPage>
      <View style={[styles.column, tablet && styles.columnTablet]}>{renderBody()}</View>
      <InviteClientModal isOpen={inviteOpen} onClose={() => setInviteOpen(false)} onInvited={reload} />
    </ShellPage>
  );

  function renderIntro() {
    return <PageIntro title="Clients" subtitle="Everyone you actively coach." pill={false} aside={invite} titleRef={headingRef} titleTestID="clients-heading" />;
  }

  function renderBody() {
    if (error) {
      return (
        <>
          {renderIntro()}
          <StateSlot>
            <ErrorAlert title="Could not load your clients" description={error} onRetry={reload} />
          </StateSlot>
        </>
      );
    }
    if (loading) {
      return (
        <>
          {renderIntro()}
          <StateSlot>
            <Loader label="Loading your clients" style={styles.loader} />
          </StateSlot>
        </>
      );
    }
    if (clients.length === 0 && outgoing.length === 0) {
      return (
        <>
          {renderIntro()}
          <StateSlot>
            <EmptyState
              title="No clients yet"
              message="Invite a member to coach, or wait for someone to ask you."
              actionLabel="Invite a client"
              actionTestID="clients-empty-invite"
              onAction={() => setInviteOpen(true)}
            />
          </StateSlot>
        </>
      );
    }
    const list = (
      <View style={styles.listColumn}>
        {renderIntro()}
        {renderSearch()}
        {renderChips()}
        {renderList()}
      </View>
    );
    if (!tablet) {
      return list;
    }
    return (
      <View testID="clients-master-detail" style={[styles.masterDetail, reflow && styles.masterDetailStacked]}>
        <View testID="clients-list-pane" style={[styles.listPane, reflow && styles.listPaneStacked]}>{list}</View>
        <View testID="clients-detail-pane" accessibilityLabel={selected ? clientRowLabel(selected) : undefined} style={styles.detailPane}>
          {selected ? (
            <ClientDetailContent
              key={`${selected.client_user_id}-${paneKey}`}
              clientUserId={selected.client_user_id}
              clientActivity={selected.client_activity}
              layout="pane"
              onEnded={afterEnded}
              onBackToClients={afterEnded}
            />
          ) : (
            <EmptyState title="No clients found" message="Try a different name or filter." />
          )}
        </View>
      </View>
    );
  }

  async function afterEnded() {
    setSelectedId(null);
    navigation.setParams({ client: undefined });
    setPaneKey((key) => key + 1);
    await reload({ quiet: true });
    setFocusAfterRefresh(true);
  }

  function renderSearch() {
    return <PillSearchField testID="clients-search" label="Search clients" value={query} onChangeText={setQuery} tablet={tablet} />;
  }

  function renderChips() {
    const chips = [
      { key: ClientFilter.all, label: 'All', count: counts.all },
      { key: ClientFilter.active, label: 'Active', count: counts.active },
      hasData ? { key: ClientFilter.missed, label: 'Missed', count: counts.missed } : null,
      { key: ClientFilter.invited, label: 'Invited', count: counts.invited },
    ].filter(Boolean);
    // Dated 27 Oct 2026 (§C3.2, audit b2): ONE row that never wraps; it
    // scrolls sideways (no scrollbar) and each chip keeps its width.
    // T-121 L11: the right edge fades only while a chip is cut off there.
    return (
      <View style={styles.chipRow}>
        <ScrollView
          testID="clients-filter-row"
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={styles.chipScroll}
          contentContainerStyle={styles.chips}
          onLayout={(event) => setChipEdge((edge) => ({ ...edge, view: event.nativeEvent.layout.width }))}
          onContentSizeChange={(contentWidth) => setChipEdge((edge) => ({ ...edge, content: contentWidth }))}
          onScroll={(event) => {
            const x = event.nativeEvent.contentOffset.x;
            setChipEdge((edge) => (edge.x === x ? edge : { ...edge, x }));
          }}
          scrollEventThrottle={32}
        >
          <View testID="clients-filter-group" accessibilityRole="radiogroup" accessibilityLabel="Filter clients" style={styles.chips}>
            {chips.map((chip) => (
              <Chip
                key={chip.key}
                testID={`clients-filter-${chip.key}`}
                label={hasData ? `${chip.label} · ${chip.count}` : chip.label}
                accessibilityLabel={hasData ? `${chip.label}, ${chip.count} clients` : chip.label}
                selected={activeFilter === chip.key}
                onPress={() => setFilter(chip.key)}
              />
            ))}
          </View>
        </ScrollView>
        {chipsCut(chipEdge) ? (
          <View testID="clients-filter-fade" pointerEvents="none" style={styles.chipFade}>
            <GradientFill angle={gradients.edgeFade.angle} colors={gradients.edgeFade.colors} />
          </View>
        ) : null}
      </View>
    );
  }

  function renderList() {
    if (shown.clients.length === 0 && shown.invited.length === 0) {
      return <EmptyState title="No clients found" message="Try a different name or filter." live />;
    }
    return (
      <ListCard testID="clients-list" style={tablet && styles.tabletList}>
        {shown.clients.map((row) => renderClientRow(row))}
        {shown.invited.map((row) => renderInvitedRow(row))}
      </ListCard>
    );
  }

  function renderClientRow(row) {
    const name = clientRowLabel(row);
    const ratio = weekRatio(row);
    const isSelected = Boolean(tablet && selected && selected.client_user_id === row.client_user_id);
    // T-121 M3 (UX option B): one anatomy for every row: avatar · name · plan
    // line (reason first) · the ring + "x/y" with a plan this week, else the
    // status chip. The whole row opens the client (no "View →").
    const withData = activityOf(row) !== null;
    const reason = rowReason(row);
    const plan = withData ? keepUnitsTogether(planNameOf(row)) ?? 'No plan yet' : null;
    const chip = ratio ? null : rowStatusChip(row);
    const label = [name, reason, plan, isOnTrack(row) ? 'On track' : null, ratio ? `${ratio.done} of ${ratio.planned} this week` : null, chip && chip.label !== 'On track' ? chip.label : null]
      .filter(Boolean)
      .join(', ');
    return (
      <ListRow
        key={row.id}
        testID={`clients-row-${row.client_user_id}`}
        accessibilityLabel={label}
        rowRef={(node) => {
          if (node) {
            rowRefs.current.set(row.client_user_id, node);
          } else {
            rowRefs.current.delete(row.client_user_id);
          }
        }}
        selected={tablet ? isSelected : undefined}
        style={[styles.row, isSelected && styles.rowSelected]}
        onPress={() => {
          if (tablet) {
            setSelectedId(String(row.client_user_id));
            navigation.setParams({ client: String(row.client_user_id) });
            AccessibilityInfo.announceForAccessibility(`Showing ${name}`);
          } else {
            openClientDetail(row.client_user_id, row.client_activity);
          }
        }}
      >
        <ClientAvatar userId={row.client_user_id} initials={rowInitials(row)} size={44} />
        <View style={styles.rowText}>
          <Text {...NAME_TEXT} style={clientStyles.rowLabel}>
            {name}
          </Text>
          <PlanLine testID={`clients-row-line-${row.client_user_id}`} reason={reason} plan={plan} />
        </View>
        {ratio ? (
          <View style={styles.trailing}>
            {/* Dated 27 Oct 2026 (audit b2): the phone ring is 32 (tablet 20). */}
            <WeekRing done={ratio.done} planned={ratio.planned} size={tablet ? WEEK_RING : PHONE_WEEK_RING} />
            <Text {...CAP_BODY} style={styles.ratio}>
              {ratio.text}
            </Text>
          </View>
        ) : (
          <StatusPill compact tone={chip.tone} label={chip.label} />
        )}
      </ListRow>
    );
  }

  // ND-9: an invitation isn't a client yet: not tappable, no "View →"; the
  // name + the gold "Pending" pill.
  function renderInvitedRow(row) {
    return (
      <ListRow key={`invite-${row.id}`} testID={`clients-invited-${row.id}`} style={styles.row}>
        <ClientAvatar userId={row.client_user_id} initials={rowInitials(row)} size={44} />
        <View style={styles.rowText}>
          <Text {...CAP_BODY} numberOfLines={2} style={clientStyles.rowLabel}>
            {inviteLabel(row)}
          </Text>
        </View>
        <StatusPill compact tone="gold" label="Pending" />
      </ListRow>
    );
  }
}

const styles = StyleSheet.create({
  column: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    gap: spacing['3_5'],
    paddingBottom: 24,
  },
  columnTablet: {
    maxWidth: 1120,
  },
  loader: {
    paddingVertical: 48,
  },
  listColumn: {
    gap: spacing['3_5'],
  },
  masterDetail: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[6],
  },
  masterDetailStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  listPane: {
    width: LIST_PANE_WIDTH,
    flexShrink: 0,
  },
  listPaneStacked: {
    width: '100%',
  },
  detailPane: {
    flex: 1,
    minWidth: 0,
  },
  chips: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  chipScroll: {
    flexGrow: 0,
  },
  chipRow: {
    position: 'relative',
  },
  chipFade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 32,
  },
  tabletList: {
    // Tablet rows are separate rounded rows on the ground (as drawn).
    borderWidth: 0,
    backgroundColor: colors.ground,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing[3],
  },
  rowSelected: {
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.goldStrong,
    backgroundColor: colors.goldFaint,
  },
  rowText: {
    flex: 1,
    flexBasis: 140,
    minWidth: 0,
    gap: spacing['0_5'],
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['1_5'],
  },
  ratio: {
    ...font(500),
    fontSize: 13,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
    color: colors.textStrong2,
  },
});
