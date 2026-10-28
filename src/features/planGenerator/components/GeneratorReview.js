import { Pressable, StyleSheet, Text, View } from 'react-native';

import ExerciseImage from '../../../shared/components/ExerciseImage';
import { InlineError } from '../../../shared/components/FeedbackBox';
import GradientFill from '../../../shared/components/GradientFill';
import PillButton from '../../../shared/components/PillButton';
import { colors, font, gradients, muscle, radii, spacing } from '../../../shared/theme/tokens';
import { COPY, STEP_COUNT, changeLabel, daysAWeekUnit } from '../generatorCopy';
import { BODY_TEXT, CHANGE_HIT_SLOP, CHANGE_PILL_HEIGHT, DISPLAY_TEXT, PAGE_TITLE_TEXT, PressOverlay } from '../generatorLayout';
import { imageUrlOf, reviewDetails, reviewSummaries } from '../generatorLogic';
// Review M4: the v2 image chain (w400 first).
import { THUMB_WIDTH, imageSourceProps } from '../../../shared/images/remoteImageSources';
import { ArrowRightIcon } from './GeneratorIcons';

// G1.3 "Check your answers" (GeneratorReview board, phone; tablet = the same
// content in the 640 column). Cards in question order: the gold hero (goal,
// UX N3: the gold GRADIENT card, its text in on-gold ink), a wide card
// (experience), two small cards (days, minutes), two wide cards (equipment,
// focus/avoid). Each card's question + answer reads as ONE string (the code
// summary); "Change" → that step. §9 reflow: the two small cards stack and
// the button pair stacks, primary on top.
// `buttonsPinned` (phone at ≤ 1.3×): the screen draws ReviewButtons in the
// shared PinnedDock (UX native final audit 27 Oct 2026, ruling 1, B242), so
// the review leaves them out of its flow.
export default function GeneratorReview({ answers, options, stepErrors, saveError, saving, reflow, knownExercises, onChange, onBack, onSave, titleRef, buttonsPinned = false }) {
  const rows = reviewSummaries(answers, options);
  const details = reviewDetails(answers, options);
  const summary = (step) => rows[step - 1];
  const error = (step) =>
    stepErrors[step] ? (
      <Text testID={`generator-review-error-${step}`} {...BODY_TEXT} style={styles.reviewError}>
        {stepErrors[step]}
      </Text>
    ) : null;
  const change = (step, onGold = false) => (
    <ChangePill step={step} question={summary(step).question} onGold={onGold} onPress={() => onChange(step)} />
  );
  const answerLabel = (step) => `${summary(step).question}: ${summary(step).summary}`;
  const avoided = details.firstAvoided;
  const avoidedPhoto = avoided ? imageUrlOf(knownExercises?.[avoided.id]) : null;

  return (
    <View style={styles.column}>
      <View style={styles.header}>
        <Text {...BODY_TEXT} style={styles.eyebrow}>
          {COPY.reviewEyebrow}
        </Text>
        <Text ref={titleRef} testID="generator-review-title" {...PAGE_TITLE_TEXT} accessibilityRole="header" style={styles.title}>
          {COPY.reviewTitle}
        </Text>
      </View>
      {saveError ? <InlineError testID="generator-save-error" title={COPY.saveError} message={saveError} /> : null}

      {/* Row 1: the gold hero (a card, not an action). */}
      <View testID="generator-review-1" style={styles.hero}>
        <GradientFill angle={gradients.gold.angle} colors={gradients.gold.colors} stops={gradients.gold.stops} />
        <View testID="generator-review-hero-ring" pointerEvents="none" style={styles.heroRing} />
        <View testID="generator-review-top-1" style={[styles.topRow, reflow && styles.topRowStacked]}>
          <View accessible accessibilityLabel={answerLabel(1)} style={reflow ? null : styles.flex}>
            <Text {...BODY_TEXT} style={styles.heroQuestion}>
              {summary(1).question}
            </Text>
            <Text {...DISPLAY_TEXT} style={styles.heroAnswer}>
              {details.goal}
            </Text>
          </View>
          {change(1, true)}
        </View>
        {error(1)}
      </View>

      {/* Row 2 (wide). */}
      <Card step={2}>
        <View testID="generator-review-top-2" style={[styles.topRow, reflow && styles.topRowStacked]}>
          <View accessible accessibilityLabel={answerLabel(2)} style={reflow ? null : styles.flex}>
            <Text {...BODY_TEXT} style={styles.question}>
              {summary(2).question}
            </Text>
            <Text {...BODY_TEXT} style={styles.answerWide}>
              {details.band}
            </Text>
          </View>
          {change(2)}
        </View>
        {error(2)}
      </Card>

      {/* Rows 3 and 4: two small cards side by side (stacked at large text). */}
      <View testID="generator-review-pair" style={[styles.pair, reflow && styles.pairStacked]}>
        {[
          [3, details.days, daysAWeekUnit(details.days)],
          [4, details.minutes, COPY.minUnit],
        ].map(([step, value, unit]) => (
          <Card key={step} step={step} style={reflow ? null : styles.half}>
            <View accessible accessibilityLabel={answerLabel(step)} style={styles.smallBlock}>
              <Text {...BODY_TEXT} style={styles.question}>
                {summary(step).question}
              </Text>
              <Text {...DISPLAY_TEXT} style={styles.number}>
                {value}
                <Text {...BODY_TEXT} style={styles.unit}>
                  {unit}
                </Text>
              </Text>
            </View>
            {error(step)}
            <View style={styles.mt10}>{change(step)}</View>
          </Card>
        ))}
      </View>

      {/* Row 5 (wide): the preset + the equipment chips ("Bodyweight" first). */}
      <Card step={5}>
        <View testID="generator-review-top-5" style={[styles.topRow, reflow && styles.topRowStacked]}>
          <View accessible accessibilityLabel={answerLabel(5)} style={reflow ? null : styles.flex}>
            <Text {...BODY_TEXT} style={styles.question}>
              {summary(5).question}
            </Text>
            <Text {...BODY_TEXT} style={styles.answerPreset}>
              {details.preset}
            </Text>
            <View style={styles.chips}>
              {details.equipment.map((name) => (
                <View key={name} style={styles.chip}>
                  <Text {...BODY_TEXT} style={styles.chipText}>
                    {name}
                  </Text>
                </View>
              ))}
            </View>
          </View>
          {change(5)}
        </View>
        {error(5)}
      </Card>

      {/* Row 6 (wide): focus / go easy / avoid lines + the avoided photo. */}
      <Card step={6} flush>
        <View style={styles.row6}>
          <View style={styles.row6Text}>
            <View accessible accessibilityLabel={answerLabel(6)}>
              <Text {...BODY_TEXT} style={styles.question}>
                {summary(6).question}
              </Text>
              <Line testID="generator-review-focus" part={details.focus} labelStyle={styles.labelFocus} />
              {details.goEasy ? <Line testID="generator-review-go-easy" part={details.goEasy} labelStyle={styles.labelGoEasy} /> : null}
              <Line testID="generator-review-avoid" part={details.avoid} labelStyle={styles.labelAvoid} />
            </View>
            {error(6)}
            <View style={styles.mt10}>{change(6)}</View>
          </View>
          {avoidedPhoto && !reflow ? (
            <View testID="generator-review-avoid-photo" style={styles.row6Photo} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <ExerciseImage {...imageSourceProps(avoidedPhoto, { width: THUMB_WIDTH })} name={avoided.name} size={128} style={styles.row6Image} />
              <GradientFill angle={270} colors={gradients.surfaceFade.colors} stops={ROW6_FADE_STOPS} />
              <View style={styles.photoChip}>
                <Text {...BODY_TEXT} numberOfLines={1} style={styles.photoChipText}>
                  {avoided.name}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      </Card>

      <View role="note" style={styles.disclaimer}>
        <Text {...BODY_TEXT} style={styles.disclaimerText}>
          {COPY.disclaimer}
        </Text>
      </View>
      {buttonsPinned ? null : <ReviewButtons saving={saving} stacked={reflow} onBack={onBack} onSave={onSave} />}
    </View>
  );
}

// Back + "See my plan →" (row: Back, then See my plan taking the rest, gap 10).
// `stacked` (§9 reflow, or below 21rem in the dock): See my plan over Back,
// both full width.
export function ReviewButtons({ saving, stacked, onBack, onSave }) {
  return (
    <View testID="generator-buttons" style={[styles.buttons, stacked && styles.buttonsStacked]}>
      {stacked ? null : (
        <PillButton key="back" testID="generator-back" title={COPY.back} variant="secondary" disabled={saving} onPress={() => onBack(STEP_COUNT)} />
      )}
      <PillButton
        key="see"
        testID="generator-see-plan"
        title={COPY.seeMyPlan}
        fullWidth={stacked}
        style={stacked ? null : styles.flex}
        loading={saving}
        icon={saving ? undefined : ({ color }) => <ArrowRightIcon size={18} color={color} />}
        onPress={onSave}
      />
      {stacked ? (
        <PillButton key="back" testID="generator-back" title={COPY.back} variant="secondary" fullWidth disabled={saving} onPress={() => onBack(STEP_COUNT)} />
      ) : null}
    </View>
  );
}

// The drawn fade inside the photo: surface at the left edge → clear at 45 %
// (the kit surface fade, 0 → 0.9, run right to left).
const ROW6_FADE_STOPS = Object.freeze([0.55, 1]);

function Card({ step, children, style, flush = false }) {
  return (
    <View testID={`generator-review-${step}`} style={[styles.card, flush && styles.cardFlush, style]}>
      {children}
    </View>
  );
}

// "Focus: Chest" — the label in its colour (gold / warning / the core muscle
// colour as drawn), the names in text-primary 15/22/600.
function Line({ part, labelStyle, testID }) {
  return (
    <Text testID={testID} {...BODY_TEXT} style={styles.line}>
      {part.label ? <Text style={labelStyle}>{`${part.label} `}</Text> : null}
      {part.text}
    </Text>
  );
}

// The 34 "Change" pill (44 hit). Glass on the cards; on the gold hero a dark
// pill (on-gold fill, gold text) as drawn.
function ChangePill({ step, question, onGold, onPress }) {
  return (
    <Pressable
      testID={`generator-review-change-${step}`}
      accessibilityRole="button"
      accessibilityLabel={changeLabel(question)}
      hitSlop={CHANGE_HIT_SLOP}
      onPress={onPress}
      style={[styles.changePill, onGold ? styles.changePillOnGold : styles.changePillGlass]}
    >
      {({ pressed }) => (
        <>
          <PressOverlay pressed={pressed} />
          <Text {...BODY_TEXT} style={[styles.changeLabel, onGold && styles.changeLabelOnGold]}>
            {COPY.change}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    minWidth: 0,
  },
  column: {
    gap: spacing[3],
  },
  header: {
    paddingHorizontal: spacing[1],
    paddingBottom: spacing[1],
  },
  eyebrow: {
    ...font(600),
    fontSize: 14,
    lineHeight: 20,
    color: colors.gold,
  },
  // Drawn 46/44/700 −0.05em (display-md is 44/44; the drawn size is used).
  title: {
    ...font(700),
    marginTop: 6,
    fontSize: 46,
    lineHeight: 44,
    letterSpacing: -2.3,
    color: colors.textPrimary,
  },
  hero: {
    borderRadius: radii.xxl,
    padding: spacing['4_5'],
    overflow: 'hidden',
  },
  // The decorative ring: 180 × 180, a 24 px ink-faint (0.08) border, right
  // −40, bottom −60.
  heroRing: {
    position: 'absolute',
    right: -40,
    bottom: -60,
    width: 180,
    height: 180,
    borderRadius: radii.full,
    borderWidth: 24,
    borderColor: colors.inkFaint,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  topRowStacked: {
    flexDirection: 'column',
  },
  heroQuestion: {
    ...font(600),
    fontSize: 13,
    lineHeight: 18,
    color: colors.onGoldMuted,
  },
  heroAnswer: {
    ...font(700),
    marginTop: 10,
    fontSize: 36,
    lineHeight: 38,
    letterSpacing: -1.8,
    color: colors.onGold,
  },
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    padding: spacing[4],
    overflow: 'hidden',
  },
  cardFlush: {
    padding: 0,
  },
  pair: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  pairStacked: {
    flexDirection: 'column',
  },
  half: {
    flex: 1,
    minWidth: 0,
  },
  smallBlock: {
    gap: spacing['2_5'],
  },
  question: {
    ...font(400),
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  answerWide: {
    ...font(700),
    marginTop: 8,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -1.04,
    color: colors.textPrimary,
  },
  number: {
    ...font(700),
    fontSize: 44,
    lineHeight: 44,
    letterSpacing: -2.2,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  unit: {
    ...font(600),
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 0,
    color: colors.textMuted,
  },
  answerPreset: {
    ...font(700),
    marginTop: 8,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.96,
    color: colors.textPrimary,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing['1_5'],
    marginTop: spacing['2_5'],
  },
  // 28 tall, padding 0 10, white 0.07 drawn → fill-glass 0.08.
  chip: {
    minHeight: 28,
    justifyContent: 'center',
    paddingHorizontal: spacing['2_5'],
    paddingVertical: spacing[1],
    borderRadius: radii.full,
    backgroundColor: colors.fillGlass,
  },
  chipText: {
    ...font(400),
    fontSize: 13,
    lineHeight: 18,
    color: colors.textStrong2,
  },
  row6: {
    flexDirection: 'row',
  },
  row6Text: {
    flex: 1,
    minWidth: 0,
    padding: spacing[4],
  },
  line: {
    ...font(600),
    marginTop: 4,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  labelFocus: {
    color: colors.gold,
  },
  labelGoEasy: {
    color: colors.warning,
  },
  labelAvoid: {
    color: muscle.core,
  },
  row6Photo: {
    width: 128,
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  row6Image: {
    width: 128,
    height: '100%',
    borderRadius: 0,
  },
  photoChip: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    maxWidth: 112,
    minHeight: 22,
    justifyContent: 'center',
    paddingHorizontal: spacing[2],
    borderRadius: radii.full,
    backgroundColor: colors.onPhotoStrong,
  },
  photoChipText: {
    ...font(600),
    fontSize: 11,
    lineHeight: 14,
    color: colors.textPrimary,
  },
  reviewError: {
    ...font(400),
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: colors.dangerText,
  },
  changePill: {
    alignSelf: 'flex-start',
    minHeight: CHANGE_PILL_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  changePillGlass: {
    backgroundColor: colors.hairlineStrong,
  },
  changePillOnGold: {
    backgroundColor: colors.onGold,
  },
  changeLabel: {
    ...font(600),
    fontSize: 13,
    lineHeight: 18,
    color: colors.textPrimary,
  },
  changeLabelOnGold: {
    color: colors.gold,
  },
  // GeneratorReview board: white 0.05 fill (→ fill-subtle 0.04) + 0.06 edge
  // (→ hairline 0.07), radius 20, 14/22 text-secondary.
  disclaimer: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.fillWell,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing['3_5'],
  },
  disclaimerText: {
    ...font(400),
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing['2_5'],
  },
  buttonsStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  mt10: {
    marginTop: 10,
  },
});
