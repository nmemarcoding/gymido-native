import { useNavigation, useRoute } from '@react-navigation/native';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { routes } from '../../../../navigation/routes';
import BackPill from '../../../../shared/components/BackPill';
import { useFocusRemountKey } from '../../../../shared/hooks/useFocusRemountKey';
import { breakpoints } from '../../../../shared/theme/tokens';
import ShellPage from '../../../shell/ShellPage';
import TrainerOnly from '../../TrainerOnly';
import ClientDetailContent from './ClientDetailContent';

// C2 (trainer clients spec §C4; v2 phase 6 §2 Client detail). Every focus is
// a fresh mount, so coming back after assigning a plan refetches. Phone: one
// column; tablet (≥ 768): the full tablet page (hero card, 4 tiles, two
// columns), reached from outside the Clients tab (Today "View →", links).
export default function ClientDetailScreen() {
  const remountKey = useFocusRemountKey();
  const { clientUserId, clientActivity } = useRoute().params ?? {};
  return (
    <TrainerOnly>
      <ClientDetail key={`${clientUserId}-${remountKey}`} clientUserId={clientUserId} clientActivity={clientActivity} />
    </TrainerOnly>
  );
}

function ClientDetail({ clientUserId, clientActivity }) {
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const tablet = width >= breakpoints.md;
  return (
    <ShellPage>
      <View style={[styles.column, tablet && styles.columnTablet]}>
        <ClientDetailContent
          clientUserId={clientUserId}
          clientActivity={clientActivity}
          layout={tablet ? 'tablet' : 'phone'}
          header={
            // UX §10 back link above the title; ⚠C-5: pushes C1 rather than going back.
            // UX native final audit 27 Oct 2026, ruling 6 (D364): the glass
            // "‹ All clients" pill (kit BackPill), not the gold text link.
            <View style={styles.back}>
              <BackPill testID="client-all-clients" label="All clients" onPress={() => navigation.push(routes.TrainerClients)} />
            </View>
          }
        />
      </View>
    </ShellPage>
  );
}

const styles = StyleSheet.create({
  column: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    paddingBottom: 24,
  },
  columnTablet: {
    maxWidth: 1120,
  },
  back: {
    alignItems: 'flex-start',
  },
});
