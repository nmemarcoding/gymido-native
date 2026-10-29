import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import ExerciseImage from '../../../../shared/components/ExerciseImage';
import { CAP_BODY, TITLE_TEXT } from '../../../../shared/components/largeText';
import StatusPill from '../../../../shared/components/StatusPill';
import { keepUnitsTogether } from '../../../../shared/format/counts';
import { colors, font, radii, spacing, textScale, titleTracking } from '../../../../shared/theme/tokens';
import { stripCells } from '../../../plans/libraryFormat';
import HubButton from './HubButton';
import { CalendarIcon, CheckIcon, MoonIcon, PlayIcon } from './HubIcons';

// T-76 today card, one per hub state (boards "Workout hub" + "Workout hub
// states"): training (gold edge, photos, the one gold "Start workout"), rest
// (moon, Up next, outlined "Start {day} early"), today done (teal tick,
// minutes, Up next, "View progress"), week complete ("THIS WEEK") and no
// schedule ("Set up your week" → the inline schedule setup, C2). T-102 +
// T-108: a rest day with an open miss is ONE card (`state` 'missed').
export default function HubTodayCard(props) {
  switch (props.state) {
    case 'missed':
      return <MissedCard {...props} />;
    case 'rest':
      return <RestCard {...props} />;
    case 'todayDone':
      return <TodayDoneCard {...props} />;
    case 'weekComplete':
      return <WeekCompleteCard {...props} />;
    case 'noSchedule':
      return <NoScheduleCard {...props} />;
    default:
      return <TrainingCard {...props} />;
  }
}

function Eyebrow({ children, color }) {
  return (
    <Text testID="workout-hero-eyebrow" {...CAP_BODY} style={[styles.eyebrow, { color }]}>
      {children}
    </Text>
  );
}

function TrainingCard({ weekdayName, title, meta, exercises, tablet, starting, onStart, style }) {
  return (
    <View testID="workout-hero" style={[styles.card, styles.goldEdge, style]}>
      <Eyebrow color={colors.gold}>{`TODAY · ${weekdayName.toUpperCase()}`}</Eyebrow>
      <Text accessibilityRole="header" {...TITLE_TEXT} style={[styles.title, tablet && styles.titleTablet]}>
        {title}
      </Text>
      <Text testID="workout-hero-meta" {...CAP_BODY} style={styles.body}>
        {meta}
      </Text>
      <PhotoStrip exercises={exercises} tablet={tablet} />
      <HubButton
        testID="workout-hero-start"
        title="Start workout"
        accessibilityLabel={`Start ${title}`}
        icon={({ color }) => <PlayIcon size={14} color={color} />}
        loading={starting}
        onPress={onStart}
        style={styles.action}
      />
    </View>
  );
}

// T-108 (UX ruling §1, replaces T-102 §2 items 1 + 4): the rest day's
// eyebrow, "! Missed", "You missed {Weekday}'s {title}" (34/38), the plan
// name, that day's photos, the gold "Do it now" (one tap, T-107) + the glass
// "View plan" (side by side from 21rem, else stacked), then a hairline and
// the quiet "Up next" footer with the text button "Start early" (hidden with
// no next day). No "Recovery is part of the plan…" line here (owner D1).
const STACK_BELOW_REM = 21;

function MissedCard({ weekdayName, miss, planName, exercises, tablet, reflow = false, starting, upNext, startingEarly, onDoItNow, onViewPlan, onStartEarly, style }) {
  const { fontScale } = useWindowDimensions();
  const [rowWidth, setRowWidth] = useState(0);
  const title = miss.planDay?.title || 'workout';
  const stacked = reflow || (rowWidth > 0 && rowWidth < STACK_BELOW_REM * 16 * Math.min(fontScale, textScale.body));
  return (
    <View testID="workout-hero" style={[styles.card, styles.goldEdge, style]}>
      <Eyebrow color={colors.textSecondary}>{`TODAY · ${weekdayName.toUpperCase()} · REST DAY`}</Eyebrow>
      <StatusPill testID="workout-missed-pill" tone="warning" label="Missed" style={styles.missedPill} />
      <Text
        testID="workout-missed-headline"
        accessibilityRole="header"
        {...TITLE_TEXT}
        // Wraps without a line cap (never truncates); Today's display cap
        // (1.3) so "Wednesday's" never breaks inside the word at large text.
        numberOfLines={undefined}
        maxFontSizeMultiplier={textScale.display}
        style={styles.missedTitle}
      >
        {`You missed ${miss.weekdayName}'s ${title}`}
      </Text>
      {planName ? (
        <Text testID="workout-missed-sub" {...CAP_BODY} style={styles.body}>
          {keepUnitsTogether(planName)}
        </Text>
      ) : null}
      <PhotoStrip exercises={exercises} tablet={tablet} />
      <View testID="workout-missed-actions" onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)} style={[styles.pair, stacked && styles.pairStacked]}>
        <HubButton
          testID="workout-missed-start"
          title="Do it now"
          accessibilityLabel={`Do it now: start ${title}`}
          icon={({ color }) => <PlayIcon size={14} color={color} />}
          loading={starting}
          onPress={onDoItNow}
          style={!stacked && styles.pairItem}
        />
        <HubButton testID="workout-missed-view-plan" variant="glass" title="View plan" onPress={onViewPlan} style={!stacked && styles.pairItem} />
      </View>
      {upNext ? <UpNextFooter upNext={upNext} reflow={reflow} starting={startingEarly} onStartEarly={onStartEarly} /> : null}
    </View>
  );
}

