import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { getServerMessage, getStatus } from '../../shared/api/apiError';
import EmptyState from '../../shared/components/EmptyState';
import ErrorAlert from '../../shared/components/ErrorAlert';
import { CAP_BODY, useLargeTextReflow } from '../../shared/components/largeText';
import Loader from '../../shared/components/Loader';
import PillButton from '../../shared/components/PillButton';
import StateSlot from '../../shared/components/StateSlot';
import StatusPill from '../../shared/components/StatusPill';
import { ToastTone, addToast } from '../../shared/components/toastStore';
import { useFocusRemountKey } from '../../shared/hooks/useFocusRemountKey';
import { breakpoints, colors, font, radii, spacing } from '../../shared/theme/tokens';
import ShellPage from '../shell/ShellPage';
import { openShellPath } from '../shell/shellLinks';
import TrainerOnly from './TrainerOnly';
import { acceptRequest, rejectRequest } from './clients/api/clientsApi';
import { anyActivity, inviteLabel, isOnTrack, needAttention, planNameOf, rowInitials, weekSentence } from './clients/clientActivity';
import { clientRowLabel, plural } from './clients/clientFormat';
import { openAssignPlan, openClientDetail } from './clients/clientLinks';
import ClientAvatar from './clients/components/ClientAvatar';
import { BrandLink, ListCard, ListRow, PageIntro, SectionHead, StatTile, StatusLine, clientStyles } from './clients/components/ClientsUi';
import { useTrainerOverview } from './clients/useTrainerOverview';

// D1 (trainer clients spec §C2; v2 phase 6 §2 Trainer today, UX N). Phone:
// 3 compact tiles, Requests, Need attention, Your clients, Invitations.
// Tablet (≥ 768): 2 hero tiles, Need attention under them (ND-12), Requests
// as a 2-up grid, then Your clients | Invitations. Every focus is a fresh mount.
export default function TrainerDashboardScreen() {
  const remountKey = useFocusRemountKey();
  return (
    <TrainerOnly>
      <Dashboard key={remountKey} />
    </TrainerOnly>
  );
}

