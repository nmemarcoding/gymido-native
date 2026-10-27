import { useNavigation, useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import EmptyState from '../../../../shared/components/EmptyState';
import ErrorAlert from '../../../../shared/components/ErrorAlert';
import Loader from '../../../../shared/components/Loader';
import PillButton from '../../../../shared/components/PillButton';
import StateSlot from '../../../../shared/components/StateSlot';
import { useFocusRemountKey } from '../../../../shared/hooks/useFocusRemountKey';
import { usesRail } from '../../../../shared/hooks/useLayoutClass';
import ShellPage from '../../../shell/ShellPage';
import TrainerOnly from '../../TrainerOnly';
import { clientRowLabel } from '../clientFormat';
import { openClientDetail } from '../clientLinks';
import { CoachingHeader, ListCard, ListRow, clientStyles } from '../components/ClientsUi';
import InviteClientModal from '../components/InviteClientModal';
import { ClientDetailContent } from './ClientDetailScreen';
import { useTrainerOverview } from '../useTrainerOverview';

// C1 (trainer clients spec §C3). Every focus is a fresh mount.
// T-55 tablet (≥ 768, both orientations; TabletClients board): master/detail,
// the 320 list beside the client's C2 content. The selection lives in the
// route params (`selected`, web's ?client=), so it survives a remount, a
// rotation, and the "Change plan" → Back round trip; with none, the first
// client shows (as drawn). Phones: unchanged, a row pushes C2; a `selected`
// left over from a tablet layout is ignored (no push on resize).
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
  const selectedParam = useRoute().params?.selected;
  const { width } = useWindowDimensions();
  const split = usesRail(width);
  const { clients, loading, error, reload } = useTrainerOverview();
  const [inviteOpen, setInviteOpen] = useState(false);
  const showList = !error && !loading && clients.length > 0;
  const selectedId = split && showList ? selectedClientId(selectedParam, clients) : null;

  const header = (
    <CoachingHeader title="Clients" subtitle="Everyone you actively coach.">
      <PillButton testID="clients-invite" title="Invite a client" onPress={() => setInviteOpen(true)} />
    </CoachingHeader>
  );

  return (
    <ShellPage>
      {selectedId ? (
        <View testID="clients-master-detail" style={styles.split}>
          <View testID="clients-master" style={styles.master}>
            {header}
            {renderBody()}
          </View>
          <View testID="clients-detail-pane" style={styles.pane}>
            <ClientDetailContent key={selectedId} clientUserId={selectedId} embedded />
          </View>
        </View>
      ) : (
        <View style={styles.column}>
          {header}
          {renderBody()}
        </View>
      )}
      <InviteClientModal isOpen={inviteOpen} onClose={() => setInviteOpen(false)} onInvited={reload} />
    </ShellPage>
  );

  function openRow(clientUserId) {
    if (split) {
      navigation.setParams({ selected: String(clientUserId) });
    } else {
      openClientDetail(clientUserId);
    }
  }

  function renderBody() {
    if (error) {
      return (
        <StateSlot>
          <ErrorAlert title="Could not load your clients" description={error} onRetry={reload} />
        </StateSlot>
      );
    }
    if (loading) {
      return (
        <StateSlot>
          <Loader label="Loading your clients" style={styles.loader} />
        </StateSlot>
      );
    }
    if (clients.length === 0) {
      return (
        <StateSlot>
          <EmptyState
            title="No clients yet"
            message="Invite a member to coach, or wait for someone to ask you."
            actionLabel="Invite a client"
            actionTestID="clients-empty-invite"
            onAction={() => setInviteOpen(true)}
          />
        </StateSlot>
      );
    }
    return (
      <ListCard>
        {clients.map((client) => (
          <ListRow
            key={client.id}
            testID={`clients-row-${client.client_user_id}`}
            style={styles.row}
            selected={selectedId ? String(client.client_user_id) === selectedId : undefined}
            onPress={() => openRow(client.client_user_id)}
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

// The selected id (a string, as in the route), else the first client.
export function selectedClientId(selected, clients) {
  if (selected !== undefined && selected !== null && String(selected) !== '') {
    return String(selected);
  }
  return clients[0] ? String(clients[0].client_user_id) : null;
}

const styles = StyleSheet.create({
  // TabletClients board: the 320 list column, then the pane taking the rest.
  split: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 24,
    paddingBottom: 24,
  },
  master: {
    width: 320,
    flexShrink: 0,
    gap: 20,
  },
  pane: {
    flex: 1,
    minWidth: 0,
  },
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
