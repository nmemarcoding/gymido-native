import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import EmptyState from '../../../../shared/components/EmptyState';
import ErrorAlert from '../../../../shared/components/ErrorAlert';
import Loader from '../../../../shared/components/Loader';
import PillButton from '../../../../shared/components/PillButton';
import { useFocusRemountKey } from '../../../../shared/hooks/useFocusRemountKey';
import ShellPage from '../../../shell/ShellPage';
import TrainerOnly from '../../TrainerOnly';
import { clientRowLabel } from '../clientFormat';
import { openClientDetail } from '../clientLinks';
import { CoachingHeader, ListCard, ListRow, clientStyles } from '../components/ClientsUi';
import InviteClientModal from '../components/InviteClientModal';
import { useTrainerOverview } from '../useTrainerOverview';

// C1 (trainer clients spec §C3). Every focus is a fresh mount.
export default function ClientsListScreen() {
  const remountKey = useFocusRemountKey();
  return (
    <TrainerOnly>
      <ClientsList key={remountKey} />
    </TrainerOnly>
  );
}

function ClientsList() {
  const { clients, loading, error, reload } = useTrainerOverview();
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <ShellPage>
      <View style={styles.column}>
        <CoachingHeader title="Clients" subtitle="Everyone you actively coach.">
          <PillButton testID="clients-invite" title="Invite a client" onPress={() => setInviteOpen(true)} />
        </CoachingHeader>
        {renderBody()}
      </View>
      <InviteClientModal isOpen={inviteOpen} onClose={() => setInviteOpen(false)} onInvited={reload} />
    </ShellPage>
  );

  function renderBody() {
    if (error) {
      return <ErrorAlert title="Could not load your clients" description={error} onRetry={reload} />;
    }
    if (loading) {
      return <Loader label="Loading your clients" style={styles.loader} />;
    }
    if (clients.length === 0) {
      return (
        <EmptyState
          title="No clients yet"
          message="Invite a member to coach, or wait for someone to ask you."
          actionLabel="Invite a client"
          actionTestID="clients-empty-invite"
          onAction={() => setInviteOpen(true)}
        />
      );
    }
    return (
      <ListCard>
        {clients.map((client) => (
          <ListRow
            key={client.id}
            testID={`clients-row-${client.client_user_id}`}
            style={styles.row}
            onPress={() => openClientDetail(client.client_user_id)}
          >
            <Text numberOfLines={1} style={clientStyles.rowLabel}>
              {clientRowLabel(client)}
            </Text>
            <Text style={clientStyles.viewLink}>View →</Text>
          </ListRow>
        ))}
      </ListCard>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
});
