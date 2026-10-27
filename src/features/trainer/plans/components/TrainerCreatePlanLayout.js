import { Pressable, StyleSheet, Text, View } from 'react-native';

import GradientFill from '../../../../shared/components/GradientFill';
import { CAP_BODY, DISPLAY_TITLE_TEXT } from '../../../../shared/components/largeText';
import PillButton from '../../../../shared/components/PillButton';
import { colors, font, gradients, radii, spacing, typography } from '../../../../shared/theme/tokens';
import ShellPage from '../../../shell/ShellPage';
import { HeroTitleMark } from '../../../shell/heroTitle';

// v2 Phase 6 O "Trainer plan create" (TrainerPlanCreate / TabletTrainerPlanCreate),
// the LOOK of the trainer variant of CreatePlanForm (the form state,
// validation and copy stay in CreatePlanScreen). Phone: the glass back pill,
// display-md title, the gradient form card (padding 18, radius 28, gap 14),
// Category 1.4 | Days 1, Difficulty, Description (3 rows), Cancel 1 | Create
// 1.8 at 54. Tablet: a centred 620 column, the card padding 30 radius 32 with
// a gold corner glow, Category | Days, Description (4 rows), the buttons at
// the right at 58. The board's phone sticky bar is a shell need (report);
// the buttons sit at the end of the card until the shell has a footer slot.

// Page washes: phone 100 % 40 % at 90 % −5 %, tablet 70 % 36 % at 85 % −6 %,
// both the §8.5 gold ambient (0.18; the boards' 0.20 / 0.18 fold onto it).
export const TRAINER_CREATE_GLOW = Object.freeze({
  radial: Object.freeze({ cx: 0.9, cy: -0.05, rx: 1, ry: 0.4 }),
  colors: gradients.accountGlow.colors,
  stops: Object.freeze([0, 0.7]),
});
export const TRAINER_TABLET_CREATE_GLOW = Object.freeze({
  radial: Object.freeze({ cx: 0.85, cy: -0.06, rx: 0.7, ry: 0.36 }),
  colors: gradients.accountGlow.colors,
  stops: Object.freeze([0, 0.7]),
});
// The tablet card's gold corner glow: a 260 circle (gold orb) at top-right.
export const CORNER_GLOW_SIZE = 260;

export default function TrainerCreatePlanLayout({ tablet, stacked = false, variant, saving, onSubmit, onBack, formErrorAlert, fields }) {
  const { nameField, slugField, categoryField, daysField, difficultyField, descriptionField } = fields;
  const pairStyle = [styles.pair, tablet && styles.pairTablet, stacked && styles.pairStacked];
  const cancel = (
    <PillButton
      key="cancel"
      testID="create-plan-cancel"
      title="Cancel"
      variant="secondary"
      onPress={onBack}
      style={stacked ? styles.buttonStacked : tablet ? styles.cancelTablet : styles.cancelPhone}
    />
  );
  const submit = (
    <PillButton
      key="submit"
      testID="create-plan-submit"
      title="Create and add days"
      loading={saving}
      onPress={onSubmit}
      style={stacked ? styles.buttonStacked : tablet ? styles.submitTablet : styles.submitPhone}
    />
  );
  return (
    <ShellPage testID="create-plan-screen" glow={tablet ? TRAINER_TABLET_CREATE_GLOW : TRAINER_CREATE_GLOW}>
      <View testID="create-plan-column" style={[styles.column, tablet && styles.columnTablet]}>
        <Pressable
          testID="create-plan-all-plans"
          accessibilityRole="link"
          accessibilityLabel={variant.backLabel}
          onPress={onBack}
          hitSlop={BACK_SLOP}
          style={[styles.back, tablet && styles.backTablet]}
        >
          {({ pressed }) => (
            <>
              {pressed ? <View testID="create-plan-all-plans-pressed" pointerEvents="none" style={[StyleSheet.absoluteFill, styles.backPressed]} /> : null}
              <Text {...CAP_BODY} style={[styles.backText, tablet && styles.backTextTablet]}>
                {variant.backLabel}
              </Text>
            </>
          )}
        </Pressable>
        <View>
          <HeroTitleMark />
          <Text {...DISPLAY_TITLE_TEXT} accessibilityRole="header" style={tablet ? styles.titleTablet : styles.title}>
            Create a plan
          </Text>
          <Text {...CAP_BODY} style={[styles.subtitle, tablet && styles.subtitleTablet]}>
            {variant.subtitle}
          </Text>
        </View>
        <View testID="create-plan-card" style={[styles.card, tablet && styles.cardTablet]}>
          <GradientFill angle={gradients.card.angle} colors={gradients.card.colors} />
          {tablet ? (
            <View testID="create-plan-corner-glow" pointerEvents="none" style={styles.cornerGlow}>
              <GradientFill radial={gradients.cardCornerGlow.radial} colors={gradients.cardCornerGlow.colors} stops={gradients.cardCornerGlow.stops} />
            </View>
          ) : null}
          {formErrorAlert}
          <View style={[styles.fields, tablet && styles.fieldsTablet]}>
            {nameField}
            {slugField}
            <View testID="create-plan-pair" style={pairStyle}>
              <View style={stacked ? null : tablet ? styles.cellEven : styles.cellCategory}>{categoryField}</View>
              <View style={stacked ? null : tablet ? styles.cellEven : styles.cellDays}>{daysField}</View>
            </View>
            {difficultyField}
            {descriptionField(tablet ? 4 : 3)}
          </View>
          <View testID="create-plan-buttons" style={[styles.buttons, tablet && styles.buttonsTablet, stacked && styles.buttonsStacked]}>
            {stacked ? [submit, cancel] : [cancel, submit]}
          </View>
        </View>
      </View>
    </ShellPage>
  );
}

