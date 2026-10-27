import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { getServerMessage, getStatus } from '../../../../shared/api/apiError';
import AppModal, { ModalActions, isTabletWidth } from '../../../../shared/components/AppModal';
import { CardHeroFill } from '../../../../shared/components/Card';
import EmptyState from '../../../../shared/components/EmptyState';
import ErrorAlert from '../../../../shared/components/ErrorAlert';
import GradientFill from '../../../../shared/components/GradientFill';
import { CAP_BODY, useLargeTextReflow } from '../../../../shared/components/largeText';
import Loader from '../../../../shared/components/Loader';
import PillButton from '../../../../shared/components/PillButton';
import { formatDateWithOffset } from '../../../../shared/time/format';
import { colors, font, gradients, radii, spacing, textScale, typography } from '../../../../shared/theme/tokens';
import { listClientWeightLogs } from '../api/clientsApi';
import { formatSigned, formatWeight, weightDelta } from '../clientFormat';
import { logsSince } from '../weightChartData';
import WeightHistoryChart from './WeightHistoryChart';

// The Current tile's gold corner glow (a 160 circle, top-right).
export const CURRENT_GLOW_SIZE = 160;

// UX M ruling 1: the chart's "Goal {n} {unit}" label, from the client's
// existing goal weight; no goal → no label.
export function goalLabel(profile) {
  const value = profile?.goal_weight_value;
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return null;
  }
  return `Goal ${formatWeight(value, profile?.goal_weight_unit)}`;
}

// Splits "64.2 kg" into the tabular number and its unit (the unit is drawn
// smaller and muted); "—" stays whole.
export function splitWeight(text) {
  const match = /^(.*\d)\s+(\S+)$/.exec(text ?? '');
  return match ? { number: match[1], unit: match[2] } : { number: text, unit: null };
}

