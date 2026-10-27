import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { getServerMessage } from '../../../shared/api/apiError';
import EmptyState from '../../../shared/components/EmptyState';
import ErrorAlert from '../../../shared/components/ErrorAlert';
import FormField from '../../../shared/components/FormField';
import Loader from '../../../shared/components/Loader';
import PillButton from '../../../shared/components/PillButton';
import StateSlot from '../../../shared/components/StateSlot';
import { useFocusRemountKey } from '../../../shared/hooks/useFocusRemountKey';
import { breakpoints, colors } from '../../../shared/theme/tokens';
import ShellPage from '../../shell/ShellPage';
import { CoachingHeader } from '../../trainer/clients/components/ClientsUi';
import { TRAINERS_PER_PAGE, listTrainers } from '../api/trainersApi';
import TrainerCard from '../components/TrainerCard';
import { TRAINER_DETAIL_ROUTE } from '../trainerRoutes';
import { clampPage, pagerText, readTrainerList, showsPager, trainersEmptyCopy } from '../trainersFormat';

export const SEARCH_DEBOUNCE_MS = 300;

// TR1 Find a trainer (`/trainers`). Every focus is a fresh mount.
export default function TrainersScreen() {
  const remountKey = useFocusRemountKey();
  return (
    <ShellPage testID="trainers-screen">
      <View style={styles.column}>
        <TrainersList key={remountKey} />
      </View>
    </ShellPage>
  );
}

function TrainersList() {
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const twoColumns = width >= breakpoints.sm;
  const [searchTerm, setSearchTerm] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState({ loading: true, error: null, trainers: [], pagination: null });

  // TR1.1: 300 ms after the last change, search = trimmed term and page = 1.
  // Setting the same values again doesn't reload.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchTerm.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    let alive = true;
    // ⚠TR-2: every load replaces the list with the loader.
    setState((current) => ({ ...current, loading: true, error: null }));
    listTrainers({ page, search })
      .then((body) => {
        if (alive) {
          setState({ loading: false, error: null, ...readTrainerList(body, TRAINERS_PER_PAGE) });
        }
      })
      .catch((error) => {
        if (alive) {
          setState((current) => ({ ...current, loading: false, error: getServerMessage(error) }));
        }
      });
    return () => {
      alive = false;
    };
  }, [search, page, reloadToken]);

  const openTrainer = (trainer) => navigation.push(TRAINER_DETAIL_ROUTE, { trainerUserId: String(trainer.user_id) });

  return (
    <View style={styles.page}>
      <CoachingHeader title="Find a trainer" subtitle="Browse trainers and ask one to coach you." />
      <FormField
        testID="trainers-search"
        label="Search"
        placeholder="Search by email"
        value={searchTerm}
        onChangeText={setSearchTerm}
        returnKeyType="search"
        clearButtonMode="while-editing"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {renderBody()}
    </View>
  );

  function renderBody() {
    if (state.error) {
      return (
        <StateSlot>
          <ErrorAlert
            title="Could not load trainers"
            description={state.error}
            onRetry={() => setReloadToken((value) => value + 1)}
          />
        </StateSlot>
      );
    }
    if (state.loading) {
      return (
        <StateSlot>
          <Loader label="Loading trainers" style={styles.loader} />
        </StateSlot>
      );
    }
    if (state.trainers.length === 0) {
      const copy = trainersEmptyCopy(search);
      return (
        <StateSlot>
          {/* The copy switches with the search: a polite live region. */}
          <EmptyState live title={copy.title} message={copy.message} />
        </StateSlot>
      );
    }
    const { pagination } = state;
    const rows = twoColumns ? pairs(state.trainers) : state.trainers.map((trainer) => [trainer]);
    return (
      <>
        <View style={styles.grid}>
          {rows.map((row) => (
            <View key={row[0].user_id} style={styles.gridRow}>
              {row.map((trainer) => (
                <TrainerCard key={trainer.user_id} trainer={trainer} style={styles.cell} onPress={() => openTrainer(trainer)} />
              ))}
              {twoColumns && row.length === 1 ? <View style={styles.cell} /> : null}
            </View>
          ))}
        </View>
        {showsPager(pagination) ? (
          <View testID="trainers-pager" style={styles.pager}>
            <Text style={styles.pagerText}>{pagerText(pagination)}</Text>
            <View style={styles.pagerButtons}>
              <PillButton
                testID="trainers-previous"
                title="Previous"
                variant="secondary"
                disabled={pagination.currentPage <= 1}
                onPress={() => setPage(clampPage(pagination.currentPage - 1, pagination.totalPages))}
              />
              <PillButton
                testID="trainers-next"
                title="Next"
                variant="secondary"
                disabled={pagination.currentPage >= pagination.totalPages}
                onPress={() => setPage(clampPage(pagination.currentPage + 1, pagination.totalPages))}
              />
            </View>
          </View>
        ) : null}
      </>
    );
  }
}

function pairs(items) {
  const rows = [];
  for (let index = 0; index < items.length; index += 2) {
    rows.push(items.slice(index, index + 2));
  }
  return rows;
}

const styles = StyleSheet.create({
  column: {
    width: '100%',
    maxWidth: 896,
    alignSelf: 'center',
  },
  page: {
    gap: 20,
    paddingBottom: 24,
  },
  loader: {
    alignSelf: 'center',
    paddingVertical: 48,
  },
  grid: {
    gap: 16,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 16,
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