// The glass back pill is 40 tall; 2 + 2 makes the 44 touch target.
const BACK_SLOP = Object.freeze({ top: 2, bottom: 2, left: 0, right: 0 });

const styles = StyleSheet.create({
  column: {
    width: '100%',
    maxWidth: 672,
    alignSelf: 'center',
    gap: spacing[3],
    paddingBottom: spacing[6],
  },
  columnTablet: {
    maxWidth: 620,
    gap: spacing['4_5'],
  },
  back: {
    alignSelf: 'flex-start',
    minHeight: 40,
    justifyContent: 'center',
    paddingLeft: spacing['2_5'],
    paddingRight: spacing['3_5'],
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.hairlineButton,
    backgroundColor: colors.fillGlass,
  },
  backTablet: {
    paddingHorizontal: spacing[4],
  },
  backPressed: {
    borderRadius: radii.full,
    backgroundColor: colors.pressOverlay,
  },
  backText: {
    ...typography.bodySm,
    ...font(600),
    color: colors.textPrimary,
  },
  backTextTablet: {
    color: colors.textStrong2,
  },
  // display-md 44/44 (phone board).
  title: {
    ...typography.displayMd,
    color: colors.textPrimary,
  },
  // display-xl (board 56/56 −0.055em).
  titleTablet: {
    ...typography.displayXl,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.bodySm,
    marginTop: spacing['1_5'],
    color: colors.textSecondary,
  },
  // Board 17: body-lg 16/24 is the nearest step.
  subtitleTablet: {
    ...typography.bodyLg,
    marginTop: spacing['2_5'],
  },
  card: {
    marginTop: spacing[1],
    overflow: 'hidden',
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.choiceBorder,
    padding: spacing['4_5'],
  },
  cardTablet: {
    marginTop: 0,
    borderRadius: radii.xxxl,
    padding: 30,
  },
  cornerGlow: {
    position: 'absolute',
    top: -CORNER_GLOW_SIZE / 2,
    right: -CORNER_GLOW_SIZE / 2,
    width: CORNER_GLOW_SIZE,
    height: CORNER_GLOW_SIZE,
  },
  fields: {
    gap: spacing['3_5'],
  },
  fieldsTablet: {
    gap: spacing[5],
  },
  pair: {
    flexDirection: 'row',
    gap: spacing['2_5'],
  },
  pairTablet: {
    gap: spacing[4],
  },
  pairStacked: {
    flexDirection: 'column',
    gap: spacing['3_5'],
  },
  // 1.4fr / 1fr (phone board).
  cellCategory: {
    flex: 1.4,
    minWidth: 0,
  },
  cellDays: {
    flex: 1,
    minWidth: 0,
  },
  cellEven: {
    flex: 1,
    minWidth: 0,
  },
  buttons: {
    marginTop: spacing[4],
    flexDirection: 'row',
    gap: spacing['2_5'],
  },
  buttonsTablet: {
    marginTop: spacing[6],
    justifyContent: 'flex-end',
    gap: spacing[3],
  },
  buttonsStacked: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
  },
  buttonStacked: {
    alignSelf: 'stretch',
    minHeight: 54,
  },
  // Phone: Cancel flex 1 | Create flex 1.8, 54 tall.
  cancelPhone: {
    flex: 1,
    minHeight: 54,
    paddingHorizontal: spacing[3],
  },
  submitPhone: {
    flex: 1.8,
    minHeight: 54,
    paddingHorizontal: spacing[3],
  },
  // Tablet: 58 tall, padding 0 26 / 0 30.
  cancelTablet: {
    minHeight: 58,
    paddingHorizontal: 26,
  },
  submitTablet: {
    minHeight: 58,
    paddingHorizontal: 30,
  },
});
