import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { CardSurface } from '../../shared/components/Card';
import FeedbackIcon from '../../shared/components/FeedbackIcon';
import GlassSurface from '../../shared/components/GlassSurface';
import GradientFill from '../../shared/components/GradientFill';
import Loader from '../../shared/components/Loader';
import PillButton from '../../shared/components/PillButton';
import Skeleton from '../../shared/components/Skeleton';
import Spinner from '../../shared/components/Spinner';
import TextLink from '../../shared/components/TextLink';
import { colors, font, gradients, radii, spacing, textScale, titleTracking, typography } from '../../shared/theme/tokens';
import { useGeneratorAvailable } from '../planGenerator/useGeneratorAvailable';
import GymIcon from '../shell/GymIcon';
import ProgressRing from '../workout/components/ProgressRing';
import { CAP_BADGE, CAP_BODY, CAP_DISPLAY, DISPLAY_TITLE_TEXT, TITLE_TEXT } from '../../shared/components/largeText';

// v2 Phase 2 B3 (RN-SPEC-v2-phase2 §B3, UX B §Today): the Today header and
// the Today empty / error / loading states. Behaviour is v1's (RN-SPEC-home)
// except the approved #42 "Build me a plan" (gated like the generator entry).

export const LOADING_LABEL = 'Loading dashboard';

// Reflow past textScale.reflowAbove (§9 rule 4); live, never cached.
export function useReflow() {
  const { fontScale } = useWindowDimensions();
  return fontScale > textScale.reflowAbove;
}

// The main Today board's header: a 44 gold avatar (60 on tablet), the
// "{weekday}, {Mon} {d}" line and the page heading "Welcome back, {name}"
// (the shell header on "/" is untitled: one heading, web parity). The bell
// stays in the shell header.
export function TodayHeader({ initials, dateLabel, greeting, tablet }) {
  return (
    <View testID="home-header" style={styles.header}>
      <View
        testID="home-avatar"
        style={[styles.avatar, tablet && styles.avatarTablet]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <GradientFill angle={gradients.goldAvatar.angle} colors={gradients.goldAvatar.colors} />
        <Text {...CAP_BADGE} style={[styles.avatarText, tablet && styles.avatarTextTablet]}>
          {initials}
        </Text>
      </View>
      <View style={styles.headerText}>
        <Text testID="home-date" {...CAP_BODY} style={tablet ? styles.dateLineTablet : styles.dateLine}>
          {dateLabel}
        </Text>
        <Text testID="home-greeting" accessibilityRole="header" {...DISPLAY_TITLE_TEXT} style={tablet ? styles.greetingTablet : styles.greeting}>
          {greeting}
        </Text>
      </View>
    </View>
  );
}

// Loading (ND3): skeletons in the page's shape, hidden from screen readers;
// one status announced once. Phone: the inline "Loading dashboard" row under
// the skeleton. Tablet: a quiet skeleton with the centred 120 glass disc and
// a 72 spinner. Spinners slow under reduced motion and never stop; the
// skeleton shimmer is off under reduced motion (Skeleton).
export function TodayLoading({ tablet }) {
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(LOADING_LABEL);
  }, []);

  if (tablet) {
    return (
      <View testID="home-loading" accessibilityState={{ busy: true }} style={styles.loadingTablet}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.skeletonTablet}>
          <CardSurface hero testID="home-skeleton-hero" style={styles.skeletonHeroTablet} />
          <View style={styles.grid}>
            {[0, 1, 2, 3].map((index) => (
              <View key={index} style={styles.gridCell}>
                <View style={styles.skeletonTileTablet} />
              </View>
            ))}
          </View>
        </View>
        <View testID="home-loading-status" accessibilityRole="progressbar" accessibilityLabel={LOADING_LABEL} accessibilityState={{ busy: true }} style={styles.statusTablet}>
          <GlassSurface radius={60} shadow={false} style={styles.disc}>
            <Spinner size={72} thickness={6} track={colors.hairlineStrong} />
          </GlassSurface>
          <Text {...CAP_BODY} style={styles.statusTabletText}>
            {LOADING_LABEL}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View testID="home-loading" accessibilityState={{ busy: true }} style={styles.stack}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.stack}>
        <View style={styles.skeletonHero}>
          <Skeleton testID="home-skeleton" radius={radii.full} style={styles.skPill} />
          <Skeleton radius={radii.sm} style={styles.skTitle} />
          <Skeleton style={styles.skLine} />
          <Skeleton radius={radii.full} style={styles.skButton} />
        </View>
        <View style={styles.row}>
          <View style={styles.skeletonTile}>
            <Skeleton style={styles.skLabel} />
            <View style={styles.skRing} />
          </View>
          <View style={styles.skeletonTile}>
            <Skeleton style={styles.skLabelWide} />
            <Skeleton style={styles.skNumber} />
          </View>
        </View>
      </View>
      <View testID="home-loading-status" style={styles.statusRow}>
        <Loader label={LOADING_LABEL} />
      </View>
    </View>
  );
}

