import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Skeleton from '../../shared/components/Skeleton';
import { CAP_BODY, useLargeTextReflow } from '../../shared/components/largeText';
import { useFocusRemountKey } from '../../shared/hooks/useFocusRemountKey';
import { colors, font, radii, spacing, textScale, typography } from '../../shared/theme/tokens';
import { getDashboard } from '../home/api/homeApi';
import { StatsStatus, profileStatTiles, statTileLabel } from './statTiles';

// RN-SPEC-v2-phase5 §2 stat tiles (K N1): Workouts / {unit} now / {unit}
// goal. The Workouts tile shows the skeleton while GET /dashboard loads and
// "—" on any error; the page never fails because of the tiles. The count is
// read again on each focus (a finished workout shows on return).
// `inCard`: the tablet variant inside the identity hero card (the web board's
// fill-subtle tiles, padding 14 8, no edge). Past 1.3× text (UX §9 rule 4)
// the 3 columns become stacked label → value rows.
export default function ProfileStatTiles({ profile, inCard = false }) {
  const remountKey = useFocusRemountKey();
  return <Stats key={remountKey} profile={profile} inCard={inCard} />;
}

function Stats({ profile, inCard }) {
  const [state, setState] = useState({ status: StatsStatus.loading, dashboard: null });
  const stacked = useLargeTextReflow();

  useEffect(() => {
    let alive = true;
    getDashboard()
      .then((dashboard) => {
        if (alive) {
          setState({ status: StatsStatus.ready, dashboard });
        }
      })
      .catch(() => {
        if (alive) {
          setState({ status: StatsStatus.error, dashboard: null });
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  const tiles = profileStatTiles({ profile, dashboard: state.dashboard, status: state.status });

  if (stacked) {
    return (
      <View testID="profile-stats" style={[styles.tile, inCard && styles.tileInCard, styles.stackedCard]}>
        {tiles.map((tile, index) => (
          <View
            key={tile.id}
            testID={`profile-stat-${tile.id}`}
            accessible
            accessibilityLabel={statTileLabel(tile)}
            style={[styles.stackedRow, index > 0 && styles.stackedDivider]}
          >
            <Text {...CAP_BODY} style={[styles.label, styles.stackedLabel]}>
              {tile.label}
            </Text>
            <TileValue tile={tile} />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View testID="profile-stats" style={styles.row}>
      {tiles.map((tile) => (
        <View
          key={tile.id}
          testID={`profile-stat-${tile.id}`}
          accessible
          accessibilityLabel={statTileLabel(tile)}
          style={[styles.tile, styles.tileColumn, inCard && styles.tileInCard, inCard && styles.tileInCardPadding]}
        >
          <TileValue tile={tile} />
          <Text {...CAP_BODY} style={[styles.label, styles.columnLabel]}>
            {tile.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function TileValue({ tile }) {
  if (tile.loading) {
    // The foundation skeleton in the number's shape (28 tall).
    return <Skeleton testID={`profile-stat-${tile.id}-skeleton`} style={styles.skeleton} />;
  }
  return (
    <Text maxFontSizeMultiplier={textScale.title} style={styles.value}>
      {tile.value}
    </Text>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  // Board: radius-lg 20, surface + hairline.
  tile: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  // Board: padding 14 12, centred.
  tileColumn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingVertical: spacing['3_5'],
    paddingHorizontal: spacing[3],
  },
  // Inside the hero card: fill-subtle (the drawn 0.05 folds to 0.04), no edge.
  tileInCard: {
    borderColor: 'transparent',
    backgroundColor: colors.fillWell,
  },
  tileInCardPadding: {
    paddingHorizontal: spacing[2],
  },
  // 24/28/700 −0.03em (title-md), tabular: a changing number.
  value: {
    ...typography.titleMd,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
    textAlign: 'center',
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
  },
  columnLabel: {
    marginTop: spacing['0_5'],
    textAlign: 'center',
  },
  skeleton: {
    width: 40,
    height: 28,
  },
  stackedCard: {
    paddingHorizontal: spacing[4],
  },
  stackedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: spacing[3],
    paddingVertical: spacing[3],
  },
  stackedDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  stackedLabel: {
    ...font(500),
    flexShrink: 1,
  },
});
