import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import Card from '../../shared/components/Card';
import EmptyState from '../../shared/components/EmptyState';
import { InlineError } from '../../shared/components/FeedbackBox';
import Loader from '../../shared/components/Loader';
import { InlineToast } from '../../shared/components/ToastHost';
import { ToastTone } from '../../shared/components/toastStore';
import { useFocusRemountKey } from '../../shared/hooks/useFocusRemountKey';
import { formatNumber } from '../../shared/format/numbers';
import { breakpoints, colors, radii, shadows } from '../../shared/theme/tokens';
import WeightLogModal from '../home/WeightLogModal';
import { applySavedWeightLog, useProfileStore } from '../profile/profileStore';
import ShellPage from '../shell/ShellPage';
import WeightHistoryChart from '../trainer/clients/components/WeightHistoryChart';
import { loadProgress } from './api/progressApi';
import {
  activityStats,
  barHeight,
  chartLogs,
  goalCompletion,
  gridRows,
  logCountLabel,
  maxFrequency,
  progressUnit,
  recentLogRows,
  weightStats,
  weightUnits,
} from './progressFormat';

const SAVED_TOAST_MS = 3500;
const BAR_ANIMATION_MS = 500;
// CSS `ease-out`.
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1);
const TABS = [
  { key: 'body', label: 'Body' },
  { key: 'activity', label: 'Activity' },
];

// Progress (RN-SPEC-progress), the Progress tab root. Every focus is a fresh
// mount (plans §8.1), which also resets the tab to Body.
export default function ProgressScreen() {
  const remountKey = useFocusRemountKey();
  return (
    <ShellPage>
      <Progress key={remountKey} />
    </ShellPage>
  );
}

