import { useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';

import Chip from '../../../../shared/components/Chip';
import EmptyState from '../../../../shared/components/EmptyState';
import ErrorAlert from '../../../../shared/components/ErrorAlert';
import IconButton from '../../../../shared/components/IconButton';
import { CAP_BODY, useLargeTextReflow } from '../../../../shared/components/largeText';
import Loader from '../../../../shared/components/Loader';
import StateSlot from '../../../../shared/components/StateSlot';
import StatusPill from '../../../../shared/components/StatusPill';
import { useFocusRemountKey } from '../../../../shared/hooks/useFocusRemountKey';
import { breakpoints, colors, font, radii, spacing, textInputColors } from '../../../../shared/theme/tokens';
import ShellPage from '../../../shell/ShellPage';
import TrainerOnly from '../../TrainerOnly';
import {
  ClientFilter,
  activityOf,
  anyActivity,
  filterClients,
  filterCounts,
  inactivityLabel,
  inviteLabel,
  isOnTrack,
  missedOf,
  planNameOf,
  rowInitials,
  weekRatio,
} from '../clientActivity';
import { clientRowLabel } from '../clientFormat';
import { openClientDetail } from '../clientLinks';
import ClientAvatar from '../components/ClientAvatar';
import { ListCard, ListRow, PageIntro, StatusLine, WeekRing, clientStyles } from '../components/ClientsUi';
import { PlusGlyph, SearchGlyph } from '../components/clientIcons';
import InviteClientModal from '../components/InviteClientModal';
import { useTrainerOverview } from '../useTrainerOverview';
import ClientDetailContent from './ClientDetailContent';

// C1 (trainer clients spec §C3; v2 phase 6 §2 Clients, UX N). Phone: the
// list page (a row pushes Client detail). Tablet (≥ 768): master/detail, the
// list (320) beside the selected client's full detail (approved).
// Every focus is a fresh mount.
export const LIST_PANE_WIDTH = 320;

export default function ClientsListScreen() {
  const remountKey = useFocusRemountKey();
  return (
    <TrainerOnly>
      <ClientsList key={remountKey} />
    </TrainerOnly>
  );
}

function ClientsList() {
  const { width } = useWindowDimensions();
  const tablet = width >= breakpoints.md;
  const reflow = useLargeTextReflow();
  const { clients, outgoing, loading, error, reload } = useTrainerOverview();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState(ClientFilter.all);
  const [focused, setFocused] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [paneKey, setPaneKey] = useState(0);

  const hasData = anyActivity(clients);
  // ND-8: Missed only once BE's weekly data exists; counts from the loaded list.
  const activeFilter = !hasData && filter === ClientFilter.missed ? ClientFilter.all : filter;
  const shown = filterClients({ clients, invited: outgoing, filter: activeFilter, query });
  const counts = filterCounts({ clients, invited: outgoing });
  const selected = tablet ? shown.clients.find((row) => row.client_user_id === selectedId) ?? shown.clients[0] ?? null : null;

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
    return <PageIntro title="Clients" subtitle="Everyone you actively coach." pill={false} aside={invite} />;
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
      <View style={[styles.masterDetail, reflow && styles.masterDetailStacked]}>
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

  function afterEnded() {
    setSelectedId(null);
    setPaneKey((key) => key + 1);
    reload();
  }

  function renderSearch() {
    return (
      <View testID="clients-search-box" style={[styles.search, tablet && styles.searchTablet, focused && styles.searchFocused]}>
        <View style={styles.searchIcon}>
          <SearchGlyph size={18} color={colors.textMuted} />
        </View>
        <TextInput
          {...textInputColors}
          {...CAP_BODY}
          testID="clients-search"
          accessibilityLabel="Search clients"
          placeholder="Search clients"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          style={[styles.searchInput, tablet && styles.searchInputTablet]}
        />
      </View>
    );
  }

  function renderChips() {
    const chips = [
      { key: ClientFilter.all, label: 'All', count: counts.all },
      { key: ClientFilter.active, label: 'Active', count: counts.active },
      hasData ? { key: ClientFilter.missed, label: 'Missed', count: counts.missed } : null,
    ].filter(Boolean);
    return (
      <View accessibilityRole="radiogroup" accessibilityLabel="Filter clients" style={styles.chips}>
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
    const sub = subLine(row);
    const isSelected = Boolean(tablet && selected && selected.client_user_id === row.client_user_id);
    const label = [name, planNameOf(row), sub?.text && sub.text !== planNameOf(row) ? sub.text : null, isOnTrack(row) ? 'On track' : null, ratio ? `${ratio.done} of ${ratio.planned} this week` : null]
      .filter(Boolean)
      .join(', ');
    return (
      <ListRow
        key={row.id}
        testID={`clients-row-${row.client_user_id}`}
        accessibilityLabel={label}
        selected={tablet ? isSelected : undefined}
        style={[styles.row, isSelected && styles.rowSelected]}
        onPress={() => {
          if (tablet) {
            setSelectedId(row.client_user_id);
            AccessibilityInfo.announceForAccessibility(`Showing ${name}`);
          } else {
            openClientDetail(row.client_user_id, row.client_activity);
          }
        }}
      >
        <ClientAvatar userId={row.client_user_id} initials={rowInitials(row)} size={44} />
        <View style={styles.rowText}>
          <Text {...CAP_BODY} numberOfLines={2} style={clientStyles.rowLabel}>
            {name}
          </Text>
          {sub ? (
            sub.tone ? (
              <StatusLine tone={sub.tone} text={sub.text} />
            ) : (
              <Text {...CAP_BODY} style={clientStyles.rowMeta}>
                {sub.text}
              </Text>
            )
          ) : null}
        </View>
        {ratio ? (
          <View style={styles.trailing}>
            <WeekRing done={ratio.done} planned={ratio.planned} />
            <Text {...CAP_BODY} style={styles.ratio}>
              {ratio.text}
            </Text>
          </View>
        ) : activityOf(row) ? null : (
          <Text {...CAP_BODY} style={clientStyles.viewLink}>
            View →
          </Text>
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

// The row's second line (BE data only): missed (amber), inactivity (amber),
// else the plan name, else "No plan yet".
function subLine(row) {
  const activity = activityOf(row);
  if (!activity) {
    return null;
  }
  const missed = missedOf(row);
  if (missed > 0) {
    return { tone: 'warning', text: `Missed ${missed} this week` };
  }
  const inactive = inactivityLabel(row);
  if (inactive) {
    return { tone: 'warning', text: inactive };
  }
  return { text: planNameOf(row) ?? 'No plan yet' };
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
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.choiceBorder,
    backgroundColor: colors.surface,
  },
  searchTablet: {
    minHeight: 48,
  },
  searchFocused: {
    borderColor: colors.gold,
    outlineWidth: 4,
    outlineColor: colors.goldFocus,
    outlineStyle: 'solid',
  },
  searchIcon: {
    paddingLeft: spacing[4],
    paddingRight: spacing['2_5'],
  },
  searchInput: {
    ...font(400),
    flex: 1,
    minHeight: 50,
    paddingRight: spacing[4],
    fontSize: 16,
    color: colors.textPrimary,
  },
  searchInputTablet: {
    minHeight: 46,
    fontSize: 15,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
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
