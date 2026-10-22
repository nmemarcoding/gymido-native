import { useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { getServerMessage, getStatus } from '../../shared/api/apiError';
import EmptyState from '../../shared/components/EmptyState';
import ErrorAlert from '../../shared/components/ErrorAlert';
import Loader from '../../shared/components/Loader';
import PillButton from '../../shared/components/PillButton';
import { ToastTone, addToast } from '../../shared/components/toastStore';
import { useFocusRemountKey } from '../../shared/hooks/useFocusRemountKey';
import { breakpoints } from '../../shared/theme/tokens';
import ShellPage from '../shell/ShellPage';
import { openShellPath } from '../shell/shellLinks';
import TrainerOnly from './TrainerOnly';
import { acceptRequest, rejectRequest } from './clients/api/clientsApi';
import { clientRowLabel, plural } from './clients/clientFormat';
import { openClientDetail } from './clients/clientLinks';
import {
  BrandLink,
  CoachingHeader,
  ListCard,
  ListRow,
  SectionHeading,
  TrainerStatCard,
  clientStyles,
} from './clients/components/ClientsUi';
import { useTrainerOverview } from './clients/useTrainerOverview';

// D1 (trainer clients spec §C2). Every focus is a fresh mount.
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
  const { clients, incoming, outgoing, loading, error, reload } = useTrainerOverview();
  const [busy, setBusy] = useState(false);
  const halfWidth = width >= breakpoints.sm ? (Math.min(width - 32, 896) - 16) / 2 : null;

  // §C2.3: reload after success or failure (⚠D-1); busy clears only after it.
  async function respond(request, accept) {
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
    await reload();
    setBusy(false);
  }

  return (
    <ShellPage>
      <View style={styles.column}>
        <CoachingHeader title="Trainer dashboard" subtitle="Your clients, requests, and coaching tools.">
          <PillButton testID="trainer-dashboard-clients" title="Clients" onPress={() => openShellPath('/trainer/clients')} />
          <PillButton
            testID="trainer-dashboard-plans"
            title="Plans"
            variant="secondary"
            onPress={() => openShellPath('/trainer/plans')}
          />
        </CoachingHeader>
        {renderBody()}
      </View>
    </ShellPage>
  );

  function renderBody() {
    if (loading) {
      return <Loader label="Loading your dashboard" style={styles.loader} />;
    }
    if (error) {
      return <ErrorAlert title="Could not load your dashboard" description={error} onRetry={reload} />;
    }
    return (
      <>
        <View style={styles.stats}>
          <TrainerStatCard
            style={halfWidth ? { width: halfWidth } : styles.fullWidth}
            label="Active clients"
            value={clients.length}
            tone="emerald"
            subtitle={plural(clients.length, 'person you coach', 'people you coach')}
          />
          <TrainerStatCard
            style={halfWidth ? { width: halfWidth } : styles.fullWidth}
            label="Awaiting you"
            value={incoming.length}
            tone={incoming.length > 0 ? 'amber' : 'slate'}
            subtitle={plural(incoming.length, 'request to answer', 'requests to answer')}
          />
        </View>

        {incoming.length > 0 ? (
          <View>
            <SectionHeading>Requests to you</SectionHeading>
            <ListCard style={styles.sectionBody}>
              {incoming.map((request) => (
                <ListRow key={request.id} style={styles.requestRow}>
                  <View style={styles.rowLeft}>
                    <Text numberOfLines={1} style={clientStyles.rowLabel}>
                      {clientRowLabel(request)}
                    </Text>
                    <Text style={clientStyles.rowMeta}>asked you to coach them</Text>
                  </View>
                  <View style={styles.requestButtons}>
                    <PillButton
                      testID={`request-decline-${request.id}`}
                      title="Decline"
                      variant="secondary"
                      disabled={busy}
                      onPress={() => respond(request, false)}
                    />
                    <PillButton
                      testID={`request-accept-${request.id}`}
                      title="Accept"
                      disabled={busy}
                      onPress={() => respond(request, true)}
                    />
                  </View>
                </ListRow>
              ))}
            </ListCard>
          </View>
        ) : null}

        <View>
          <View style={styles.headingRow}>
            <SectionHeading>Your clients</SectionHeading>
            <BrandLink testID="dashboard-manage-clients" label="Manage →" onPress={() => openShellPath('/trainer/clients')} />
          </View>
          {clients.length === 0 ? (
            <EmptyState
              style={styles.sectionBody}
              title="No clients yet"
              message="Invite someone to coach, or wait for a member to ask you."
            />
          ) : (
            <ListCard style={styles.sectionBody}>
              {clients.map((client) => (
                <ListRow
                  key={client.id}
                  testID={`dashboard-client-${client.client_user_id}`}
                  style={styles.clientRow}
                  onPress={() => openClientDetail(client.client_user_id)}
                >
                  <Text numberOfLines={1} style={clientStyles.rowLabel}>
                    {clientRowLabel(client)}
                  </Text>
                  <Text style={clientStyles.viewLink}>View →</Text>
                </ListRow>
              ))}
            </ListCard>
          )}
        </View>

        {outgoing.length > 0 ? (
          <View>
            <SectionHeading>Invitations you sent</SectionHeading>
            <ListCard style={styles.sectionBody}>
              {outgoing.map((request) => (
                <ListRow key={request.id} style={styles.clientRow}>
                  {/* ⚠C-1: no name until they accept. */}
                  <Text numberOfLines={1} style={clientStyles.rowLabel}>
                    Client #{request.client_user_id}
                  </Text>
                  <Text style={clientStyles.rowMeta}>Waiting for them</Text>
                </ListRow>
              ))}
            </ListCard>
          </View>
        ) : null}
      </>
    );
  }
}

const styles = StyleSheet.create({
  column: {
    width: '100%',
    maxWidth: 896,
    alignSelf: 'center',
    gap: 20,
    paddingBottom: 24,
  },
  loader: {
    paddingVertical: 48,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  fullWidth: {
    width: '100%',
  },
  sectionBody: {
    marginTop: 12,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  requestRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowLeft: {
    minWidth: 0,
    flexShrink: 1,
  },
  requestButtons: {
    flexDirection: 'row',
    flexShrink: 0,
    gap: 8,
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
});