// Error (UX B §Today error): the danger-tinted inline card, role alert, no
// Retry (v1 ⚠H-1: the transport text, "Please try again." as fallback; the
// page reloads on the next Today focus).
export function TodayError({ message, tablet }) {
  return (
    <View testID="home-error" accessibilityRole="alert" style={[styles.errorCard, tablet ? styles.errorCardTablet : styles.errorCardPhone]}>
      <GradientFill angle={gradients.dangerCard.angle} colors={gradients.dangerCard.colors} />
      <View pointerEvents="none" style={tablet ? styles.errorGlowTablet : styles.errorGlowPhone}>
        <GradientFill radial={gradients.dangerGlow.radial} colors={gradients.dangerGlow.colors} stops={gradients.dangerGlow.stops} />
      </View>
      <View style={[styles.errorTile, tablet && styles.errorTileTablet]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <FeedbackIcon name="error" size={tablet ? 48 : 30} color={colors.dangerText} />
      </View>
      <Text accessibilityRole="header" {...(tablet ? DISPLAY_TITLE_TEXT : TITLE_TEXT)} style={tablet ? styles.errorTitleTablet : styles.errorTitle}>
        Dashboard unavailable
      </Text>
      <Text {...CAP_BODY} style={tablet ? styles.errorMessageTablet : styles.errorMessage}>
        {message || 'Please try again.'}
      </Text>
    </View>
  );
}

// "Build me a plan" (#42, APPROVED): only when GET /plan-generator/profile
// says `available: true` (the generator entry's gate). Hidden while loading,
// when unavailable, for a member with a trainer (403) and on any error. It
// mounts only in the no-plan state, so only then is the profile requested.
function BuildPlanAction({ tablet, stacked, onBuildPlan }) {
  const available = useGeneratorAvailable();
  if (!available) {
    return null;
  }
  return tablet ? (
    <PillButton testID="home-build-plan" title="Build me a plan" variant="secondary" size="cta" fullWidth={stacked} onPress={onBuildPlan} />
  ) : (
    <View style={styles.buildLink}>
      <TextLink testID="home-build-plan" label="Build me a plan" onPress={onBuildPlan} />
    </View>
  );
}

// Empty (UX B §Today, empty / §Tablet: Today empty, ND4): the hero with
// "Choose a plan" (+ #42), the stat tiles, the weight card and the recent
// workouts empty box. Data and copy are v1's.
export function TodayEmpty({ tablet, stats, weight, weightValues, recentEmpty, recentList, onChoosePlan, onBuildPlan, onSeeProgress, onAddWeight }) {
  // §9: past 1.3 the button pair stacks, the tile rows and the tablet grid
  // become one column and trailing links/rings drop below their text.
  const reflow = useReflow();
  const stacked = reflow ? styles.stacked : null;
  const zero = (value) => (value === 0 ? styles.numberDim : null);
  const hero = (
    <CardSurface hero testID="home-empty-hero" style={tablet ? styles.heroTablet : styles.heroPhone}>
      <View pointerEvents="none" style={tablet ? styles.heroGlowTablet : styles.heroGlowPhone}>
        <GradientFill radial={gradients.heroGlow.radial} colors={gradients.heroGlow.colors} stops={gradients.heroGlow.stops} />
      </View>
      <View
        testID="home-empty-hero-tile"
        style={[styles.heroTile, tablet ? styles.heroTileTablet : styles.heroTilePhone]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <GymIcon name="library" size={tablet ? 40 : 34} color={colors.gold} />
      </View>
      <Text accessibilityRole="header" {...(tablet ? DISPLAY_TITLE_TEXT : TITLE_TEXT)} style={tablet ? styles.heroTitleTablet : styles.heroTitle}>
        No active plan yet
      </Text>
      <Text {...CAP_BODY} style={tablet ? styles.heroBodyTablet : styles.heroBody}>
        Pick a workout plan to unlock your weekly schedule and guided workouts.
      </Text>
      {tablet ? (
        <View testID="home-empty-actions" style={[styles.heroActions, reflow && styles.heroActionsStacked]}>
          <PillButton testID="home-choose-plan" title="Choose a plan" size="cta" fullWidth={reflow} onPress={onChoosePlan} />
          <BuildPlanAction tablet stacked={reflow} onBuildPlan={onBuildPlan} />
        </View>
      ) : (
        <>
          <PillButton testID="home-choose-plan" title="Choose a plan" fullWidth onPress={onChoosePlan} style={styles.choosePhone} />
          <BuildPlanAction onBuildPlan={onBuildPlan} />
        </>
      )}
    </CardSurface>
  );

  const thisWeekTile = (
    <View
      testID="home-stat-this-week"
      accessible
      accessibilityLabel={`This week ${stats.thisWeekText} ${stats.plannedText} Planned`}
      style={[styles.tile, tablet && styles.tileTablet, stacked]}
    >
      {tablet ? (
        <View testID="home-stat-this-week-row" style={[styles.tileRow, reflow && styles.tileRowStacked]}>
          <ProgressRing value={stats.thisWeek} total={stats.planned} size={96} thickness={10} label={stats.ringLabel} />
          <View style={styles.tileText}>
            <Text {...CAP_BODY} style={styles.tileLabelTablet}>
              This week
            </Text>
            <Text {...CAP_DISPLAY} style={[styles.numberTablet, zero(stats.thisWeek)]}>
              {stats.thisWeekText}
              <Text style={styles.denominatorTablet}>{stats.plannedText}</Text>
            </Text>
            <Text {...CAP_BODY} style={styles.tileCaptionTablet}>
              Planned
            </Text>
          </View>
        </View>
      ) : (
        <>
          <Text {...CAP_BODY} style={styles.tileLabel}>
            This week
          </Text>
          <Text {...CAP_DISPLAY} style={[styles.number, zero(stats.thisWeek)]}>
            {stats.thisWeekText}
            <Text style={styles.denominator}>{stats.plannedText}</Text>
          </Text>
          <Text {...CAP_BODY} style={styles.tileCaption}>
            Planned
          </Text>
        </>
      )}
    </View>
  );
  const doneTile = (
    <View
      testID="home-stat-done"
      accessible
      accessibilityLabel={`Done total ${stats.doneTotalText} workouts`}
      style={[styles.tile, tablet && styles.tileTablet, stacked]}
    >
      <Text {...CAP_BODY} style={tablet ? styles.tileLabelTablet : styles.tileLabel}>
        Done total
      </Text>
      <Text {...CAP_DISPLAY} style={[tablet ? styles.numberLarge : styles.number, zero(stats.doneTotal)]}>
        {stats.doneTotalText}
      </Text>
      <Text {...CAP_BODY} style={tablet ? styles.tileCaptionTablet : styles.tileCaption}>
        workouts
      </Text>
    </View>
  );

  const weightCard = (
    <View testID="home-weight" style={[styles.tile, tablet ? styles.tileTablet : styles.weightPhone, stacked]}>
      <View testID="home-weight-header" style={[styles.weightHeader, reflow && styles.trailingBelow]}>
        <Text {...(tablet ? TITLE_TEXT : CAP_BODY)} style={tablet ? styles.cardTitleTablet : styles.cardTitle}>
          Weight
        </Text>
        <TextLink testID="home-see-progress" label="See progress" onPress={onSeeProgress} />
      </View>
      {weight.hasData ? (
        weightValues
      ) : (
        <Text {...CAP_BODY} style={tablet ? styles.weightBodyTablet : styles.weightBody}>
          Log today's weight to start tracking your trend.
        </Text>
      )}
      {tablet ? (
        <Pressable testID="home-add-weight" accessibilityRole="button" onPress={onAddWeight} style={styles.addWeightTablet}>
          {({ pressed }) => (
            <>
              {/* STATE RULE (§8.6): pressed = the gold tint + a white 4 % overlay. */}
              {pressed ? <View testID="home-add-weight-pressed" pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pressOverlay]} /> : null}
              <Text {...CAP_BODY} style={styles.addWeightTabletText}>
                Add weight log
              </Text>
            </>
          )}
        </Pressable>
      ) : (
        <PillButton testID="home-add-weight" title="Add weight log" variant="secondary" size="compact" fullWidth onPress={onAddWeight} style={styles.addWeightPhone} />
      )}
    </View>
  );
  const recentCard = recentEmpty ? (
    <View testID="home-recent-empty" style={tablet ? [styles.tile, styles.tileTablet, stacked] : [styles.recentEmptyPhone, stacked]}>
      <Text accessibilityRole="header" {...(tablet ? TITLE_TEXT : CAP_BODY)} style={tablet ? styles.cardTitleTablet : styles.cardTitle}>
        Recent workouts
      </Text>
      {tablet ? (
        <View style={styles.recentTile} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <GymIcon name="workout" size={26} color={colors.teal} />
        </View>
      ) : null}
      <Text {...(tablet ? TITLE_TEXT : CAP_BODY)} style={tablet ? styles.recentTitleTablet : styles.recentTitle}>
        No completed workouts yet
      </Text>
      <Text {...CAP_BODY} style={tablet ? styles.recentBodyTablet : styles.recentBody}>
        Once you finish a workout, it will show up here.
      </Text>
    </View>
  ) : (
    recentList
  );
  const lastWorkout = stats.lastWorkout ? (
    <Text {...CAP_BODY} style={styles.lastWorkout}>
      {stats.lastWorkout}
    </Text>
  ) : null;

  if (tablet) {
    const cell = [styles.gridCell, reflow && styles.gridCellFull];
    return (
      <View style={styles.stackTablet}>
        {hero}
        <View style={styles.grid}>
          <View testID="home-grid-cell" style={cell}>
            {thisWeekTile}
          </View>
          <View style={cell}>{doneTile}</View>
          <View style={cell}>{weightCard}</View>
          {recentEmpty ? <View style={cell}>{recentCard}</View> : null}
        </View>
        {lastWorkout}
        {recentEmpty ? null : recentCard}
      </View>
    );
  }

  // The board's two-up cards row is the no-data case; with weight values or
  // a recent list (or past the reflow scale) the cards stack full width.
  const twoUp = recentEmpty && !weight.hasData && !reflow;
  return (
    <View style={styles.stack}>
      {hero}
      <View testID="home-stat-row" style={reflow ? styles.stack : styles.row}>
        {thisWeekTile}
        {doneTile}
      </View>
      {lastWorkout}
      {twoUp ? (
        <View style={styles.row}>
          {weightCard}
          {recentCard}
        </View>
      ) : (
        <>
          {weightCard}
          {recentCard}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[1],
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTablet: {
    width: 60,
    height: 60,
  },
  // UX B §Today, empty: the initial is 17/700 (the board draws 17).
  avatarText: {
    ...font(700),
    fontSize: 17,
    lineHeight: 20,
    color: colors.onGold,
  },
  avatarTextTablet: {
    fontSize: 24,
    lineHeight: 28,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  dateLine: {
    ...typography.label,
    color: colors.textMuted,
  },
  // Tablet: 15 text-muted above the h1, like web and phone (UX, 26 Oct).
  dateLineTablet: {
    ...font(400),
    fontSize: 15,
    lineHeight: 20,
    color: colors.textMuted,
  },
  greeting: {
    ...font(600),
    fontSize: 17,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  greetingTablet: {
    ...font(400),
    fontSize: 18,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  // Layout
  stack: {
    gap: spacing[3],
  },
  stackTablet: {
    gap: spacing[4],
  },
  row: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing[2],
    rowGap: spacing[4],
  },
  gridCell: {
    width: '50%',
    paddingHorizontal: spacing[2],
  },
  // §9 reflow: one column; flex:1 cells would collapse in a column.
  gridCellFull: {
    width: '100%',
  },
  stacked: {
    flex: 0,
  },
  trailingBelow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  // Loading
  skeletonHero: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    padding: spacing['5_5'],
    gap: spacing['3_5'],
  },
  skPill: {
    width: 130,
    height: 26,
  },
  skTitle: {
    width: 200,
    maxWidth: '100%',
    height: 44,
    marginTop: spacing[1],
  },
  skLine: {
    width: 230,
    maxWidth: '100%',
    height: 14,
  },
  skButton: {
    height: 58,
    marginTop: spacing['2_5'],
  },
  skeletonTile: {
    flex: 1,
    height: 120,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    padding: spacing['4_5'],
    gap: spacing['3_5'],
  },
  skLabel: {
    width: 70,
    height: 10,
  },
  skLabelWide: {
    width: 80,
    height: 10,
  },
  // A hollow ring (no shimmer): 64 with an 8 px skeleton edge (the board's
  // grey folds into color-skeleton, UX §8.5).
  skRing: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    borderWidth: 8,
    borderColor: colors.skeleton,
  },
  skNumber: {
    width: 60,
    height: 40,
  },
  statusRow: {
    marginTop: spacing[3],
  },
  loadingTablet: {
    minHeight: 640,
  },
  skeletonTablet: {
    gap: spacing[4],
    opacity: 0.9,
  },
  // Board: radius 36 (radii.xxxxl).
  skeletonHeroTablet: {
    height: 300,
    borderRadius: radii.xxxxl,
  },
  skeletonTileTablet: {
    height: 150,
    borderRadius: radii.xxl,
    backgroundColor: colors.surface,
  },
  statusTablet: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[5],
  },
  disc: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    // The board's glow (0 0 80 −10) in gold-strong (ladder: 0.45 → 0.60).
    boxShadow: `0px 0px 80px -10px ${colors.goldStrong}`,
  },
  statusTabletText: {
    ...font(600),
    fontSize: 22,
    lineHeight: 28,
    color: colors.textPrimary,
  },
  // Error
  // Board radii (owner rule: match the boards): 32 phone, 36 tablet.
  errorCard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.dangerLine,
  },
  errorCardPhone: {
    borderRadius: radii.xxxl,
    marginTop: spacing[2],
    paddingVertical: spacing[6],
    paddingHorizontal: spacing['5_5'],
  },
  errorCardTablet: {
    borderRadius: radii.xxxxl,
    marginTop: 120,
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 40,
    gap: spacing[4],
  },
  errorGlowPhone: {
    position: 'absolute',
    top: -70,
    right: -60,
    width: 220,
    height: 220,
  },
  errorGlowTablet: {
    position: 'absolute',
    top: -140,
    alignSelf: 'center',
    width: 420,
    height: 420,
  },
  errorTile: {
    width: 64,
    height: 64,
    borderRadius: radii.lgPlus,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerTint,
  },
  errorTileTablet: {
    width: 104,
    height: 104,
    borderRadius: radii.xxxl,
  },
  // Phone: the board's light reds = danger-text-soft (the message's paler
  // red folds into it, UX §8.5). Tablet names its tokens: primary / strong-2.
  // Board: 30/34 (title-lg is 30/32).
  errorTitle: {
    ...typography.titleLg,
    lineHeight: 34,
    marginTop: spacing['4_5'],
    color: colors.dangerTextSoft,
  },
  errorMessage: {
    ...typography.body,
    marginTop: spacing[2],
    color: colors.dangerTextSoft,
  },
  // Board: 48/50 700 −0.045em (no type step; display-md is 44/44).
  errorTitleTablet: {
    ...font(700),
    fontSize: 48,
    lineHeight: 50,
    letterSpacing: titleTracking(48, -0.045),
    marginTop: spacing[2],
    textAlign: 'center',
    color: colors.textPrimary,
  },
  errorMessageTablet: {
    ...font(400),
    fontSize: 19,
    lineHeight: 28,
    textAlign: 'center',
    color: colors.textStrong2,
  },
  // Empty hero
  heroPhone: {
    alignItems: 'center',
    paddingTop: spacing[7],
    paddingHorizontal: spacing['5_5'],
    paddingBottom: spacing['5_5'],
  },
  // Board: radius 36 (radii.xxxxl; the hero card's own is 28).
  heroTablet: {
    borderRadius: radii.xxxxl,
    alignItems: 'flex-start',
    paddingVertical: 44,
    paddingHorizontal: 40,
    gap: spacing['4_5'],
  },
  heroGlowPhone: {
    position: 'absolute',
    top: -80,
    alignSelf: 'center',
    width: 260,
    height: 260,
  },
  heroGlowTablet: {
    position: 'absolute',
    top: -120,
    right: -100,
    width: 380,
    height: 380,
  },
  heroTile: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.goldTint,
  },
  // Phone: gold-line ring (0.3) and the board's 0 0 40 −6 glow in
  // gold-strong (0.5 → 0.60). Tablet: the tint only, as drawn.
  heroTilePhone: {
    width: 76,
    height: 76,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.goldLine,
    boxShadow: `0px 0px 40px -6px ${colors.goldStrong}`,
  },
  heroTileTablet: {
    width: 84,
    height: 84,
    borderRadius: 26,
  },
  // Board: 30/34 (title-lg is 30/32).
  heroTitle: {
    ...typography.titleLg,
    lineHeight: 34,
    marginTop: spacing[5],
    textAlign: 'center',
    color: colors.textPrimary,
  },
  // Board: 52/54 (display-lg is 52/52).
  heroTitleTablet: {
    ...typography.displayLg,
    lineHeight: 54,
    maxWidth: 520,
    color: colors.textPrimary,
  },
  heroBody: {
    ...typography.body,
    marginTop: spacing['2_5'],
    maxWidth: 280,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  heroBodyTablet: {
    ...font(400),
    maxWidth: 480,
    fontSize: 18,
    lineHeight: 28,
    color: colors.textSecondary,
  },
  heroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
    marginTop: spacing['1_5'],
  },
  // §9: the pair stacks, primary on top, both full width.
  heroActionsStacked: {
    flexDirection: 'column',
    alignSelf: 'stretch',
  },
  choosePhone: {
    marginTop: spacing[6],
  },
  buildLink: {
    marginTop: spacing[2],
    alignItems: 'center',
  },
  // Stat tiles
  tile: {
    flex: 1,
    minWidth: 0,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    padding: spacing['4_5'],
  },
  tileTablet: {
    flex: 0,
    minHeight: 150,
    borderRadius: radii.xxl,
    padding: spacing[6],
  },
  tileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[5],
  },
  tileRowStacked: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  tileText: {
    flex: 1,
    minWidth: 0,
  },
  tileLabel: {
    ...font(400),
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  tileLabelTablet: {
    ...font(400),
    fontSize: 15,
    lineHeight: 20,
    color: colors.textMuted,
  },
  number: {
    ...font(700),
    marginTop: spacing['3_5'],
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
    letterSpacing: -2.08,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  numberLarge: {
    ...font(700),
    fontSize: 72,
    lineHeight: 72,
    letterSpacing: titleTracking(72, -0.05),
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  // Zero values read dim (text-faint passes 4.5 on surface).
  numberDim: {
    color: colors.textFaint,
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
  tileCaption: {
    ...typography.caption,
    marginTop: spacing[1],
    color: colors.textMuted,
  },
  tileCaptionTablet: {
    ...typography.bodySm,
    color: colors.textMuted,
  },
  lastWorkout: {
    ...typography.caption,
    paddingHorizontal: spacing[1],
    color: colors.textMuted,
  },
  // Weight card
  weightPhone: {
    padding: spacing[4],
  },
  weightHeader: {
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
    ...typography.titleSm,
    color: colors.textPrimary,
  },
  weightBody: {
    ...font(400),
    marginTop: spacing['0_5'],
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  weightBodyTablet: {
    ...typography.bodyLg,
    marginTop: spacing[2],
    color: colors.textSecondary,
  },
  addWeightPhone: {
    marginTop: spacing['2_5'],
  },
  // ND4: the gold-tint "Add weight log" (52), gold-line edge (0.35 → 0.30).
  addWeightTablet: {
    alignSelf: 'flex-start',
    minHeight: 52,
    marginTop: spacing[4],
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.goldLine,
    backgroundColor: colors.goldTint,
    paddingHorizontal: spacing['5_5'],
    paddingVertical: spacing['1_5'],
  },
  pressOverlay: {
    backgroundColor: colors.pressOverlay,
  },
  addWeightTabletText: {
    ...font(700),
    fontSize: 16,
    lineHeight: 20,
    color: colors.gold,
  },
  // Recent workouts, empty
  recentEmptyPhone: {
    flex: 1,
    minWidth: 0,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    // The board's dashed 0.14 → hairline-strong (UX §8.5 white ladder).
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.fillWell,
    padding: spacing[4],
    gap: spacing['1_5'],
  },
  recentTile: {
    width: 56,
    height: 56,
    marginTop: spacing[4],
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealTint,
  },
  recentTitle: {
    ...font(600),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  recentTitleTablet: {
    ...font(600),
    marginTop: spacing[3],
    fontSize: 18,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  recentBody: {
    ...font(400),
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  recentBodyTablet: {
    ...typography.body,
    marginTop: spacing[1],
    color: colors.textSecondary,
  },
});