function Dashboard() {
  const { width } = useWindowDimensions();
  const tablet = width >= breakpoints.md;
  const reflow = useLargeTextReflow();
  const { clients, incoming, outgoing, loading, error, reload } = useTrainerOverview();
  const [busy, setBusy] = useState(false);
  // `busy` re-renders a frame late: a ref drops a 2nd tap in the same frame.
  const responding = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // §C2.3: reload after success or failure (⚠D-1); busy clears only after it.
  async function respond(request, accept) {
    if (responding.current) {
      return;
    }
    responding.current = true;
    setBusy(true);
    try {
      if (accept) {
        await acceptRequest(request.id);
        addToast(ToastTone.success, 'Client accepted', 'They’re now in your client list.');
      } else {
        await rejectRequest(request.id);
        addToast(ToastTone.success, 'Request declined');
      }
    } catch (failure) {
      if (accept) {
        const status = getStatus(failure);
        let message = 'We could not accept that request. Please try again.';
        if (status === 409) {
          message = getServerMessage(failure);
        } else if (status === 404) {
          message = 'That request is no longer available.';
        }
        addToast(ToastTone.error, 'Could not accept', message);
      } else {
        addToast(ToastTone.error, 'Could not decline', getServerMessage(failure));
      }
    }
    try {
      await reload();
    } finally {
      responding.current = false;
      if (mounted.current) {
        setBusy(false);
      }
    }
  }

  return (
    <ShellPage>
      <View style={[styles.column, tablet && styles.columnTablet]}>
        <PageIntro title="Trainer dashboard" subtitle="Your clients, requests, and coaching tools." tablet={tablet}>
          {/* Kept from code; both glass (the gold action here is Accept). */}
          <PillButton
            testID="trainer-dashboard-clients"
            title="Clients"
            variant="secondary"
            size="compact"
            onPress={() => openShellPath('/trainer/clients')}
          />
          <PillButton
            testID="trainer-dashboard-plans"
            title="Plans"
            variant="secondary"
            size="compact"
            onPress={() => openShellPath('/trainer/plans')}
          />
        </PageIntro>
        {renderBody()}
      </View>
    </ShellPage>
  );

  function renderBody() {
    if (loading) {
      return (
        <StateSlot>
          <Loader label="Loading your dashboard" style={styles.loader} />
        </StateSlot>
      );
    }
    if (error) {
      return (
        <StateSlot>
          <ErrorAlert title="Could not load your dashboard" description={error} onRetry={reload} />
        </StateSlot>
      );
    }
    const attention = needAttention(clients);
    const hasData = anyActivity(clients);
    if (tablet) {
      return (
        <>
          {renderStats(attention, hasData)}
          {renderAttention(attention)}
          {renderRequests()}
          <View style={[styles.split, reflow && styles.stack]}>
            <View style={styles.splitMain}>{renderClients()}</View>
            {outgoing.length > 0 ? <View style={styles.splitSide}>{renderInvitations()}</View> : null}
          </View>
        </>
      );
    }
    return (
      <>
        {renderStats(attention, hasData)}
        {renderRequests()}
        {renderAttention(attention)}
        {renderClients()}
        {outgoing.length > 0 ? renderInvitations() : null}
      </>
    );
  }

  function renderStats(attention, hasData) {
    const activeSub = plural(clients.length, 'person you coach', 'people you coach');
    const awaitingSub = plural(incoming.length, 'request to answer', 'requests to answer');
    const gold = incoming.length > 0;
    if (tablet) {
      return (
        <View style={[styles.stats, reflow && styles.stack]}>
          <StatTile
            testID="dashboard-stat-active"
            large
            hero
            label="Active clients"
            value={clients.length}
            sub={activeSub}
            valueColor={colors.teal}
            accessibilityLabel={`Active clients, ${clients.length}`}
            onPress={() => openShellPath('/trainer/clients')}
            style={styles.statHalf}
          />
          <StatTile
            key={gold ? 'gold' : 'plain'}
            testID="dashboard-stat-awaiting"
            large
            hero
            gold={gold}
            label="Awaiting you"
            value={incoming.length}
            sub={awaitingSub}
            accessibilityLabel={`Awaiting you, ${incoming.length}, ${awaitingSub}`}
            style={styles.statHalf}
          />
        </View>
      );
    }
    // Phone: 3 compact tiles (the code's sublines go to the accessible name);
    // past 1.3× they become label → value rows (§9 rule 4).
    const tileStyle = reflow ? styles.statFull : styles.statThird;
    return (
      <View style={styles.stats}>
        <StatTile
          testID="dashboard-stat-active"
          label="Active clients"
          value={clients.length}
          valueColor={colors.teal}
          row={reflow}
          accessibilityLabel={`Active clients, ${clients.length}, ${activeSub}`}
          onPress={() => openShellPath('/trainer/clients')}
          style={tileStyle}
        />
        <StatTile
          key={gold ? 'gold' : 'plain'}
          testID="dashboard-stat-awaiting"
          gold={gold}
          label="Awaiting you"
          value={incoming.length}
          row={reflow}
          accessibilityLabel={`Awaiting you, ${incoming.length}, ${awaitingSub}`}
          style={tileStyle}
        />
        {hasData ? (
          <StatTile
            testID="dashboard-stat-attention"
            label="Need you"
            value={attention.length}
            valueColor={attention.length > 0 ? colors.warning : colors.textPrimary}
            row={reflow}
            accessibilityLabel={`Need you, ${attention.length}`}
            style={tileStyle}
          />
        ) : null}
      </View>
    );
  }

  function renderRequests() {
    if (incoming.length === 0) {
      return null;
    }
    return (
      <View testID="dashboard-requests" accessibilityLabel="Requests to you" style={[styles.requestsCard, tablet && styles.requestsTablet]}>
        <Text {...CAP_BODY} accessibilityRole="header" style={[styles.cardTitle, tablet && styles.cardTitleTablet]}>
          Requests to you
        </Text>
        <View style={[styles.requests, tablet && !reflow && styles.requestGrid]}>
          {incoming.map((request) => {
            const name = clientRowLabel(request);
            return (
              <View key={request.id} testID={`request-${request.id}`} style={[styles.request, tablet && styles.requestTile, tablet && !reflow && styles.requestHalf]}>
                <View style={styles.requestWho}>
                  <ClientAvatar userId={request.client_user_id} initials={rowInitials(request)} size={tablet ? 52 : 44} />
                  <View style={styles.flexText}>
                    <Text {...CAP_BODY} numberOfLines={2} style={[clientStyles.rowLabel, tablet && styles.requestNameTablet]}>
                      {name}
                    </Text>
                    <Text {...CAP_BODY} style={clientStyles.rowMeta}>
                      asked you to coach them
                    </Text>
                  </View>
                </View>
                <View style={[styles.requestButtons, (tablet || reflow) && styles.requestButtonsFill, reflow && styles.stack]}>
                  {/* ⚠D-1: both disabled while busy, no spinner. Stacked: Accept on top. */}
                  {reflow ? renderAccept(request, name) : renderDecline(request, name)}
                  {reflow ? renderDecline(request, name) : renderAccept(request, name)}
                </View>
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  function renderDecline(request, name) {
    return (
      <PillButton
        testID={`request-decline-${request.id}`}
        title="Decline"
        variant="secondary"
        size="compact"
        accessibilityLabel={`Decline ${name}`}
        disabled={busy}
        fullWidth={reflow}
        style={tablet && !reflow ? styles.flexButton : null}
        onPress={() => respond(request, false)}
      />
    );
  }

  function renderAccept(request, name) {
    return (
      <PillButton
        testID={`request-accept-${request.id}`}
        title="Accept"
        size="compact"
        accessibilityLabel={`Accept ${name}`}
        disabled={busy}
        fullWidth={reflow}
        style={tablet && !reflow ? styles.flexButton : null}
        onPress={() => respond(request, true)}
      />
    );
  }

  // Approved "Need attention": missed this week or no plan (BE data only).
  function renderAttention(attention) {
    if (attention.length === 0) {
      return null;
    }
    return (
      <View testID="dashboard-attention" accessibilityLabel="Need attention" style={styles.card}>
        <SectionHead title="Need attention">
          <BrandLink testID="dashboard-attention-all" label="See all" onPress={() => openShellPath('/trainer/clients')} />
        </SectionHead>
        {attention.map(({ row, reason }, index) => {
          const name = clientRowLabel(row);
          const missed = reason.kind === 'missed';
          return (
            <View key={row.id} testID={`attention-${row.client_user_id}`} style={[styles.attentionRow, index > 0 && styles.attentionDivider, reflow && styles.wrapRow]}>
              <ClientAvatar userId={row.client_user_id} initials={rowInitials(row)} size={40} />
              <View style={styles.flexText}>
                <Text {...CAP_BODY} numberOfLines={2} style={clientStyles.rowLabel}>
                  {name}
                </Text>
                {missed ? (
                  <StatusLine tone="warning" text={reason.text} />
                ) : (
                  <Text {...CAP_BODY} style={styles.noPlan}>
                    {reason.text}
                  </Text>
                )}
              </View>
              <PillButton
                testID={`attention-action-${row.client_user_id}`}
                title={missed ? 'View' : 'Assign'}
                variant="secondary"
                size="compact"
                accessibilityLabel={missed ? `View ${name}` : `Assign a plan to ${name}`}
                onPress={() => (missed ? openClientDetail(row.client_user_id, row.client_activity) : openAssignPlan(row.client_user_id))}
              />
            </View>
          );
        })}
      </View>
    );
  }

  function renderClients() {
    return (
      <View style={tablet ? styles.card : null}>
        <SectionHead title="Your clients">
          <BrandLink testID="dashboard-manage-clients" label="Manage →" onPress={() => openShellPath('/trainer/clients')} />
        </SectionHead>
        {clients.length === 0 ? (
          <EmptyState
            style={styles.sectionBody}
            title="No clients yet"
            message="Invite someone to coach, or wait for a member to ask you."
          />
        ) : (
          <ListCard style={[styles.sectionBody, tablet && styles.flatList]}>
            {clients.map((client) => {
              const name = clientRowLabel(client);
              const sub = tablet ? null : weekSentence(client) ?? planNameOf(client);
              const onTrack = !tablet && isOnTrack(client);
              return (
                <ListRow
                  key={client.id}
                  testID={`dashboard-client-${client.client_user_id}`}
                  accessibilityLabel={[name, sub, onTrack ? 'On track' : null].filter(Boolean).join(', ')}
                  style={[styles.clientRow, tablet && styles.clientRowTablet]}
                  onPress={() => openClientDetail(client.client_user_id, client.client_activity)}
                >
                  <ClientAvatar userId={client.client_user_id} initials={rowInitials(client)} size={tablet ? 44 : 36} />
                  <View style={styles.flexText}>
                    <Text {...CAP_BODY} numberOfLines={2} style={clientStyles.rowLabel}>
                      {name}
                    </Text>
                    {sub ? (
                      <Text {...CAP_BODY} style={clientStyles.rowMeta}>
                        {sub}
                      </Text>
                    ) : null}
                  </View>
                  {onTrack ? (
                    <StatusPill compact tone="completed" label="On track" />
                  ) : (
                    <Text {...CAP_BODY} style={clientStyles.viewLink}>
                      View →
                    </Text>
                  )}
                </ListRow>
              );
            })}
          </ListCard>
        )}
      </View>
    );
  }

  function renderInvitations() {
    return (
      <View testID="dashboard-invitations" style={[styles.invitations, tablet && styles.invitationsTablet]}>
        <Text {...CAP_BODY} accessibilityRole="header" style={tablet ? styles.cardTitleTablet : styles.invitationsLabel}>
          Invitations you sent
        </Text>
        {outgoing.map((request) => (
          <View key={request.id} testID={`invitation-${request.id}`} style={[styles.invitationRow, reflow && styles.wrapRow]}>
            <Text {...CAP_BODY} numberOfLines={2} style={[clientStyles.rowLabel, styles.flexText]}>
              {/* ⚠C-1 unless the approved invitee name is sent. */}
              {inviteLabel(request)}
            </Text>
            <StatusPill compact tone="neutral" label="Waiting for them" />
          </View>
        ))}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  column: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    gap: spacing[3],
    paddingBottom: 24,
  },
  columnTablet: {
    maxWidth: 1120,
    gap: spacing[4],
  },
  loader: {
    paddingVertical: 48,
  },
  stack: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  wrapRow: {
    flexWrap: 'wrap',
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  statThird: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 96,
  },
  statFull: {
    width: '100%',
  },
  statHalf: {
    flex: 1,
    minWidth: 0,
  },
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    padding: spacing[4],
  },
  cardTitle: {
    ...font(600),
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
    marginBottom: spacing[3],
  },
  cardTitleTablet: {
    ...font(700),
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: -0.38,
    color: colors.textPrimary,
  },
  // X-3 the Requests card: surface + a gold-line edge (the board's 0.28 →
  // the ladder's line 0.30).
  requestsCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.goldLine,
    backgroundColor: colors.surface,
    padding: spacing[4],
  },
  requestsTablet: {
    borderRadius: radii.xxl,
    borderColor: colors.hairline,
  },
  requests: {
    gap: spacing[3],
  },
  requestGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  request: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing[3],
  },
  requestTile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: spacing['3_5'],
    padding: spacing[4],
    borderRadius: radii.lgPlus,
    backgroundColor: colors.fillWell,
  },
  requestHalf: {
    flexBasis: '48%',
    flexGrow: 1,
  },
  requestWho: {
    flex: 1,
    flexBasis: 160,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  requestNameTablet: {
    ...font(700),
    fontSize: 17,
    lineHeight: 22,
  },
  requestButtons: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  requestButtonsFill: {
    width: '100%',
  },
  flexButton: {
    flex: 1,
  },
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  attentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing['2_5'],
  },
  attentionDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  noPlan: {
    ...font(400),
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  sectionBody: {
    marginTop: spacing[2],
  },
  flatList: {
    borderWidth: 0,
  },
  clientRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing[3],
  },
  clientRowTablet: {
    paddingHorizontal: 0,
  },
  invitations: {
    borderRadius: radii.lgPlus,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.hairlineButton,
    backgroundColor: colors.fillWell,
    paddingVertical: spacing['3_5'],
    paddingHorizontal: spacing[4],
    gap: spacing[2],
  },
  invitationsTablet: {
    borderRadius: radii.xxl,
    borderStyle: 'solid',
    borderColor: colors.hairline,
    backgroundColor: colors.glass,
    padding: spacing[5],
  },
  invitationsLabel: {
    ...font(400),
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  invitationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: 32,
  },
  split: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[4],
  },
  splitMain: {
    flex: 3,
    minWidth: 0,
  },
  splitSide: {
    flex: 2,
    minWidth: 0,
  },
});
