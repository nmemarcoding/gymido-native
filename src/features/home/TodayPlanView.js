import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { CardSurface } from '../../shared/components/Card';
import EmptyState from '../../shared/components/EmptyState';
import ExerciseImage from '../../shared/components/ExerciseImage';
import GradientFill from '../../shared/components/GradientFill';
import RemoteImage from '../../shared/components/RemoteImage';
import StatusPill from '../../shared/components/StatusPill';
import TextLink from '../../shared/components/TextLink';
import { colors, font, gradients, radii, shadows, spacing, typography } from '../../shared/theme/tokens';
import ProgressRing from '../workout/components/ProgressRing';
import { exerciseCountText, workoutInitials } from './homeFormat';
import { LARGE_TEXT as LT } from './TodayStates';
import { keepUnitsTogether } from '../../shared/format/counts';

// v2 Phase 3 §2 Today (UX E-today: phone "Today", "Tablet: Today"): the
// loaded Today with an active plan. Look only, except the approved U1 "Your
// week" strip and ND3 "Day n of N" (tablet). Every v1 block stays (ND5): the
// weight card, "Last workout {date}" and Recent workouts.

const PILL_TONE = { brand: 'gold', success: 'completed', warning: 'warning', muted: 'neutral' };

function ArrowIcon({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12h14M13 6l6 6-6 6" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CheckIcon({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12l5 5L20 7" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// The Today-card primary (UX E): gold pill, label left, a ground disc with a
// gold arrow on the right. Pressed = the gold + an ink 4 % overlay (§8.6).
export function DiscButton({ testID, label, onPress, tablet, stacked, accessibilityLabel }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={[styles.primary, tablet && styles.primaryTablet, stacked && styles.buttonStacked]}
    >
      {({ pressed }) => (
        <>
          {pressed ? <View testID={`${testID}-pressed`} pointerEvents="none" style={[StyleSheet.absoluteFill, styles.inkOverlay]} /> : null}
          <Text {...LT.body} style={[styles.primaryText, tablet && styles.primaryTextTablet]}>
            {label}
          </Text>
          <View style={[styles.disc, tablet && styles.discTablet]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <ArrowIcon size={18} color={colors.gold} />
          </View>
        </>
      )}
    </Pressable>
  );
}

// Glass secondary at the board's heights (58 / 60 / 46): fill-glass 0.08 +
// hairline-button edge; pressed = + a white 4 % overlay (§8.6).
export function GlassButton({ testID, label, onPress, height = 58, textStyle, style, accessibilityLabel }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={[styles.glass, { minHeight: height }, style]}
    >
      {({ pressed }) => (
        <>
          {pressed ? <View testID={`${testID}-pressed`} pointerEvents="none" style={[StyleSheet.absoluteFill, styles.whiteOverlay]} /> : null}
          <Text {...LT.body} style={[styles.glassText, textStyle]}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

// The Today hero (all five card states). Phone: the faint photo layer on
// the right (today_status.image.url) under a surface fade, else the glow
// only. Tablet: no photo, the 76 headline and "Day n of N" (training only).
// Batch 2 item 4 (web ≥1024 parity): the tablet hero's right media half is
// the photo, else (photo failed) the workout-icon tile, else the neutral
// initials tile of the day title (`dayTitle`), else nothing (plain gradient).
export function TodayHero({ plan, card, tablet, reflow, imageUrl, dayTitle, dayOfWeek, exerciseCount = null, onPrimary, onViewPlan }) {
  // Fixed at mount: the fade gradient never appears on a later change
  // (Android render rule).
  const [photo] = useState(() => (tablet ? null : imageUrl));
  const [media] = useState(() => (tablet && (imageUrl || dayTitle) ? { url: imageUrl || null, name: dayTitle || '' } : null));
  const [longMissed, setLongMissed] = useState(false);
  const missedLong = card.state === 'missed' && longMissed;
  const countText = card.sub ? null : exerciseCountText(exerciseCount);
  return (
    <CardSurface hero testID="home-today-card" style={[styles.hero, tablet && styles.heroTablet]}>
      {photo ? (
        <View testID="home-today-photo" pointerEvents="none" style={styles.photo} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <RemoteImage url={photo} style={[StyleSheet.absoluteFill, styles.photoImage]} />
          <GradientFill angle={90} colors={[gradients.surfaceFade.colors[1], gradients.surfaceFade.colors[0]]} stops={[0, 0.6]} />
        </View>
      ) : null}
      {media ? (
        <View testID="home-today-media" pointerEvents="none" style={styles.media} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <ExerciseImage testID="home-today-media-image" url={media.url} name={media.name} muscleCode={null} style={[StyleSheet.absoluteFill, styles.mediaImage]} />
          <GradientFill angle={90} colors={[gradients.surfaceFade.colors[1], gradients.surfaceFade.colors[0]]} stops={[0, 0.6]} />
        </View>
      ) : null}
      <View pointerEvents="none" style={tablet ? styles.glowTablet : styles.glow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <GradientFill radial={gradients.heroGlow.radial} colors={gradients.heroGlow.colors} stops={[0, 0.7]} />
      </View>
      <View style={[styles.pillRow, reflow && styles.trailingBelow]}>
        <StatusPill testID="home-today-pill" tone={PILL_TONE[card.tone] ?? 'neutral'} label={card.pill} />
        {tablet && dayOfWeek && card.state === 'training' ? (
          <Text testID="home-day-of-week" {...LT.body} style={styles.dayOfWeek}>
            {dayOfWeek}
          </Text>
        ) : null}
      </View>
      <Text
        testID="home-today-headline"
        accessibilityRole="header"
        {...LT.display}
        onTextLayout={(event) => {
          if (!longMissed && event?.nativeEvent?.lines?.length > 2) {
            setLongMissed(true);
          }
        }}
        style={[tablet ? styles.headlineTablet : styles.headline, missedLong && styles.headlineLong]}
      >
        {card.headline}
      </Text>
      {countText ? (
        // ND4: the plan name truncates; " · n exercises" never does.
        <View
          testID="home-today-sub"
          accessible
          accessibilityLabel={`${plan.name}${countText}`}
          style={[styles.subRow, tablet ? styles.subRowTablet : styles.subRowPhone, reflow && styles.subRowWrap]}
        >
          <Text
            testID="home-today-sub-plan"
            {...LT.body}
            numberOfLines={reflow ? undefined : 1}
            ellipsizeMode="tail"
            style={[tablet ? styles.subTablet : styles.sub, styles.subInRow, styles.subName]}
          >
            {keepUnitsTogether(plan.name)}
          </Text>
          <Text testID="home-today-sub-count" {...LT.body} numberOfLines={1} textBreakStrategy="simple" style={[tablet ? styles.subTablet : styles.sub, styles.subInRow, styles.subCount]}>
            {countText}
          </Text>
        </View>
      ) : (
        <Text testID="home-today-sub" {...LT.body} numberOfLines={2} ellipsizeMode="tail" style={tablet ? styles.subTablet : styles.sub}>
          {card.sub ?? keepUnitsTogether(plan.name)}
        </Text>
      )}
      {card.moreMissed ? (
        <Text testID="home-more-missed" {...LT.body} style={styles.moreMissed}>
          {card.moreMissed}
        </Text>
      ) : null}
      {/* §9: past 1.3 the pair stacks, primary on top, both full width. */}
      <View testID="home-today-buttons" style={[styles.buttons, tablet && styles.buttonsTablet, reflow && styles.buttonsStacked]}>
        <DiscButton testID="home-today-primary" label={card.primary} tablet={tablet} stacked={reflow} onPress={onPrimary} />
        <GlassButton
          testID="home-view-plan"
          label="View plan"
          height={tablet ? 60 : 58}
          onPress={onViewPlan}
          textStyle={tablet ? styles.viewPlanTextTablet : null}
          style={[styles.viewPlan, tablet && styles.viewPlanTablet, reflow && styles.buttonStacked]}
        />
      </View>
    </CardSurface>
  );
}

// ND8 stat tiles: the This-week ring tile ("{done} done · {planned}
// planned") and Done total with "Last workout {date}" in teal.
export function TodayStats({ ring, tablet, reflow }) {
  const size = tablet ? 96 : 64;
  const stroke = tablet ? 7 : 8;
  return (
    <View testID="home-stats" style={[styles.tiles, reflow && styles.tilesStacked]}>
      <View
        testID="home-stat-this-week"
        accessible
        accessibilityLabel={`This week ${ring.thisWeekText} ${ring.plannedText} Planned`}
        style={[styles.tile, tablet && styles.tileTablet, reflow && styles.flat]}
      >
        <Text {...LT.body} style={tablet ? styles.tileLabelTablet : styles.tileLabel}>
          This week
        </Text>
        <View testID="home-stat-this-week-row" style={[styles.ringRow, tablet && styles.ringRowTablet, reflow && styles.ringRowStacked]}>
          <ProgressRing flat value={ring.thisWeek} total={ring.planned} size={size} thickness={(stroke * 100) / size} label={ring.ringLabel} />
          <Text {...LT.number} style={tablet ? styles.numberTablet : styles.number}>
            {ring.thisWeekText}
            <Text style={tablet ? styles.denominatorTablet : styles.denominator}>{ring.plannedText}</Text>
          </Text>
        </View>
        {tablet ? null : (
          <Text testID="home-stat-caption" {...LT.body} style={styles.ringCaption}>
            {ring.caption}
          </Text>
        )}
      </View>
      <View
        testID="home-stat-done"
        accessible
        accessibilityLabel={`Done total ${ring.doneTotalText}${ring.lastWorkout ? `, ${ring.lastWorkout}` : ''}`}
        style={[styles.tile, styles.doneTile, tablet && styles.tileTablet, reflow && styles.flat]}
      >
        <Text {...LT.body} style={tablet ? styles.tileLabelTablet : styles.tileLabel}>
          Done total
        </Text>
        <View>
          <Text {...LT.number} style={tablet ? styles.doneNumberTablet : styles.doneNumber}>
            {ring.doneTotalText}
          </Text>
          {ring.lastWorkout ? (
            <Text testID="home-last-workout" {...LT.body} style={tablet ? styles.lastWorkoutTablet : styles.lastWorkout}>
              {ring.lastWorkout}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function WeekCell({ cell, tablet }) {
  const done = cell.status === 'done';
  const today = cell.status === 'today';
  const missed = cell.status === 'missed';
  const rest = cell.status === 'rest';
  return (
    <View style={[styles.weekColumn, tablet && styles.weekColumnTablet]}>
      <Text {...LT.body} style={[tablet ? styles.weekLetterTablet : styles.weekLetter, cell.isToday && styles.weekLetterToday]}>
        {tablet ? cell.short : cell.letter}
      </Text>
      <View
        testID={`home-week-cell-${cell.key}`}
        accessible
        accessibilityLabel={cell.label}
        style={[
          styles.cell,
          tablet && styles.cellTablet,
          done && styles.cellDone,
          today && styles.cellToday,
          (missed || cell.status === 'upcoming') && (tablet ? styles.cellPlannedTablet : styles.cellPlanned),
          rest && styles.cellRest,
        ]}
      >
        {done ? <CheckIcon size={tablet ? 18 : 15} color={colors.onGold} /> : null}
        {today ? <View style={[styles.cellDot, tablet && styles.cellDotTablet, styles.cellDotGold]} /> : null}
        {missed ? <View testID="home-week-missed-dot" style={[styles.cellDot, styles.cellDotWarning]} /> : null}
      </View>
    </View>
  );
}

// U1 "Your week" (ND1, PM approved): 7 display-only cells (not tappable).
export function WeekCard({ strip, tablet, reflow, onSeeProgress }) {
  return (
    <View testID="home-week" style={[styles.card, styles.weekCard, tablet && styles.weekCardTablet]}>
      <View style={[styles.cardHeader, reflow && styles.trailingBelow]}>
        <Text accessibilityRole="header" {...LT.title} style={tablet ? styles.cardTitleTablet : styles.cardTitle}>
          Your week
        </Text>
        {tablet ? (
          <Pressable testID="home-week-see-progress" accessibilityRole="link" onPress={onSeeProgress} style={styles.mutedLink}>
            <Text {...LT.body} style={styles.mutedLinkText}>
              See progress
            </Text>
          </Pressable>
        ) : strip.trainingDays ? (
          <Text testID="home-week-days" {...LT.body} style={styles.weekDays}>
            {strip.trainingDays}
          </Text>
        ) : null}
      </View>
      <View testID="home-week-strip" style={[styles.weekStrip, tablet && styles.weekStripTablet]}>
        {strip.cells.map((cell) => (
          <WeekCell key={cell.key} cell={cell} tablet={tablet} />
        ))}
      </View>
    </View>
  );
}

// Weight card (H1.5): Current / Goal / To goal, "See progress" (44) and the
// glass "Add weight log" (46; the Today card holds the one gold action).
export function WeightCard({ hasData, weightValues, tablet, reflow, onSeeProgress, onAddWeight }) {
  return (
    <View testID="home-weight" style={[styles.card, styles.weightCard, tablet && styles.weightCardTablet]}>
      <View testID="home-weight-header" style={[styles.cardHeader, reflow && styles.trailingBelow]}>
        <Text {...LT.title} style={tablet ? styles.cardTitleTablet : styles.cardTitle}>
          Weight
        </Text>
        <TextLink testID="home-see-progress" label="See progress" onPress={onSeeProgress} />
      </View>
      {hasData ? (
        weightValues
      ) : (
        <Text {...LT.body} style={styles.noWeightText}>
          Log today's weight to start tracking your trend.
        </Text>
      )}
      <GlassButton testID="home-add-weight" label="Add weight log" height={46} onPress={onAddWeight} textStyle={styles.addWeightText} style={styles.addWeight} />
    </View>
  );
}

// Splits "82.1 kg" into the big value and its unit; "—" has no unit.
function splitUnit(text) {
  const match = /^(.*\S)\s+([^\s\d]+)$/.exec(String(text ?? ''));
  return match ? { value: match[1], unit: match[2] } : { value: String(text ?? ''), unit: '' };
}

// The weight values row (board: 1.3fr 1fr 1fr, Current big + unit faint,
// Goal, To goal teal); past 1.3 the label → value rows (StatRow).
export function WeightValues({ weight, reflow, StatRow }) {
  const items = [
    ['Current', weight.current],
    ['Goal', weight.goal],
    ['To goal', weight.toGoal],
  ];
  if (reflow) {
    return (
      <View testID="home-weight-values" style={[styles.weightValues, styles.weightValuesStacked]}>
        {items.map(([label, value], index) => (
          <StatRow key={label} label={label} value={value} first={index === 0} valueStyle={styles.weightRowValue} />
        ))}
      </View>
    );
  }
  const current = splitUnit(weight.current);
  return (
    <View testID="home-weight-values" style={styles.weightValues}>
      <View style={styles.weightCurrent}>
        <Text {...LT.number} numberOfLines={1} textBreakStrategy="simple" style={styles.weightBig}>
          {current.value}
          {current.unit ? <Text style={styles.weightUnit}>{` ${current.unit}`}</Text> : null}
        </Text>
        <Text {...LT.body} style={styles.weightLabel}>
          Current
        </Text>
      </View>
      {items.slice(1).map(([label, value]) => (
        <View key={label} style={styles.weightItem}>
          <Text {...LT.number} numberOfLines={1} textBreakStrategy="simple" style={[styles.weightSmall, label === 'To goal' && styles.weightTeal]}>
            {value}
          </Text>
          <Text {...LT.body} style={styles.weightLabel}>
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}

// Recent workouts (H1.6, ND6): a NEUTRAL initials tile, title, the meta
// line and the raw-status pill (⚠H-7: always the success tone). No sets.
export function RecentWorkouts({ recent, metaOf, tablet, reflow }) {
  if (recent.length === 0) {
    return (
      <View>
        <Text accessibilityRole="header" {...LT.title} style={[styles.cardTitle, styles.recentHeading]}>
          Recent workouts
        </Text>
        <EmptyState title="No completed workouts yet" message="Once you finish a workout, it will show up here." />
      </View>
    );
  }
  return (
    <View testID="home-recent" style={[styles.card, styles.recentCard, tablet && styles.recentCardTablet]}>
      <Text accessibilityRole="header" {...LT.title} style={[tablet ? styles.cardTitleTablet : styles.cardTitle, styles.recentTitlePad, tablet && styles.recentTitlePadTablet]}>
        Recent workouts
      </Text>
      {recent.map((workout, index) => {
        const title = workout.workout_plan_day?.title || 'Workout session';
        return (
          <View
            key={workout.id ?? index}
            testID={`home-recent-${workout.id ?? index}`}
            style={[styles.recentRow, tablet && styles.recentRowTablet, index > 0 && styles.recentDivider, reflow && styles.trailingBelow]}
          >
            <View style={styles.recentMain}>
              <View testID="home-recent-tile" style={[styles.recentTile, tablet && styles.recentTileTablet]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Text {...LT.badge} style={styles.recentInitials}>
                  {workoutInitials(title)}
                </Text>
              </View>
              {/* §9: names may ellipsize in a dense list, 2 lines max. */}
              <View style={styles.recentText}>
                <Text testID="home-recent-title" {...LT.body} numberOfLines={2} style={tablet ? styles.recentNameTablet : styles.recentName}>
                  {title}
                </Text>
                <Text {...LT.body} numberOfLines={2} style={tablet ? styles.recentMetaTablet : styles.recentMeta}>
                  {metaOf(workout)}
                </Text>
              </View>
            </View>
            <StatusPill tone="completed" label={workout.status} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Hero
  hero: {
    borderRadius: radii.xxl,
    padding: spacing['5_5'],
  },
  heroTablet: {
    borderRadius: radii.xxxl,
    padding: spacing[8],
  },
  photo: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '58%',
  },
  media: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '50%',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
    borderRadius: 0,
    opacity: 0.5,
  },
  photoImage: {
    opacity: 0.35,
  },
  glow: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 220,
    height: 220,
  },
  glowTablet: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 340,
    height: 340,
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  dayOfWeek: {
    ...typography.bodySm,
    color: colors.textMuted,
  },
  headline: {
    ...typography.displayLg,
    marginTop: spacing[7],
    color: colors.textPrimary,
  },
  headlineTablet: {
    ...font(700),
    marginTop: 40,
    fontSize: 76,
    lineHeight: 76,
    letterSpacing: -3.8,
    color: colors.textPrimary,
  },
  // UX E missed: past 2 lines the headline drops to 34/38.
  headlineLong: {
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -1.36,
  },
  sub: {
    ...typography.body,
    marginTop: spacing[2],
    color: colors.textSecondary,
  },
  subTablet: {
    ...font(400),
    marginTop: spacing['2_5'],
    fontSize: 17,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  // ND4: the sub-line as a row; the row carries the margin of the Text.
  subRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  subRowPhone: {
    marginTop: spacing[2],
  },
  subRowTablet: {
    marginTop: spacing['2_5'],
  },
  subRowWrap: {
    flexWrap: 'wrap',
  },
  subInRow: {
    marginTop: 0,
  },
  subName: {
    flexShrink: 1,
    minWidth: 0,
  },
  subCount: {
    flexShrink: 0,
  },
  moreMissed: {
    ...font(600),
    marginTop: spacing['1_5'],
    fontSize: 14,
    lineHeight: 20,
    color: colors.warning,
  },
  buttons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['2_5'],
    marginTop: 26,
  },
  buttonsTablet: {
    gap: spacing[3],
    marginTop: spacing[8],
    maxWidth: 480,
  },
  buttonsStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
    maxWidth: undefined,
  },
  buttonStacked: {
    flex: 0,
    alignSelf: 'stretch',
  },
  primary: {
    flex: 1,
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    overflow: 'hidden',
    borderRadius: radii.full,
    backgroundColor: colors.gold,
    boxShadow: shadows.goldGlow,
    paddingLeft: spacing['5_5'],
    paddingRight: spacing[2],
    paddingVertical: spacing[2],
  },
  primaryTablet: {
    minHeight: 60,
    paddingLeft: spacing[6],
    boxShadow: shadows.goldGlowLarge,
  },
  primaryText: {
    ...font(600),
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
    color: colors.onGold,
  },
  primaryTextTablet: {
    fontSize: 18,
    lineHeight: 24,
  },
  disc: {
    width: 42,
    height: 42,
    borderRadius: radii.full,
    backgroundColor: colors.ground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discTablet: {
    width: 44,
    height: 44,
  },
  inkOverlay: {
    backgroundColor: colors.pressOverlayInk,
  },
  whiteOverlay: {
    backgroundColor: colors.pressOverlay,
  },
  glass: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.hairlineButton,
    backgroundColor: colors.fillGlass,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing['1_5'],
  },
  glassText: {
    ...font(600),
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
    color: colors.textPrimary,
  },
  viewPlan: {
    flexShrink: 0,
  },
  viewPlanTablet: {
    paddingHorizontal: spacing[6],
  },
  viewPlanTextTablet: {
    fontSize: 16,
  },
  trailingBelow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  // Stat tiles
  tiles: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  tilesStacked: {
    flexDirection: 'column',
  },
  tile: {
    flex: 1,
    minWidth: 0,
    gap: spacing['3_5'],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    padding: spacing['4_5'],
  },
  tileTablet: {
    gap: spacing['4_5'],
    borderRadius: radii.xxl,
    padding: spacing[6],
  },
  flat: {
    flex: 0,
  },
  doneTile: {
    justifyContent: 'space-between',
  },
  tileLabel: {
    ...typography.label,
    ...font(400),
    color: colors.textMuted,
  },
  tileLabelTablet: {
    ...typography.bodySm,
    color: colors.textMuted,
  },
  ringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['3_5'],
  },
  ringRowTablet: {
    gap: spacing[5],
  },
  ringRowStacked: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  number: {
    ...font(700),
    fontSize: 34,
    lineHeight: 36,
    letterSpacing: -1.36,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  numberTablet: {
    ...font(700),
    fontSize: 52,
    lineHeight: 52,
    letterSpacing: -2.6,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  denominator: {
    ...font(600),
    fontSize: 18,
    letterSpacing: 0,
    color: colors.textFaint,
  },
  denominatorTablet: {
    ...font(600),
    fontSize: 24,
    letterSpacing: 0,
    color: colors.textFaint,
  },
  ringCaption: {
    ...typography.caption,
    marginTop: -6,
    color: colors.textMuted,
  },
  doneNumber: {
    ...typography.displayMd,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  doneNumberTablet: {
    ...font(700),
    fontSize: 68,
    lineHeight: 68,
    letterSpacing: -3.4,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  lastWorkout: {
    ...typography.caption,
    marginTop: spacing['1_5'],
    color: colors.teal,
  },
  lastWorkoutTablet: {
    ...typography.bodySm,
    marginTop: spacing[2],
    color: colors.teal,
  },
  // Cards
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  cardTitle: {
    ...font(600),
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  cardTitleTablet: {
    ...font(600),
    fontSize: 17,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  mutedLink: {
    minHeight: 44,
    justifyContent: 'center',
  },
  mutedLinkText: {
    ...typography.bodySm,
    color: colors.textMuted,
  },
  // Your week
  weekCard: {
    paddingVertical: spacing[4],
    paddingHorizontal: spacing['4_5'],
  },
  weekCardTablet: {
    borderRadius: radii.xxl,
    paddingVertical: spacing['5_5'],
    paddingHorizontal: spacing[6],
  },
  weekDays: {
    ...typography.label,
    ...font(400),
    flexShrink: 1,
    textAlign: 'right',
    color: colors.textMuted,
  },
  weekStrip: {
    flexDirection: 'row',
    gap: spacing['1_5'],
    marginTop: spacing[3],
  },
  weekStripTablet: {
    gap: spacing['2_5'],
  },
  weekColumn: {
    flex: 1,
    alignItems: 'center',
    gap: spacing[2],
  },
  weekColumnTablet: {
    gap: spacing['2_5'],
  },
  weekLetter: {
    ...typography.caption,
    color: colors.textFaint,
  },
  weekLetterTablet: {
    ...font(400),
    fontSize: 13,
    lineHeight: 18,
    color: colors.textFaint,
  },
  weekLetterToday: {
    ...font(600),
    color: colors.gold,
  },
  cell: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellTablet: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
  },
  cellDone: {
    backgroundColor: colors.gold,
  },
  cellToday: {
    borderWidth: 2,
    borderColor: colors.gold,
  },
  cellPlanned: {
    backgroundColor: colors.track,
  },
  cellPlannedTablet: {
    backgroundColor: colors.fillWell,
  },
  // The board's dashed 0.14 → hairline-strong (UX §8.5 white ladder).
  cellRest: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.hairlineStrong,
  },
  cellDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  cellDotTablet: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cellDotGold: {
    backgroundColor: colors.gold,
  },
  cellDotWarning: {
    backgroundColor: colors.warning,
  },
  // Weight
  weightCard: {
    padding: spacing['4_5'],
  },
  weightCardTablet: {
    borderRadius: radii.xxl,
    padding: spacing[6],
  },
  weightValues: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[2],
    marginTop: spacing['2_5'],
  },
  weightValuesStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 0,
  },
  weightCurrent: {
    flex: 1.3,
    minWidth: 0,
  },
  weightItem: {
    flex: 1,
    minWidth: 0,
  },
  weightBig: {
    ...font(700),
    fontSize: 38,
    lineHeight: 40,
    letterSpacing: -1.9,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  weightUnit: {
    ...font(600),
    fontSize: 15,
    letterSpacing: 0,
    color: colors.textFaint,
  },
  weightSmall: {
    ...font(700),
    fontSize: 20,
    lineHeight: 24,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  weightTeal: {
    color: colors.teal,
  },
  weightLabel: {
    ...typography.caption,
    marginTop: spacing[1],
    color: colors.textMuted,
  },
  weightRowValue: {
    ...font(700),
    fontSize: 20,
    lineHeight: 24,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  noWeightText: {
    ...typography.label,
    ...font(400),
    marginTop: spacing[1],
    color: colors.textSecondary,
  },
  addWeight: {
    marginTop: spacing['3_5'],
    alignSelf: 'stretch',
  },
  addWeightText: {
    fontSize: 14,
  },
  // Recent workouts
  recentHeading: {
    marginBottom: spacing[3],
    paddingHorizontal: spacing[1],
  },
  recentCard: {
    overflow: 'hidden',
  },
  recentCardTablet: {
    borderRadius: radii.xxl,
  },
  recentTitlePad: {
    paddingTop: spacing['3_5'],
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[1],
  },
  recentTitlePadTablet: {
    paddingTop: spacing[5],
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[2],
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  recentRowTablet: {
    gap: spacing['3_5'],
    paddingVertical: spacing['3_5'],
    paddingHorizontal: spacing[6],
  },
  // The board's 0.06 separators → hairline 0.07.
  recentDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  recentMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  recentTile: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.fillSkeleton,
  },
  recentTileTablet: {
    width: 44,
    height: 44,
    borderRadius: 14,
  },
  recentInitials: {
    ...font(700),
    fontSize: 14,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  recentText: {
    flex: 1,
    minWidth: 0,
  },
  recentName: {
    ...font(600),
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  recentNameTablet: {
    ...font(600),
    fontSize: 16,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  recentMeta: {
    ...typography.label,
    ...font(400),
    fontVariant: ['tabular-nums'],
    color: colors.textMuted,
  },
  recentMetaTablet: {
    ...typography.bodySm,
    fontVariant: ['tabular-nums'],
    color: colors.textMuted,
  },
});