function Progress() {
  const [load, setLoad] = useState({ status: 'loading', data: null, error: null });
  const [reloadCount, setReloadCount] = useState(0);
  const [tab, setTab] = useState('body');
  const [modalOpen, setModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const mounted = useRef(true);

  useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );

  // PR1.1: on mount and after each weight log; the whole screen goes back
  // to the loader (⚠PR-7). The tab is kept.
  useEffect(() => {
    setLoad({ status: 'loading', data: null, error: null });
    loadProgress().then(
      (data) => mounted.current && setLoad({ status: 'loaded', data, error: null }),
      (error) => mounted.current && setLoad({ status: 'error', data: null, error })
    );
  }, [reloadCount]);

  // Home ⚠H-8: the timer starts when the message first appears.
  useEffect(() => {
    if (!successMessage) {
      return undefined;
    }
    const timer = setTimeout(() => setSuccessMessage(''), SAVED_TOAST_MS);
    return () => clearTimeout(timer);
  }, [successMessage]);

  if (load.status === 'loading') {
    return <Loader label="Loading progress" />;
  }
  if (load.status === 'error') {
    // ⚠PR-1: the transport text, no retry.
    return (
      <InlineError testID="progress-error" title="Progress unavailable" message={load.error?.message || 'Please try again.'} />
    );
  }

  const { weightProgress, weightLogs, overview, history, frequency } = load.data;
  const unit = progressUnit(weightLogs);

  return (
    <View style={styles.page}>
      {successMessage ? (
        <InlineToast testID="progress-saved-toast" tone={ToastTone.success} title="Saved" message={successMessage} />
      ) : null}

      {/* Batch A A5: no page header; the screen starts with the segments. */}
      <View testID="progress-tabs" accessibilityRole="tablist" style={[styles.segments, styles.cardShadow]}>
        {TABS.map((item) => {
          const active = tab === item.key;
          return (
            <Pressable
              key={item.key}
              testID={`progress-tab-${item.key}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setTab(item.key)}
              style={({ pressed }) => [
                styles.segment,
                active ? styles.segmentActive : pressed && styles.segmentPressed,
              ]}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {tab === 'body' ? (
        <BodyTab weightProgress={weightProgress} weightLogs={weightLogs} onAddWeight={() => setModalOpen(true)} />
      ) : (
        <ActivityTab overview={overview} history={history} frequency={frequency} />
      )}

      {/* PR2: Home §H2 with Progress' unit; no defaultRecordedOn (23 Oct). */}
      <WeightLogModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultUnit={unit}
        onSuccess={(saved) => {
          // T-34 F1: patch the store before the reload, so Current keeps its unit.
          applySavedWeightLog(saved);
          setModalOpen(false);
          setSuccessMessage('Weight log added.');
          setReloadCount((value) => value + 1);
        }}
      />
    </View>
  );
}

// PR1.4
function BodyTab({ weightProgress, weightLogs, onAddWeight }) {
  // T-34: the profile store, already loaded by the profile gate (no request).
  const profile = useProfileStore((state) => state.profile);
  const units = weightUnits(profile, weightLogs);
  const completion = goalCompletion(weightProgress, units);
  const rows = recentLogRows(weightLogs);

  return (
    <>
      <View testID="progress-weight-stats" style={[styles.strip, styles.cardShadow]}>
        {weightStats(weightProgress, units).map((item, index) => (
          <View key={item.label} style={[styles.stripItem, index > 0 && styles.divider]}>
            <Text style={styles.statLabel}>{item.label}</Text>
            <Text numberOfLines={1} textBreakStrategy="simple" style={[styles.stripValue, item.brand && styles.brandValue]}>{item.value}</Text>
          </View>
        ))}
      </View>

      <View testID="progress-goal" style={[styles.bigCard, styles.cardShadow]}>
        <View style={styles.goalRow}>
          <View style={styles.textColumn}>
            <Text textBreakStrategy="simple" style={styles.sectionTitle}>Goal progress</Text>
            <Text numberOfLines={1} textBreakStrategy="simple" testID="progress-goal-value" style={styles.goalValue}>{`${formatNumber(completion, 0)}%`}</Text>
          </View>
          <Pressable
            testID="progress-add-weight"
            accessibilityRole="button"
            onPress={onAddWeight}
            style={({ pressed }) => [styles.addWeight, pressed && styles.addWeightPressed]}
          >
            {/* Android's default "highQuality" line breaking wraps heavy text that fits. */}
            <Text numberOfLines={1} textBreakStrategy="simple" style={styles.addWeightText}>
              Add weight
            </Text>
          </Pressable>
        </View>
        <GoalBar completion={completion} />
      </View>

      <View testID="progress-history" style={[styles.bigCard, styles.cardShadow]}>
        <View style={styles.historyHeader}>
          <Text textBreakStrategy="simple" style={styles.sectionTitle}>Weight history</Text>
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{logCountLabel(weightLogs.length)}</Text>
          </View>
        </View>
        {weightLogs.length > 0 ? (
          <WeightHistoryChart logs={chartLogs(weightLogs)} unit={units.current} />
        ) : (
          <EmptyState title="No weight logs yet" message="Add your first weight entry to unlock the chart." />
        )}
      </View>

      <Card title="Recent logs" subtitle="The latest entries you added.">
        {rows.length === 0 ? (
          <Text style={styles.noLogs}>No weight logs yet.</Text>
        ) : (
          <View style={styles.logList}>
            {rows.map((row) => (
              <View key={row.key} testID={`progress-log-${row.key}`} style={styles.logRow}>
                <View style={styles.logTop}>
                  <View style={styles.textColumn}>
                    <Text style={styles.logWeight}>{row.weight}</Text>
                    <Text style={styles.logDate}>{row.date}</Text>
                  </View>
                  <View style={styles.unitPill}>
                    <Text style={styles.countPillText}>{row.unit}</Text>
                  </View>
                </View>
                {row.note ? <Text style={styles.logNote}>{row.note}</Text> : null}
              </View>
            ))}
          </View>
        )}
      </Card>
    </>
  );
}

// PR1.4 item 2: the fill width animates over 500 ms ease-out when it changes.
function GoalBar({ completion }) {
  const width = useRef(new Animated.Value(completion)).current;

  useEffect(() => {
    const animation = Animated.timing(width, {
      toValue: completion,
      duration: BAR_ANIMATION_MS,
      easing: EASE_OUT,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [completion, width]);

  const fillWidth = width.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(completion) }}
    >
      <Animated.View style={[styles.fill, { width: fillWidth }]} />
    </View>
  );
}

// PR1.5
function ActivityTab({ overview, history, frequency }) {
  const { width } = useWindowDimensions();
  const columns = width >= breakpoints.sm ? 4 : 2;
  const max = maxFrequency(frequency);

  return (
    <>
      <View testID="progress-activity-stats" style={styles.statGrid}>
        {gridRows(activityStats(overview, history), columns).map((row, rowIndex) => (
          <View key={`stats-${rowIndex}`} style={styles.statRow}>
            {row.map((item, index) =>
              item ? (
                <View key={item.label} style={[styles.statCard, styles.cardShadow]}>
                  <Text style={styles.statLabel}>{item.label}</Text>
                  <Text numberOfLines={1} textBreakStrategy="simple" style={styles.statValue}>{item.value}</Text>
                </View>
              ) : (
                <View key={`spacer-${index}`} style={styles.cell} />
              )
            )}
          </View>
        ))}
      </View>

      <View testID="progress-consistency" style={[styles.bigCard, styles.cardShadow]}>
        <View style={styles.historyHeader}>
          <Text textBreakStrategy="simple" style={styles.sectionTitle}>12-week consistency</Text>
          <Text style={styles.perWeek}>per week</Text>
        </View>
        {frequency.length === 0 ? (
          <EmptyState title="No completed workouts yet" message="Finish workouts to unlock weekly consistency." />
        ) : (
          <View style={styles.barGrid}>
            {gridRows(frequency, 12).map((row, rowIndex) => (
              <View key={`bars-${rowIndex}`} style={styles.barRow}>
                {row.map((item, index) =>
                  item ? (
                    <View key={`${item.period_start}-${index}`} style={styles.cell}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: barHeight(item.workout_count, max),
                            backgroundColor: Number(item.workout_count) > 0 ? colors.brand400 : colors.surfaceMuted,
                          },
                        ]}
                      />
                      <Text style={styles.barCount}>{String(item.workout_count)}</Text>
                    </View>
                  ) : (
                    <View key={`spacer-${index}`} style={styles.cell} />
                  )
                )}
              </View>
            ))}
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: 20,
    paddingBottom: 20,
  },
  cardShadow: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    boxShadow: shadows.soft,
  },
  segments: {
    flexDirection: 'row',
    gap: 4,
    borderRadius: radii.lg,
    padding: 4,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: radii.md,
    paddingVertical: 12,
  },
  segmentActive: {
    backgroundColor: colors.brand400,
  },
  segmentPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  segmentText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: colors.navy,
  },
  strip: {
    flexDirection: 'row',
    borderRadius: radii.xxl,
    paddingVertical: 16,
  },
  stripItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  divider: {
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  // Batch 2 #24/#28: the 11px minimum (tracking 0.12em).
  statLabel: {
    fontSize: 11,
    lineHeight: 16.5,
    fontWeight: '700',
    letterSpacing: 1.32,
    textTransform: 'uppercase',
    color: colors.textMuted,
    textAlign: 'center',
  },
  stripValue: {
    marginTop: 4,
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
    textAlign: 'center',
  },
  brandValue: {
    // Spec: brand-600; brand text is brand-700 on native for contrast.
    color: colors.brand700,
  },
  bigCard: {
    borderRadius: radii.xxl,
    padding: 20,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  textColumn: {
    flex: 1,
    minWidth: 0,
  },
  // The titles use textBreakStrategy "simple": Android's default highQuality
  // break measured them narrower than drawn, so "WEIGHT HISTORY" wrapped to
  // "WEIGHT" in its one-line box (QA, 26 Oct 2026).
  sectionTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  goalValue: {
    marginTop: 4,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  addWeight: {
    flexShrink: 0,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.brand400,
    paddingHorizontal: 16,
    paddingVertical: 10,
    // Batch 2 #23: soft, not the glow.
    boxShadow: shadows.soft,
  },
  addWeightPressed: {
    backgroundColor: colors.brand500,
  },
  addWeightText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '900',
    color: colors.navy,
  },
  track: {
    marginTop: 12,
    height: 8,
    width: '100%',
    overflow: 'hidden',
    borderRadius: radii.full,
    backgroundColor: colors.surfaceMuted,
  },
  fill: {
    height: '100%',
    borderRadius: radii.full,
    backgroundColor: colors.brand400,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  countPill: {
    borderRadius: radii.full,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  unitPill: {
    flexShrink: 0,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  countPillText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  // Profile §P2.2 Card: radius 23.2, transparent border, clipped.
  noLogs: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  logList: {
    gap: 12,
  },
  logRow: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 16,
  },
  logTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  logWeight: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  logDate: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  logNote: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  statGrid: {
    gap: 10,
  },
  statRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    borderRadius: radii.lg,
    padding: 16,
  },
  statValue: {
    marginTop: 6,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
    textAlign: 'center',
  },
  perWeek: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors.textMuted,
  },
  barGrid: {
    gap: 6,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  cell: {
    flex: 1,
    minWidth: 0,
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  barCount: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
  },
});