// T-108 §1.5 (amended: 2 lines): moon tile 32 · "Up next: {title}" / "{when} · n
// exercises" · "Start early" (15/600, no fill, 44 hit). Large text: it drops
// to its own line, left-aligned.
function UpNextFooter({ upNext, reflow, starting, onStartEarly }) {
  const earlyRef = useRef(null);
  return (
    <View testID="workout-missed-footer" style={[styles.footer, reflow && styles.footerWrap]}>
      <View style={styles.footerLead}>
        <View style={styles.footerTile}>
          <MoonIcon size={16} color={colors.textSecondary} />
        </View>
        <View testID="workout-up-next" accessible accessibilityLabel={`Up next: ${upNext.title}, ${upNext.meta}`} style={styles.flex}>
          <Text testID="workout-missed-footer-title" {...CAP_BODY} numberOfLines={2} ellipsizeMode="tail" style={styles.footerTitle}>
            {`Up next: ${upNext.title}`}
          </Text>
          <Text {...CAP_BODY} style={styles.footerMeta}>
            {upNext.meta}
          </Text>
        </View>
      </View>
      <Pressable
        ref={earlyRef}
        testID="workout-start-early"
        accessibilityRole="button"
        accessibilityLabel={`Start ${upNext.title} early`}
        accessibilityState={{ disabled: Boolean(starting), busy: Boolean(starting) }}
        disabled={Boolean(starting)}
        hitSlop={8}
        onPress={() => onStartEarly(upNext, earlyRef)}
        style={[styles.textButton, starting && styles.inactive]}
      >
        {({ pressed }) => (
          <Text {...CAP_BODY} style={[styles.textButtonLabel, pressed && styles.textButtonPressed]}>
            Start early
          </Text>
        )}
      </Pressable>
    </View>
  );
}

function RestCard({ weekdayName, upNext, upNextExercises, starting, onStartEarly, style }) {
  const earlyRef = useRef(null);
  return (
    <View testID="workout-hero" style={[styles.card, styles.restEdge, style]}>
      <View style={styles.restHead}>
        <View style={[styles.tile, styles.restTile]}>
          <MoonIcon size={22} color={colors.textSecondary} />
        </View>
        <View style={styles.flex}>
          <Eyebrow color={colors.textSecondary}>{`TODAY · ${weekdayName.toUpperCase()}`}</Eyebrow>
          <Text accessibilityRole="header" {...TITLE_TEXT} style={[styles.title, styles.titleTight]}>
            Rest day
          </Text>
        </View>
      </View>
      <Text {...CAP_BODY} style={[styles.body, styles.bodyGap]}>
        Recovery is part of the plan. Nothing is scheduled today.
      </Text>
      {upNext ? (
        <>
          <UpNextRow upNext={upNext} exercises={upNextExercises} />
          <HubButton
            ref={earlyRef}
            testID="workout-start-early"
            variant="outline"
            title={`Start ${upNext.title} early`}
            loading={starting}
            onPress={() => onStartEarly(upNext, earlyRef)}
            style={styles.actionOutline}
          />
        </>
      ) : null}
    </View>
  );
}

