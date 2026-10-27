import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { getServerMessage } from '../../../shared/api/apiError';
import EmptyState from '../../../shared/components/EmptyState';
import ErrorAlert from '../../../shared/components/ErrorAlert';
import FormField from '../../../shared/components/FormField';
import { CAP_BODY, useLargeTextReflow } from '../../../shared/components/largeText';
import Loader from '../../../shared/components/Loader';
import PillButton from '../../../shared/components/PillButton';
import StateSlot from '../../../shared/components/StateSlot';
import { useFocusRemountKey } from '../../../shared/hooks/useFocusRemountKey';
import { breakpoints, colors, font, gradients, radii, spacing } from '../../../shared/theme/tokens';
import ShellPage from '../../shell/ShellPage';
import { TRAINERS_PER_PAGE, listTrainers } from '../api/trainersApi';
import { PageHeading } from '../components/CoachingPage';
import TrainerCard from '../components/TrainerCard';
import { TRAINER_DETAIL_ROUTE } from '../trainerRoutes';
import { clampPage, pagerText, readTrainerList, showsPager, trainersEmptyCopy } from '../trainersFormat';

export const SEARCH_DEBOUNCE_MS = 300;

// UX L §Trainers: the page glow. Phone radial(120 % 45 % at 85 % −8 %),
// tablet (70 % 40 % at 85 % −8 %); the drawn 0.22 / 0.20 fold to the
// gold-ambient token (0.20).
export const TRAINERS_GLOW = Object.freeze({
  phone: Object.freeze({ radial: { cx: 0.85, cy: -0.08, rx: 1.2, ry: 0.45 }, colors: gradients.goldAmbient.colors, stops: [0, 0.6] }),
  tablet: Object.freeze({ radial: { cx: 0.85, cy: -0.08, rx: 0.7, ry: 0.4 }, colors: gradients.goldAmbient.colors, stops: [0, 0.6] }),
});

// TR1 Find a trainer (`/trainers`). Every focus is a fresh mount. The shell
// header carries "← Coaching" (→ My trainer) and the "Coaching" title.
export default function TrainersScreen() {
  const remountKey = useFocusRemountKey();
  const tablet = useWindowDimensions().width >= breakpoints.md;
  return (
    <ShellPage testID="trainers-screen" glow={tablet ? TRAINERS_GLOW.tablet : TRAINERS_GLOW.phone}>
      <View style={styles.column}>
        <TrainersList key={remountKey} />
      </View>
    </ShellPage>
  );
}

function TrainersList() {
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const tablet = width >= breakpoints.md;
  const reflow = useLargeTextReflow();
  // UX §9 rule 4: past the reflow point the grid is one column.
  const twoColumns = width >= breakpoints.sm && !reflow;
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
    <View style={[styles.page, tablet && styles.pageTablet]}>
      <PageHeading testID="trainers-heading" tablet={tablet} title="Find a trainer" subtitle="Browse trainers and ask one to coach you." />
      <FormField
        testID="trainers-search"
        label="Search"
        // The label is visually hidden (UX L): the field is still named "Search".
        labelStyle={styles.hiddenLabel}
        variant="pill"
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
        <View testID="trainers-grid" style={[styles.grid, tablet && styles.gridTablet]}>
          {rows.map((row) => (
            <View key={row[0].user_id} style={[styles.gridRow, tablet && styles.gridTablet]}>
              {row.map((trainer) => (
                <TrainerCard key={trainer.user_id} trainer={trainer} tablet={tablet} style={styles.cell} onPress={() => openTrainer(trainer)} />
              ))}
              {twoColumns && row.length === 1 ? <View style={styles.cell} /> : null}
            </View>
          ))}
        </View>
        {showsPager(pagination) ? (
          <View testID="trainers-pager" style={[styles.pager, tablet && styles.pagerTablet]}>
            <Text {...CAP_BODY} style={[styles.pagerText, tablet && styles.pagerTextTablet]}>
              {pagerText(pagination)}
            </Text>
            <View style={styles.pagerButtons}>
              <PillButton
                testID="trainers-previous"
                title="Previous"
                variant={tablet ? 'ghost' : 'secondary'}
                size="compact"
                disabled={pagination.currentPage <= 1}
                onPress={() => setPage(clampPage(pagination.currentPage - 1, pagination.totalPages))}
              />
              <PillButton
                testID="trainers-next"
                title="Next"
                variant={tablet ? 'light' : 'secondary'}
                size="compact"
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
  // Tablet: full width (no max), as drawn; phone: the shell's column.
  column: {
    width: '100%',
    alignSelf: 'center',
  },
  page: {
    gap: spacing['3_5'],
    paddingBottom: spacing[6],
  },
  pageTablet: {
    gap: spacing[5],
  },
  hiddenLabel: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
  },
  loader: {
    alignSelf: 'center',
    paddingVertical: 48,
  },
  grid: {
    gap: spacing['3_5'],
  },
  gridRow: {
    flexDirection: 'row',
    gap: spacing['3_5'],
  },
  gridTablet: {
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
    paddingHorizontal: spacing[1],
    paddingVertical: spacing['0_5'],
  },
  // Tablet: the pager pill (the drawn the 0.6 glass folds to
  // colors.glass 0.72, reported).
  pagerTablet: {
    alignSelf: 'flex-start',
    paddingLeft: spacing['4_5'],
    paddingRight: spacing['1_5'],
    paddingVertical: spacing['1_5'],
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.choiceBorder,
    backgroundColor: colors.glass,
  },
  pagerText: {
    ...font(400),
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  pagerTextTablet: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  pagerButtons: {
    flexDirection: 'row',
    gap: spacing[2],
  },
});