// C2b (trainer clients spec §C5.2). Lifecycle pairing: the request starts on
// the open edge and goes stale on close / unmount; each open starts loading.
// v2 (UX M §Client weight): `clientName` = the tablet client-name eyebrow.
export default function WeightHistoryModal({ isOpen, clientUserId, profile, onClose, clientName }) {
  const { width } = useWindowDimensions();
  const tablet = isTabletWidth(width);
  const reflow = useLargeTextReflow();
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    let current = true;
    setState({ status: 'loading' });
    listClientWeightLogs(clientUserId)
      .then((logs) => current && setState({ status: 'loaded', logs }))
      .catch((failure) => {
        if (current) {
          const message = getStatus(failure) === 404 ? 'This is no longer one of your clients.' : getServerMessage(failure);
          setState({ status: 'error', message });
        }
      });
    return () => {
      current = false;
    };
  }, [isOpen, clientUserId]);

  return (
    <AppModal
      testID="weight-history-modal"
      isOpen={isOpen}
      onClose={onClose}
      // M 3: the client-name eyebrow, tablet only (AppModal `eyebrow`). FE
      // batch 1 ruling: 13/600 secondary, ONE line + tail ellipsis, above
      // "Weight history" (as the tablet board).
      eyebrow={
        tablet && clientName ? (
          <Text {...CAP_BODY} testID="weight-history-eyebrow" numberOfLines={1} ellipsizeMode="tail" style={styles.eyebrow}>
            {clientName}
          </Text>
        ) : undefined
      }
      title="Weight history"
      description="Every weigh-in this client has logged, oldest first."
      size="2xl"
      // FINAL-AUDIT batch 1 (5): the footer has the dismiss, so no phone ×.
      footerDismiss
      footer={
        // Phone: full width; tablet: the board's Close at the right.
        <ModalActions>
          <PillButton testID="weight-history-close" title="Close" variant="secondary" style={tablet ? undefined : styles.phoneFooterButton} onPress={onClose} />
        </ModalActions>
      }
    >
      {renderBody()}
    </AppModal>
  );

  function renderBody() {
    if (state.status === 'loading') {
      return <Loader label="Loading weight history" style={styles.loader} />;
    }
    if (state.status === 'error') {
      return <ErrorAlert title="Could not load weight history" description={state.message} />;
    }
    const { logs } = state;
    const first = logs[0];
    const latest = logs[logs.length - 1];
    const recent = logsSince(logs, 30);
    const thirtyDay = recent.length >= 2 ? weightDelta(recent[0], recent[recent.length - 1]) : null;
    const total = logs.length >= 2 ? weightDelta(first, latest) : null;
    const current = latest
      ? formatWeight(latest.weight_value, latest.weight_unit)
      : formatWeight(profile?.current_weight_value, profile?.current_weight_unit);
    const goal = formatWeight(profile?.goal_weight_value, profile?.goal_weight_unit);
    const goalText = goalLabel(profile);

    const currentTile = <CurrentTile value={current} tablet={tablet} />;
    const goalTile = <Tile testID="weight-history-goal" label="Goal" value={goal} tablet={tablet} />;
    const thirtyTile = <Tile testID="weight-history-30d" label="Change (30 days)" value={formatSigned(thirtyDay)} change tablet={tablet} />;
    const totalTile = <Tile testID="weight-history-total" label="Total change" value={formatSigned(total)} change tablet={tablet} wide={tablet && !reflow} />;

    return (
      <View style={styles.body}>
        {tablet && !reflow ? (
          <View testID="weight-history-summary" style={styles.summaryTablet}>
            <View style={styles.summaryTabletTop}>
              <View style={styles.currentColumn}>{currentTile}</View>
              <View style={styles.sideColumn}>
                {goalTile}
                {thirtyTile}
              </View>
            </View>
            {totalTile}
          </View>
        ) : (
          <View testID="weight-history-summary" style={styles.summary}>
            {currentTile}
            {/* UX §9 rule 4: past 1.3× the three tiles stack. */}
            <View testID="weight-history-tiles" style={[styles.tiles, reflow && styles.tilesStacked]}>
              {goalTile}
              {thirtyTile}
              {totalTile}
            </View>
          </View>
        )}
        <View testID="weight-history-chart" style={[styles.chartCard, tablet && styles.chartCardTablet]}>
          {/* UX M ruling 1: the dashed goal line from the client's goal
              (the label below). Still open (6n): the gold line look and the
              150 / 200 heights. */}
          <WeightHistoryChart logs={logs} profile={profile} showGoal />
          {goalText ? (
            <Text {...CAP_BODY} testID="weight-history-goal-label" style={[styles.goalLabel, tablet && styles.goalLabelTablet]}>
              {goalText}
            </Text>
          ) : null}
        </View>
        {logs.length === 0 ? (
          <EmptyState
            title="No weight logs yet"
            message="This client hasn’t recorded a weigh-in, so there is no trend to show."
          />
        ) : (
          // ⚠C-7: newest first, though the description says oldest first.
          <View testID="weight-history-logs" style={styles.list}>
            {[...logs].reverse().map((log, index) => (
              <View key={log.id ?? index} style={[styles.row, index > 0 && styles.divider]}>
                <Text {...CAP_BODY} style={styles.rowDate}>
                  {formatDateWithOffset(log.recorded_on, 1)}
                </Text>
                <Text {...CAP_BODY} style={styles.rowValue}>
                  {formatWeight(log.weight_value, log.weight_unit)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }
}

// The hero "Current" tile: gradient-card, the 0.08 edge, the gold corner glow;
// value display-xl (phone 56/56, tablet 72/72) tabular + the unit muted.
function CurrentTile({ value, tablet }) {
  const { number, unit } = splitWeight(value);
  return (
    <View
      testID="weight-history-current"
      accessible
      accessibilityLabel={`Current, ${value}`}
      style={[styles.current, tablet && styles.currentTablet]}
    >
      <CardHeroFill />
      <View pointerEvents="none" style={styles.currentGlow}>
        <GradientFill radial={gradients.heroGlow.radial} colors={gradients.heroGlow.colors} stops={gradients.heroGlow.stops} />
      </View>
      <Text {...CAP_BODY} style={styles.currentLabel}>
        Current
      </Text>
      <Text maxFontSizeMultiplier={textScale.display} style={[styles.currentValue, tablet && styles.currentValueTablet]}>
        {number}
        {unit ? <Text style={[styles.currentUnit, tablet && styles.currentUnitTablet]}>{` ${unit}`}</Text> : null}
      </Text>
    </View>
  );
}

// A summary tile (term/definition read as "Goal, 60 kg"). UX M ruling 2: the
// change values are teal with the code's sign; "—" stays neutral.
function Tile({ testID, label, value, change = false, tablet, wide = false }) {
  const teal = change && value !== '—';
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={`${label}, ${value}`}
      style={[styles.tile, tablet && styles.tileTablet, wide && styles.tileWide]}
    >
      <Text {...CAP_BODY} style={[styles.tileLabel, tablet && styles.tileLabelTablet]}>
        {label}
      </Text>
      <Text
        maxFontSizeMultiplier={textScale.title}
        testID={`${testID}-value`}
        style={[styles.tileValue, tablet && styles.tileValueTablet, teal && styles.tealValue]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Clear of the tablet Close (as AppModal's own eyebrow), 6 above the title.
  eyebrow: {
    ...font(600),
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    marginBottom: spacing['1_5'],
    paddingRight: 48,
  },
  // RN-SPEC-v2-phase5 §4: phone footer buttons 56.
  phoneFooterButton: {
    minHeight: 56,
  },
  loader: {
    paddingVertical: 40,
  },
  body: {
    gap: spacing[3],
  },
  summary: {
    gap: spacing[2],
  },
  tiles: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  tilesStacked: {
    flexDirection: 'column',
  },
  summaryTablet: {
    gap: spacing[3],
  },
  summaryTabletTop: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  currentColumn: {
    flex: 1.4,
  },
  sideColumn: {
    flex: 1,
    gap: spacing[3],
  },
  current: {
    overflow: 'hidden',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.choiceBorder,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing['4_5'],
  },
  currentTablet: {
    flex: 1,
    justifyContent: 'flex-end',
    borderRadius: radii.lgPlus,
    padding: spacing[4],
  },
  currentGlow: {
    position: 'absolute',
    top: -CURRENT_GLOW_SIZE / 2,
    right: -CURRENT_GLOW_SIZE / 2,
    width: CURRENT_GLOW_SIZE,
    height: CURRENT_GLOW_SIZE,
  },
  currentLabel: {
    ...font(400),
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  currentValue: {
    ...font(700),
    fontSize: 56,
    lineHeight: 56,
    letterSpacing: -3.08,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  currentValueTablet: {
    fontSize: 72,
    lineHeight: 72,
    letterSpacing: -3.6,
  },
  currentUnit: {
    ...font(400),
    fontSize: 20,
    letterSpacing: 0,
    color: colors.textMuted,
  },
  currentUnitTablet: {
    fontSize: 22,
  },
  // The drawn radius 18 folds to radii.md 16 (tokens §3).
  tile: {
    flex: 1,
    minWidth: 0,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing['3_5'],
  },
  tileTablet: {
    flex: 0,
    borderRadius: radii.lgPlus,
    backgroundColor: colors.fillWell,
    padding: spacing[4],
  },
  tileWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  tileLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  tileLabelTablet: {
    fontSize: 13,
    lineHeight: 18,
  },
  tileValue: {
    ...font(700),
    marginTop: spacing['0_5'],
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  tileValueTablet: {
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.78,
  },
  tealValue: {
    color: colors.teal,
  },
  chartCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    paddingTop: spacing['3_5'],
    paddingHorizontal: spacing['3_5'],
    paddingBottom: spacing['2_5'],
  },
  chartCardTablet: {
    padding: spacing['4_5'],
  },
  goalLabel: {
    ...typography.caption,
    marginTop: spacing[1],
    textAlign: 'center',
    color: colors.teal,
  },
  goalLabelTablet: {
    fontSize: 13,
    lineHeight: 18,
  },
  list: {
    overflow: 'hidden',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing[2],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  rowDate: {
    ...typography.bodySm,
    color: colors.textSecondary,
  },
  rowValue: {
    ...typography.bodySm,
    ...font(600),
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
});