function TodayDoneCard({ weekdayName, title, detail, upNext, upNextExercises, onViewProgress, style }) {
  return (
    <View testID="workout-hero" style={[styles.card, styles.tealEdge, style]}>
      <Eyebrow color={colors.teal}>{`TODAY · ${weekdayName.toUpperCase()}`}</Eyebrow>
      <View style={styles.doneHead}>
        <View style={styles.tick}>
          <CheckIcon size={16} color={colors.onGold} strokeWidth={3.2} />
        </View>
        <Text accessibilityRole="header" {...TITLE_TEXT} style={[styles.title, styles.titleTight, styles.flex]}>
          {`${title} done`}
        </Text>
      </View>
      <Text testID="workout-hero-meta" {...CAP_BODY} style={styles.body}>
        {detail}
      </Text>
      {upNext ? <UpNextRow upNext={upNext} exercises={upNextExercises} /> : null}
      <HubButton testID="workout-view-progress" variant="outline" title="View progress" onPress={onViewProgress} style={styles.actionOutline} />
    </View>
  );
}

function WeekCompleteCard({ detail, onViewProgress, style }) {
  return (
    <View testID="workout-hero" style={[styles.card, styles.tealEdge, style]}>
      <Eyebrow color={colors.teal}>THIS WEEK</Eyebrow>
      <Text accessibilityRole="header" {...TITLE_TEXT} style={styles.title}>
        Week complete
      </Text>
      <Text testID="workout-hero-meta" {...CAP_BODY} style={styles.body}>
        {detail}
      </Text>
      <HubButton testID="workout-view-progress" variant="outline" title="View progress" onPress={onViewProgress} style={styles.actionGap} />
    </View>
  );
}

function NoScheduleCard({ onChooseDays, chooseRef, style }) {
  return (
    <View testID="workout-hero" style={[styles.card, styles.goldEdge, style]}>
      <View style={[styles.tile, styles.goldTile]}>
        <CalendarIcon size={22} color={colors.gold} />
      </View>
      <Text accessibilityRole="header" {...TITLE_TEXT} style={styles.setupTitle}>
        Set up your week
      </Text>
      <Text {...CAP_BODY} style={styles.body}>
        Choose the days you train. We will put each workout on a day and show you what is next.
      </Text>
      <View ref={chooseRef} collapsable={false} style={styles.actionGap}>
        <HubButton testID="schedule-setup-open" title="Choose training days" onPress={onChooseDays} />
      </View>
    </View>
  );
}

// "Up next": the day's first photo, "Up next", "{day} · {when · n exercises}".
function UpNextRow({ upNext, exercises }) {
  const first = exercises?.[0]?.exercise;
  return (
    <View testID="workout-up-next" accessible accessibilityLabel={`Up next: ${upNext.title}, ${upNext.meta}`} style={styles.upNext}>
      <ExerciseImage
        testID="workout-up-next-photo"
        exercise={first ?? null}
        name={first ? undefined : upNext.title}
        loading={exercises === undefined}
        size={48}
        style={styles.upNextPhoto}
      />
      <View style={styles.flex}>
        <Text {...CAP_BODY} style={styles.upNextLabel}>
          Up next
        </Text>
        <Text {...CAP_BODY} style={styles.upNextTitle}>
          {`${upNext.title} · `}
          <Text style={styles.upNextMeta}>{upNext.meta}</Text>
        </Text>
      </View>
    </View>
  );
}

// Phone: up to 4 cells, the 4th dimmed with "+n" and "more" past 4
// exercises; tablet: every exercise, 6 to a row. Captions 13/18 (N1).
function PhotoStrip({ exercises, tablet }) {
  const [width, setWidth] = useState(0);
  const columns = tablet ? 6 : 4;
  const gap = 8;
  const cellWidth = width > 0 ? (width - gap * (columns - 1)) / columns : 0;
  const cells = exercises === undefined ? null : tablet ? exercises.map((item) => ({ item, more: 0 })) : stripCells(exercises);
  if (cells && cells.length === 0) {
    return null;
  }
  return (
    <View
      testID="workout-hero-photos"
      accessibilityLabel="Exercises in this workout"
      style={styles.strip}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {cellWidth > 0
        ? (cells ?? Array.from({ length: columns }, () => null)).map((cell, index) => (
            <View key={cell?.item?.id ?? index} style={[styles.stripCell, { width: cellWidth }]}>
              {cell ? <StripCell cell={cell} /> : <ExerciseImage testID="workout-hero-photo" loading size={64} style={styles.stripPhoto} />}
            </View>
          ))
        : null}
    </View>
  );
}

