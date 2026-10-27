import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { CardSurface } from '../../shared/components/Card';
import EmptyState from '../../shared/components/EmptyState';
import { InlineError } from '../../shared/components/FeedbackBox';
import Loader from '../../shared/components/Loader';
import PillButton from '../../shared/components/PillButton';
import StateSlot from '../../shared/components/StateSlot';
import StatusPill from '../../shared/components/StatusPill';
import { InlineToast } from '../../shared/components/ToastHost';
import { ToastTone } from '../../shared/components/toastStore';
import { CAP_BODY, CAP_PILL, TITLE_TEXT } from '../../shared/components/largeText';
import { useFocusRemountKey } from '../../shared/hooks/useFocusRemountKey';
import { formatNumber } from '../../shared/format/numbers';
import { breakpoints, colors, font, radii, textScale, typography } from '../../shared/theme/tokens';
import { memberVolume, workoutInitials } from '../home/homeFormat';
import WeightLogModal from '../home/WeightLogModal';
import { applySavedWeightLog, useProfileStore } from '../profile/profileStore';
import ShellPage from '../shell/ShellPage';
import { logsSince } from '../trainer/clients/weightChartData';
import ProgressRing from '../workout/components/ProgressRing';
import { getWeightLogsInRange, loadProgress } from './api/progressApi';
import ProgressWeightChart from './ProgressWeightChart';
import {
  DEFAULT_RANGE,
  PHONE_RANGES,
  activityStats,
  barHeight,
  chartLabel,
  chartLogs,
  completionCells,
  consistencyPercent,
  goalCompletion,
  goalInUnit,
  logCountLabel,
  maxFrequency,
  progressUnit,
  rangeDates,
  rangeDelta,
  recentLogRows,
  recentWorkoutRows,
  toGoalLine,
  weeklyBars,
  weightStats,
  weightUnits,
} from './progressFormat';

const SAVED_TOAST_MS = 3500;
const NUMBER = { maxFontSizeMultiplier: textScale.display };
const TABS = [
  { key: 'body', label: 'Body' },
  { key: 'activity', label: 'Activity' },
];

// Progress (RN-SPEC-progress), the Progress tab root, v2 look per UX G
// "Progress" (phone) and "Tablet: Progress". Every focus is a fresh mount
// (plans §8.1), which also resets the tab to Body. ND-5: nothing removed
// (Body/Activity, Goal progress, Goal / To goal, Streak, Workouts, Avg time,
// the 12-week bars), plus the approved N1 ranges (phone), U9 goal line, #23
// bars + Consistency and U8 Recent workouts with Missed rows (phone).
export default function ProgressScreen() {
  const remountKey = useFocusRemountKey();
  return (
    <ShellPage>
      <Progress key={remountKey} />
    </ShellPage>
  );
}