function StripCell({ cell }) {
  const exercise = cell.item.exercise;
  if (cell.more) {
    return (
      <>
        <View testID="workout-hero-more" accessible accessibilityLabel={`${exercise?.name ?? 'Exercise'} and ${cell.more - 1} more`} style={styles.stripPhoto}>
          <ExerciseImage testID="workout-hero-photo" exercise={exercise} size={64} style={[styles.stripPhoto, styles.dim]} />
          <View style={[StyleSheet.absoluteFill, styles.moreBox]}>
            <Text {...CAP_BODY} style={styles.moreCount}>{`+${cell.more}`}</Text>
          </View>
        </View>
        <Text {...CAP_BODY} numberOfLines={1} style={styles.caption}>
          more
        </Text>
      </>
    );
  }
  return (
    <>
      <ExerciseImage testID="workout-hero-photo" exercise={exercise} size={64} style={styles.stripPhoto} />
      <Text {...CAP_BODY} numberOfLines={1} style={styles.caption}>
        {exercise?.name ?? ''}
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xxl,
    padding: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
  },
  // N3: the gold edge on the alpha ladder (0.30).
  goldEdge: { borderColor: colors.goldLine },
  tealEdge: { borderColor: colors.tealLine },
  restEdge: { borderColor: colors.hairlineStrong },
  flex: { flex: 1, minWidth: 0 },
  eyebrow: {
    ...font(700),
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: titleTracking(13, 0.04),
  },
  title: {
    ...font(700),
    marginTop: 6,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: titleTracking(32, -0.04),
    color: colors.textPrimary,
  },
  // RN-SPEC T-76: the day title is 32/36 on phone, 36/40 on tablet.
  titleTablet: { fontSize: 36, lineHeight: 40, letterSpacing: titleTracking(36, -0.04) },
  titleTight: { marginTop: 4 },
  setupTitle: {
    ...font(700),
    marginTop: 14,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: titleTracking(28, -0.03),
    color: colors.textPrimary,
  },
  body: {
    ...font(400),
    marginTop: 4,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  bodyGap: { marginTop: 12 },
  missedPill: { marginTop: 10, alignSelf: 'flex-start' },
  missedTitle: {
    ...font(700),
    marginTop: 10,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: titleTracking(34, -0.04),
    color: colors.textPrimary,
  },
  pair: { marginTop: 18, flexDirection: 'row', gap: 10 },
  pairStacked: { flexDirection: 'column' },
  pairItem: { flex: 1, minWidth: 0 },
  footer: {
    marginTop: 16,
    paddingTop: 14,
    minHeight: 56,
    borderTopWidth: 1,
    borderTopColor: colors.fillButton,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  footerWrap: { flexDirection: 'column', alignItems: 'flex-start' },
  footerLead: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch' },
  footerTile: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.hairline },
  footerTitle: { ...font(600), fontSize: 15, lineHeight: 20, color: colors.textPrimary },
  footerMeta: { ...font(400), fontSize: 13, lineHeight: 18, color: colors.textMuted },
  textButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  textButtonLabel: { ...font(600), fontSize: 15, lineHeight: 20, color: colors.textPrimary },
  textButtonPressed: { opacity: 0.7 },
  inactive: { opacity: 0.5 },
  action: { marginTop: 18 },
  actionOutline: { marginTop: 14 },
  actionGap: { marginTop: 16 },
  restHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  tile: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restTile: { backgroundColor: colors.fillButton },
  goldTile: { backgroundColor: colors.goldTint },
  doneHead: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 10 },
  tick: {
    width: 34,
    height: 34,
    borderRadius: radii.full,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upNext: {
    marginTop: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 18,
    backgroundColor: colors.surfaceSunk,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  upNextPhoto: { width: 48, height: 48, borderRadius: 12 },
  upNextLabel: { ...font(400), fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  upNextTitle: { ...font(600), fontSize: 16, lineHeight: 22, color: colors.textPrimary },
  upNextMeta: { ...font(500), color: colors.textSecondary },
  strip: { marginTop: spacing[4], flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stripCell: { gap: 6 },
  stripPhoto: { width: '100%', height: 64, borderRadius: 14 },
  dim: { opacity: 0.4 },
  moreBox: { alignItems: 'center', justifyContent: 'center' },
  moreCount: { ...font(700), fontSize: 16, lineHeight: 20, color: colors.textPrimary },
  caption: { ...font(400), fontSize: 13, lineHeight: 18, color: colors.textSecondary },
});