function Progress() {
  const { width, fontScale } = useWindowDimensions();
  const [tablet] = useState(() => width >= breakpoints.md);
  const reflow = fontScale > textScale.reflowAbove;
  const [load, setLoad] = useState({ status: 'loading', data: null, error: null });
  const [reloadCount, setReloadCount] = useState(0);
  const [tab, setTab] = useState('body');
  const [range, setRange] = useState(DEFAULT_RANGE);
  const [rangeLogs, setRangeLogs] = useState({ key: null, range: null, reload: null, logs: null });
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
  // to the loader (⚠PR-7). The tab and the range are kept.
  useEffect(() => {
    setLoad({ status: 'loading', data: null, error: null });
    loadProgress().then(
      (data) => mounted.current && setLoad({ status: 'loaded', data, error: null }),
      (error) => mounted.current && setLoad({ status: 'error', data: null, error })
    );
  }, [reloadCount]);

  // N1 (phone): the selected range's logs; a failure falls back to the
  // newest 20 in that range (no error shown).
  useEffect(() => {
    if (tablet) {
      return undefined;
    }
    let alive = true;
    const key = `${range}:${reloadCount}`;
    // A synchronous throw counts as a failure too (falls back, no error).
    Promise.resolve()
      .then(() => getWeightLogsInRange(rangeDates(range)))
      .then(
      (logs) => alive && mounted.current && setRangeLogs({ key, range, reload: reloadCount, logs }),
      () => alive && mounted.current && setRangeLogs({ key, range, reload: reloadCount, logs: null })
    );
    return () => {
      alive = false;
    };
  }, [range, reloadCount, tablet]);

  useEffect(() => {
    if (!successMessage) {
      return undefined;
    }
    const timer = setTimeout(() => setSuccessMessage(''), SAVED_TOAST_MS);
    return () => clearTimeout(timer);
  }, [successMessage]);

  if (load.status === 'loading') {
    return (
      <StateSlot loader>
        <Loader label="Loading progress" />
      </StateSlot>
    );
  }
  if (load.status === 'error') {
    // ⚠PR-1: the transport text, no retry.
    return (
      <StateSlot>
        <InlineError testID="progress-error" title="Progress unavailable" message={load.error?.message || 'Please try again.'} />
      </StateSlot>
    );
  }

  const { weightProgress, weightLogs, overview, history, frequency, missed, recentWorkouts, week, planDaysPerWeek } = load.data;
  const unit = progressUnit(weightLogs);
  const fallbackFor = (key) => logsSince(chartLogs(weightLogs), PHONE_RANGES.find((item) => item.key === key)?.days ?? 90);
  // Batch 3 (e), web parity: while a newly picked range loads, the chart
  // keeps the last settled range's data, dimmed + busy (no skeleton); the
  // new chip is already selected (`range`).
  const settled = rangeLogs.key === `${range}:${reloadCount}`;
  const rangeLoading = !tablet && !settled && rangeLogs.reload === reloadCount && rangeLogs.range !== null;
  const shownRangeLogs = settled
    ? rangeLogs.logs ?? fallbackFor(range)
    : rangeLoading
      ? rangeLogs.logs ?? fallbackFor(rangeLogs.range)
      : fallbackFor(range);

  const tabs = <ViewSwitch tab={tab} onChange={setTab} tablet={tablet} />;

  return (
    <View style={[styles.page, tablet && styles.pageTablet]}>
      {successMessage ? <InlineToast testID="progress-saved-toast" tone={ToastTone.success} title="Saved" message={successMessage} /> : null}

      {/* UX verdict I1 (iPad, 15e819a): ONE page title. The shell header
          already draws the tablet 52 "Progress" (as on every tablet page), so
          the page draws no second H1; the switch has its own row. */}
      {tabs}

      {tab === 'body' ? (
        <BodyTab
          weightProgress={weightProgress}
          weightLogs={weightLogs}
          rangeLogs={shownRangeLogs}
          rangeLoading={rangeLoading}
          range={range}
          onRange={setRange}
          tablet={tablet}
          reflow={reflow}
          onAddWeight={() => setModalOpen(true)}
        />
      ) : (
        <ActivityTab
          overview={overview}
          history={history}
          frequency={frequency}
          missed={missed}
          week={week}
          recentWorkouts={recentWorkouts}
          planDaysPerWeek={planDaysPerWeek}
          tablet={tablet}
          reflow={reflow}
        />
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

// "Progress view" switch. Same on phone (the phone board draws none; ND-5
// keeps the tabs). Starts on Body per mount. UX verdict P3-3 (faf7f85): GLASS
// like web's view switch (selected = white 0.12 + primary text 600); the gold
// "+" Add weight stays the one gold element.
function ViewSwitch({ tab, onChange, tablet }) {
  return (
    <View testID="progress-tabs" accessibilityRole="tablist" accessibilityLabel="Progress view" style={[styles.switch, tablet && styles.switchTablet]}>
      {TABS.map((item) => {
        const active = tab === item.key;
        return (
          <Pressable
            key={item.key}
            testID={`progress-tab-${item.key}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(item.key)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            {({ pressed }) => (
              <>
                {pressed ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.segmentOverlay, styles.whiteOverlay]} /> : null}
                <Text {...CAP_BODY} style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {item.label}
                </Text>
              </>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function PlusIcon({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

// 44 gold circle, "Add weight" (the one gold action on the phone page).
function AddWeightIcon({ onPress }) {
  return (
    <Pressable testID="progress-add-weight" accessibilityRole="button" accessibilityLabel="Add weight" onPress={onPress} style={styles.addIcon}>
      {({ pressed }) => (
        <>
          {pressed ? <View testID="progress-add-weight-pressed" pointerEvents="none" style={[StyleSheet.absoluteFill, styles.inkOverlay, styles.round]} /> : null}
          <PlusIcon size={18} color={colors.onGold} />
        </>
      )}
    </Pressable>
  );
}

function splitUnit(text) {
  const match = /^(.*\S)\s+([^\s\d]+)$/.exec(String(text ?? ''));
  return match ? { value: match[1], unit: match[2] } : { value: String(text ?? ''), unit: '' };
}

function ChartBlock({ logs, units, goal, height, grid, total }) {
  if (total === 0) {
    return <EmptyState title="No weight logs yet" message="Add your first weight entry to unlock the chart." />;
  }
  if (logs.length < 2) {
    return <EmptyState title="Not enough weight history yet" message="Add a few weight logs and the chart will start showing your trend." />;
  }
  return <ProgressWeightChart logs={logs} unit={units.current} goal={goal} height={height} grid={grid} label={chartLabel(logs, units.current)} />;
}

// PR1.4 Body (Current / Goal / To goal, Goal progress, history, recent logs).
function BodyTab({ weightProgress, weightLogs, rangeLogs, rangeLoading = false, range, onRange, tablet, reflow, onAddWeight }) {
  // T-34: the profile store, already loaded by the profile gate (no request).
  const profile = useProfileStore((state) => state.profile);
  const units = weightUnits(profile, weightLogs);
  const completion = goalCompletion(weightProgress, units);
  const rows = recentLogRows(weightLogs);
  const [current, goalStat, toGoalStat] = weightStats(weightProgress, units);
  const goal = goalInUnit(weightProgress, units);
  const big = splitUnit(current.value);

  const goalRing = (size, stroke) => (
    <ProgressRing
      flat
      value={completion}
      total={100}
      size={size}
      thickness={(stroke * 100) / size}
      label="Goal progress"
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(completion) }}
    >
      {tablet ? (
        <Text {...NUMBER} numberOfLines={1} textBreakStrategy="simple" testID="progress-goal-value" style={styles.goalValueTablet}>{`${formatNumber(completion, 0)}%`}</Text>
      ) : null}
    </ProgressRing>
  );

  const recentLogs = (
    <View testID="progress-logs" style={[styles.card, tablet ? styles.cardTablet : styles.cardPhone, tablet && styles.flexCard]}>
      <Text accessibilityRole="header" {...TITLE_TEXT} style={tablet ? styles.h2Tablet : styles.h2}>
        Recent logs
      </Text>
      {tablet ? (
        <Text {...CAP_BODY} style={styles.cardSub}>
          The latest entries you added.
        </Text>
      ) : null}
      {rows.length === 0 ? (
        <Text {...CAP_BODY} style={styles.noLogs}>
          No weight logs yet.
        </Text>
      ) : (
        <View style={styles.logList}>
          {rows.map((row) => (
            <View key={row.key} testID={`progress-log-${row.key}`} style={styles.logRow}>
              <View style={[styles.logTop, reflow && styles.stackedRow]}>
                <View style={styles.textColumn}>
                  <Text {...CAP_BODY} style={styles.logWeight}>
                    {row.weight}
                  </Text>
                  <Text {...CAP_BODY} style={styles.logDate}>
                    {row.date}
                  </Text>
                </View>
                <View style={styles.unitPill}>
                  <Text {...CAP_PILL} style={styles.unitPillText}>
                    {row.unit}
                  </Text>
                </View>
              </View>
              {row.note ? (
                <Text {...CAP_BODY} style={styles.logNote}>
                  {row.note}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </View>
  );

  if (tablet) {
    return (
      <>
        <View style={[styles.row, reflow && styles.column]}>
          <CardSurface hero testID="progress-goal" style={[styles.goalCard, !reflow && styles.flex1]}>
            <Text textBreakStrategy="simple" {...TITLE_TEXT} style={styles.goalLabelTablet}>
              Goal progress
            </Text>
            {goalRing(190, 18)}
            <View style={styles.stretch}>
              <PillButton testID="progress-add-weight" title="Add weight" fullWidth icon={({ color }) => <PlusIcon size={16} color={color} />} onPress={onAddWeight} />
            </View>
          </CardSurface>
          <View testID="progress-weight-stats" style={[styles.columnGap, !reflow && styles.flex1]}>
            <CardSurface hero style={[styles.currentTile, !reflow && styles.flex1]}>
              <Text {...CAP_BODY} style={styles.tileLabel}>
                Current
              </Text>
              <Text {...NUMBER} style={styles.currentTablet}>
                {big.value}
                {big.unit ? <Text style={styles.currentUnitTablet}>{` ${big.unit}`}</Text> : null}
              </Text>
            </CardSurface>
            <View style={[styles.row, reflow && styles.column]}>
              <View style={[styles.smallTile, styles.flex1]}>
                <Text {...CAP_BODY} style={styles.tileLabel}>
                  Goal
                </Text>
                <Text {...NUMBER} style={styles.smallValue}>
                  {goalStat.value}
                </Text>
              </View>
              <View style={[styles.smallTile, styles.toGoalTile, styles.flex1]}>
                <Text {...CAP_BODY} style={styles.tileLabel}>
                  To goal
                </Text>
                <Text {...NUMBER} style={[styles.smallValue, styles.goldValue]}>
                  {toGoalStat.value}
                </Text>
              </View>
            </View>
          </View>
        </View>
        <View style={[styles.row, styles.alignStart, reflow && styles.column]}>
          <CardSurface hero testID="progress-history" style={[styles.historyCard, !reflow && styles.flexHistory]}>
            <View style={[styles.spaceRow, reflow && styles.stackedRow]}>
              <Text textBreakStrategy="simple" accessibilityRole="header" {...TITLE_TEXT} style={styles.h2Tablet}>
                Weight history
              </Text>
              <View style={styles.countPill}>
                <Text {...CAP_PILL} style={styles.unitPillText}>
                  {logCountLabel(weightLogs.length)}
                </Text>
              </View>
            </View>
            <View style={styles.mt16}>
              <ChartBlock logs={chartLogs(weightLogs)} units={units} goal={goal} height={200} grid total={weightLogs.length} />
            </View>
          </CardSurface>
          <View style={!reflow && styles.flex1}>{recentLogs}</View>
        </View>
      </>
    );
  }

  const delta = [rangeDelta(rangeLogs, units.current), toGoalLine(weightProgress, units)].filter(Boolean).join(' · ');
  return (
    <>
      <CardSurface hero testID="progress-history" style={styles.weightCard}>
        <View style={styles.spaceRowStart}>
          <View style={styles.textColumn}>
            <Text {...CAP_BODY} style={styles.tileLabel}>
              Current
            </Text>
            <Text testID="progress-current" {...NUMBER} style={styles.currentPhone}>
              {big.value}
              {big.unit ? <Text style={styles.currentUnit}>{` ${big.unit}`}</Text> : null}
            </Text>
            {delta ? (
              <Text testID="progress-delta" accessibilityLiveRegion="polite" {...CAP_BODY} style={styles.delta}>
                {delta}
              </Text>
            ) : null}
          </View>
          <AddWeightIcon onPress={onAddWeight} />
        </View>
        <View style={[styles.spaceRow, styles.mt14, reflow && styles.stackedRow]}>
          <Text textBreakStrategy="simple" accessibilityRole="header" {...TITLE_TEXT} style={styles.smallHeading}>
            Weight history
          </Text>
          <Text testID="progress-log-count" {...CAP_BODY} style={styles.caption}>
            {logCountLabel(rangeLogs.length)}
          </Text>
        </View>
        <View testID="progress-chart-wrap" accessibilityState={{ busy: rangeLoading }} style={[styles.mt10, rangeLoading && styles.rangeLoading]}>
          <ChartBlock logs={rangeLogs} units={units} goal={goal} height={110} total={weightLogs.length} />
        </View>
        <View testID="progress-ranges" accessibilityLabel="Range" style={[styles.ranges, reflow && styles.rangesWrap]}>
          {PHONE_RANGES.map((item) => {
            const active = item.key === range;
            return (
              <Pressable
                key={item.key}
                testID={`progress-range-${item.key}`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                hitSlop={6}
                onPress={() => onRange(item.key)}
                style={[styles.rangeSegment, active && styles.rangeActive]}
              >
                {({ pressed }) => (
                  <>
                    {pressed ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.whiteOverlay, styles.round]} /> : null}
                    <Text {...CAP_BODY} style={[styles.rangeText, active && styles.rangeTextActive]}>
                      {item.key}
                    </Text>
                  </>
                )}
              </Pressable>
            );
          })}
        </View>
      </CardSurface>

      <View testID="progress-weight-stats" style={[styles.row, reflow && styles.column]}>
        <View testID="progress-goal" style={[styles.tile, !reflow && styles.flex1]}>
          <Text textBreakStrategy="simple" {...TITLE_TEXT} style={styles.tileLabel}>
            Goal progress
          </Text>
          <View style={[styles.ringRow, reflow && styles.stackedRow]}>
            {goalRing(64, 8)}
            <Text {...NUMBER} numberOfLines={1} textBreakStrategy="simple" testID="progress-goal-value" style={styles.tileValue}>{`${formatNumber(completion, 0)}%`}</Text>
          </View>
        </View>
        <View style={[styles.tile, !reflow && styles.flex1]}>
          <Text {...CAP_BODY} style={styles.tileLabel}>
            Goal
          </Text>
          <Text {...NUMBER} style={styles.goalSmall}>
            {goalStat.value}
          </Text>
          <Text {...CAP_BODY} style={[styles.tileLabel, styles.mt6]}>
            To goal
          </Text>
          <Text {...NUMBER} style={[styles.goalSmall, styles.tealValue]}>
            {toGoalStat.value}
          </Text>
        </View>
      </View>

      {recentLogs}
    </>
  );
}

// 12-week bars (PR1.5, today's component in the board's tile style).
function TwelveWeeks({ frequency, tablet }) {
  const max = maxFrequency(frequency);
  return (
    <View testID="progress-consistency" style={[styles.card, tablet ? styles.cardTablet : styles.cardPhone]}>
      <View style={styles.spaceRow}>
        <Text textBreakStrategy="simple" accessibilityRole="header" {...TITLE_TEXT} style={tablet ? styles.h2Tablet : styles.h2}>
          12-week consistency
        </Text>
        <Text {...CAP_BODY} style={styles.caption}>
          per week
        </Text>
      </View>
      {frequency.length === 0 ? (
        <View style={styles.mt12}>
          <EmptyState title="No completed workouts yet" message="Finish workouts to unlock weekly consistency." />
        </View>
      ) : (
        <View style={styles.barRow}>
          {frequency.slice(0, 12).map((item, index) => (
            <View key={`${item.period_start}-${index}`} style={styles.barCell}>
              <View
                style={[
                  styles.bar,
                  { height: barHeight(item.workout_count, max), backgroundColor: Number(item.workout_count) > 0 ? colors.gold : colors.track },
                ]}
              />
              <Text {...CAP_BODY} style={styles.barCount}>
                {String(item.workout_count)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// PR1.5 Activity + #23 (Workouts per week, Consistency) + U8 (phone).
function ActivityTab({ overview, history, frequency, missed, week, recentWorkouts, planDaysPerWeek = null, tablet, reflow }) {
  const profile = useProfileStore((state) => state.profile);
  const unit = profile?.current_weight_unit || profile?.goal_weight_unit || 'kg';
  const bars = weeklyBars(frequency);
  const percent = consistencyPercent(missed);
  const grid = completionCells(missed, week);
  const stats = activityStats(overview, history);
  const rows = tablet ? [] : recentWorkoutRows(recentWorkouts, missed?.items, unit, memberVolume);

  // ND-10 (UX G 27 Oct): "Goal {n}" (the active plan's days per week) right
  // of the label; the label truncates first; no plan → the label alone.
  const goalDays = Number.isInteger(planDaysPerWeek) && planDaysPerWeek > 0 ? planDaysPerWeek : null;
  const perWeekLabel = ['Workouts per week', goalDays ? `goal ${goalDays}` : null, bars.empty ? null : `average ${bars.average}`].filter(Boolean).join(', ');
  const perWeekHead = (
    <View testID="progress-per-week-head" style={[styles.spaceRow, reflow && styles.stackedRow]}>
      <Text testID="progress-per-week-label" {...CAP_BODY} numberOfLines={reflow ? undefined : 1} style={[styles.tileLabel, styles.shrink]}>
        Workouts per week
      </Text>
      {goalDays ? (
        <Text testID="progress-per-week-goal" {...CAP_BODY} numberOfLines={1} textBreakStrategy="simple" style={styles.perWeekGoal}>
          {`Goal ${goalDays}`}
        </Text>
      ) : null}
    </View>
  );
  const perWeek = (
    <View testID="progress-per-week" style={[styles.tile, !reflow && styles.flex1]}>
      {bars.empty ? (
        <View testID="progress-per-week-summary" accessible accessibilityLabel={perWeekLabel}>
          {perWeekHead}
        </View>
      ) : null}
      {bars.empty ? (
        <View>
          <Text {...CAP_BODY} style={styles.emptyTitle}>
            No completed workouts yet
          </Text>
          <Text {...CAP_BODY} style={styles.caption}>
            Finish workouts to unlock weekly consistency.
          </Text>
        </View>
      ) : (
        <>
          <View testID="progress-per-week-summary" accessible accessibilityLabel={perWeekLabel}>
            {perWeekHead}
            <Text {...NUMBER} style={styles.tileValue}>
              {bars.average}
            </Text>
          </View>
          <View testID="progress-week-bars" accessible accessibilityRole="image" accessibilityLabel={bars.label} style={styles.miniBars}>
            {bars.bars.map((bar) => (
              <View
                key={bar.key}
                testID={bar.current ? 'progress-week-bar-current' : undefined}
                style={[styles.miniBar, { height: `${Math.max(7, Math.round(bar.ratio * 100))}%`, backgroundColor: bar.current ? colors.gold : colors.hairlineBright }]}
              />
            ))}
          </View>
        </>
      )}
    </View>
  );
  const consistency =
    percent === null ? null : (
      <View testID="progress-completion" style={[styles.tile, !reflow && styles.flex1]}>
        <Text {...CAP_BODY} style={styles.tileLabel}>
          Consistency
        </Text>
        <Text {...NUMBER} style={styles.tileValue}>{`${formatNumber(percent, 0)}%`}</Text>
        <Text {...CAP_BODY} style={styles.caption}>
          of planned days
        </Text>
        {grid && grid.cells.length > 0 ? (
          <View testID="progress-completion-grid" accessible accessibilityRole="image" accessibilityLabel={grid.label} style={styles.squares}>
            {grid.cells.map((cell) => (
              <View
                key={cell.key}
                testID={`progress-cell-${cell.status}`}
                style={[styles.square, { backgroundColor: cell.status === 'done' ? colors.gold : cell.status === 'missed' ? colors.warningStrong : colors.track }]}
              />
            ))}
          </View>
        ) : null}
      </View>
    );

  return (
    <>
      <View style={[styles.row, reflow && styles.column]}>
        {perWeek}
        {consistency}
      </View>
      <View testID="progress-activity-stats" style={[styles.statGrid, reflow && styles.column]}>
        {stats.map((item) => (
          <View key={item.label} style={[styles.statTile, tablet ? styles.statTileTablet : styles.statTilePhone, reflow && styles.statTileFull]}>
            <Text {...CAP_BODY} style={styles.tileLabel}>
              {item.label}
            </Text>
            <Text {...NUMBER} numberOfLines={1} textBreakStrategy="simple" style={tablet ? styles.statValueTablet : styles.tileValue}>
              {item.value}
            </Text>
          </View>
        ))}
      </View>
      <TwelveWeeks frequency={frequency} tablet={tablet} />
      {!tablet && rows.length > 0 ? (
        <View testID="progress-recent" style={[styles.card, styles.recentCard]}>
          <Text accessibilityRole="header" {...TITLE_TEXT} style={[styles.h2, styles.recentTitle]}>
            Recent workouts
          </Text>
          {rows.map((row, index) => (
            <View key={row.key} testID={`progress-recent-${row.key}`} style={[styles.recentRow, index > 0 && styles.divider, reflow && styles.stackedRow]}>
              <View style={styles.recentMain}>
                <View style={styles.initialsTile} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <Text {...CAP_PILL} style={styles.initials}>
                    {workoutInitials(row.title)}
                  </Text>
                </View>
                <View style={styles.textColumn}>
                  <Text {...CAP_BODY} numberOfLines={2} style={styles.recentName}>
                    {row.title}
                  </Text>
                  <Text {...CAP_BODY} style={styles.caption}>
                    {row.meta}
                  </Text>
                </View>
              </View>
              {row.kind === 'missed' ? (
                <StatusPill testID={`progress-missed-${row.key}`} tone="warning" label="Missed" />
              ) : row.volume ? (
                <Text {...CAP_BODY} style={styles.volume}>
                  {row.volume}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: 12,
    paddingBottom: 20,
  },
  pageTablet: {
    gap: 16,
  },
  stackedRow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  column: {
    flexDirection: 'column',
  },
  columnGap: {
    gap: 16,
  },
  alignStart: {
    alignItems: 'flex-start',
  },
  flex1: {
    flex: 1,
    minWidth: 0,
  },
  shrink: {
    flexShrink: 1,
    minWidth: 0,
  },
  flexHistory: {
    flex: 1.4,
    minWidth: 0,
  },
  stretch: {
    alignSelf: 'stretch',
  },
  textColumn: {
    flex: 1,
    minWidth: 0,
  },
  spaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  spaceRowStart: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  mt6: { marginTop: 6 },
  mt10: { marginTop: 10 },
  mt12: { marginTop: 12 },
  mt14: { marginTop: 14 },
  mt16: { marginTop: 16 },
  round: {
    borderRadius: radii.full,
  },
  // Switch
  switch: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: 4,
    padding: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  switchTablet: {
    alignSelf: 'auto',
    width: 320,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: radii.full,
    paddingHorizontal: 12,
  },
  // P3-3: glass selected (white 0.12 = the hairlineButton value; no 0.12
  // fill token exists, value exact).
  segmentActive: {
    backgroundColor: colors.hairlineButton,
  },
  segmentOverlay: {
    borderRadius: radii.full,
  },
  inkOverlay: {
    backgroundColor: colors.pressOverlayInk,
  },
  whiteOverlay: {
    backgroundColor: colors.pressOverlay,
  },
  segmentText: {
    ...font(500),
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  segmentTextActive: {
    ...font(600),
    color: colors.textPrimary,
  },
  // Phone weight card
  weightCard: {
    borderRadius: radii.xxl,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  tileLabel: {
    ...typography.label,
    ...font(400),
    color: colors.textMuted,
  },
  currentPhone: {
    ...typography.displayLg,
    marginTop: 6,
    letterSpacing: -2.6,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  currentUnit: {
    ...font(600),
    fontSize: 20,
    letterSpacing: 0,
    color: colors.textFaint,
  },
  delta: {
    ...typography.label,
    ...font(400),
    marginTop: 8,
    color: colors.teal,
  },
  addIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
  },
  smallHeading: {
    ...font(600),
    fontSize: 13,
    lineHeight: 18,
    color: colors.textPrimary,
  },
  caption: {
    ...typography.caption,
    color: colors.textMuted,
  },
  // ND-10: "Goal {n}" 13/500 muted, tabular, never shrinks.
  perWeekGoal: {
    ...typography.label,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
    flexShrink: 0,
  },
  ranges: {
    flexDirection: 'row',
    marginTop: 12,
    padding: 3,
    borderRadius: radii.full,
    backgroundColor: colors.fillGlass,
  },
  // Batch 3 (e): the previous range's chart while the new one loads (web opacity-60).
  rangeLoading: {
    opacity: 0.6,
  },
  rangesWrap: {
    flexWrap: 'wrap',
  },
  rangeSegment: {
    flex: 1,
    minHeight: 32,
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: radii.full,
  },
  rangeActive: {
    backgroundColor: colors.hairlineButton,
  },
  rangeText: {
    ...font(500),
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  rangeTextActive: {
    ...font(600),
    color: colors.textPrimary,
  },
  // Tiles
  tile: {
    gap: 8,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    padding: 16,
  },
  tileValue: {
    ...font(700),
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -1.2,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  ringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  goalSmall: {
    ...font(700),
    fontSize: 20,
    lineHeight: 24,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  tealValue: {
    color: colors.teal,
  },
  emptyTitle: {
    ...font(600),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  miniBars: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  miniBar: {
    flex: 1,
    borderRadius: 4,
  },
  squares: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  square: {
    width: 14,
    height: 14,
    borderRadius: 3,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statTile: {
    gap: 6,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  statTilePhone: {
    flexBasis: '46%',
    flexGrow: 1,
  },
  statTileTablet: {
    flexBasis: '22%',
    flexGrow: 1,
  },
  statTileFull: {
    flexBasis: 'auto',
  },
  statValueTablet: {
    ...font(700),
    fontSize: 44,
    lineHeight: 44,
    letterSpacing: -1.76,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  // Cards
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  cardPhone: {
    padding: 16,
  },
  cardTablet: {
    borderRadius: radii.xxl,
    padding: 24,
  },
  flexCard: {
    flexGrow: 1,
  },
  h2: {
    ...font(600),
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  h2Tablet: {
    ...font(700),
    flexShrink: 1,
    fontSize: 21,
    lineHeight: 26,
    letterSpacing: -0.42,
    color: colors.textPrimary,
  },
  cardSub: {
    ...typography.label,
    ...font(400),
    marginTop: 4,
    color: colors.textMuted,
  },
  noLogs: {
    ...typography.bodySm,
    marginTop: 10,
    color: colors.textMuted,
  },
  logList: {
    gap: 8,
    marginTop: 12,
  },
  logRow: {
    borderRadius: radii.md,
    backgroundColor: colors.fillWell,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  logTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  logWeight: {
    ...font(600),
    fontSize: 15,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  logDate: {
    ...typography.label,
    ...font(400),
    color: colors.textMuted,
  },
  logNote: {
    ...font(400),
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  unitPill: {
    minHeight: 24,
    justifyContent: 'center',
    borderRadius: radii.full,
    backgroundColor: colors.fillSkeleton,
    paddingHorizontal: 10,
  },
  countPill: {
    minHeight: 26,
    justifyContent: 'center',
    borderRadius: radii.full,
    backgroundColor: colors.fillSkeleton,
    paddingHorizontal: 10,
  },
  unitPillText: {
    ...typography.caption,
    color: colors.textStrong2,
  },
  // Tablet Body
  goalCard: {
    borderRadius: radii.xxxl,
    padding: 26,
    alignItems: 'center',
    gap: 16,
  },
  goalLabelTablet: {
    ...typography.bodySm,
    alignSelf: 'flex-start',
    color: colors.textMuted,
  },
  goalValueTablet: {
    ...font(700),
    fontSize: 56,
    lineHeight: 60,
    letterSpacing: -2.8,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  currentTile: {
    borderRadius: radii.xxxl,
    padding: 26,
    justifyContent: 'flex-end',
  },
  currentTablet: {
    ...font(700),
    fontSize: 76,
    lineHeight: 74,
    letterSpacing: -4.56,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  currentUnitTablet: {
    ...font(600),
    fontSize: 24,
    letterSpacing: 0,
    color: colors.textFaint,
  },
  smallTile: {
    gap: 6,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    padding: 20,
  },
  // The board's gold 0.10 fill / 0.25 edge → gold-faint 0.08 / gold-line 0.30.
  toGoalTile: {
    backgroundColor: colors.goldFaint,
    borderColor: colors.goldLine,
  },
  smallValue: {
    ...font(700),
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -1.36,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  goldValue: {
    color: colors.gold,
  },
  historyCard: {
    borderRadius: radii.xxl,
    padding: 24,
  },
  // 12 weeks
  barRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginTop: 16,
  },
  barCell: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  bar: {
    width: '100%',
    borderRadius: 4,
  },
  // T-14 #28: stat labels 11 px minimum.
  barCount: {
    ...typography.micro,
    color: colors.textMuted,
  },
  // Recent workouts (phone, U8)
  recentCard: {
    overflow: 'hidden',
  },
  recentTitle: {
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  // The board's 0.06 → hairline 0.07.
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  recentMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  initialsTile: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.fillSkeleton,
  },
  initials: {
    ...font(700),
    fontSize: 14,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  recentName: {
    ...font(600),
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  volume: {
    ...font(400),
    fontSize: 14,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
    color: colors.textStrong2,
  },
});
