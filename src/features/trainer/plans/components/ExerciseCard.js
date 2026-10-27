import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CardHeroFill } from '../../../../shared/components/Card';
import ExerciseImage from '../../../../shared/components/ExerciseImage';
import { CAP_BODY } from '../../../../shared/components/largeText';
import PillButton from '../../../../shared/components/PillButton';
import { colors, font, layout, radii, shadows, spacing } from '../../../../shared/theme/tokens';
import { formatExerciseSummary } from '../planFormat';
import { DangerTintButton, useBuilderLayout } from './builderParts';
import { GripIcon } from './pickerIcons';
import SetList from './SetList';

// One exercise of the editable builder list (UX phase4 I §1-2, phase6 O).
// Phone member: a 120 photo hero card when the exercise has sets, else the
// compact row. Phone/tablet trainer: the 150 hero card, collapsible to the
// compact row by "Sets" (phase6 ruling 5: display only, expanded by
// default, not saved). Tablet member: the article card with a 96 thumb.
// The position badge is dropped as drawn (UX ruling); the name announces
// "exercise n of N" instead (the list rule).
const NO_ACTIONS = Object.freeze({});

export const HERO_HEIGHT = Object.freeze({ member: 120, trainer: 150 });

export function positionLabel(name, index, count) {
  return `${name}, exercise ${index + 1} of ${count}`;
}

export default function ExerciseCard({
  exercise,
  name,
  index,
  count,
  sets,
  capabilities,
  look = 'member',
  setsToggle = false,
  isActive = false,
  drag,
  onMove,
  onAddSet,
  onDeleteExercise,
  onEditSet,
  onDeleteSet,
}) {
  const { tablet } = useBuilderLayout();
  const [expanded, setExpanded] = useState(true);
  const trainer = look === 'trainer';
  const hasSets = sets.length > 0;
  const summary = formatExerciseSummary(exercise);
  const grip = capabilities.reorderExercises ? (
    <Grip exercise={exercise} name={name} index={index} count={count} drag={drag} onMove={onMove} onPhoto={false} />
  ) : null;
  const actions = (
    <CardActions
      exercise={exercise}
      name={name}
      capabilities={capabilities}
      fill={trainer}
      onAddSet={onAddSet}
      onDeleteExercise={onDeleteExercise}
      toggle={setsToggle ? { expanded, onPress: () => setExpanded((value) => !value) } : null}
    />
  );
  const setList = (
    <SetList
      exercise={exercise}
      sets={sets}
      capabilities={capabilities}
      look={trainer ? 'trainer' : 'member'}
      divided={tablet && !trainer}
      onEditSet={onEditSet}
      onDeleteSet={onDeleteSet}
    />
  );
  const nameText = (style) => (
    <Text {...CAP_BODY} accessibilityLabel={positionLabel(name, index, count)} style={style}>
      {name}
    </Text>
  );

  // Tablet member: the article (row: grip | 96 thumb | text | compact actions).
  if (tablet && !trainer) {
    return (
      <View testID={`plan-exercise-${exercise.id}`} style={[styles.article, isActive && styles.active]}>
        <CardHeroFill />
        <View style={styles.articleRow}>
          {grip}
          <ExerciseImage exercise={exercise.exercise} size={96} style={styles.thumbArticle} />
          <View style={styles.textColumn}>
            {nameText(styles.nameArticle)}
            <Text {...CAP_BODY} style={styles.summaryArticle}>
              {summary}
            </Text>
          </View>
          {hasSets ? null : actions}
        </View>
        {hasSets ? (
          <View style={styles.articleIndent}>
            {setList}
            <View style={styles.articleActions}>{actions}</View>
          </View>
        ) : null}
      </View>
    );
  }

  const hero = trainer ? expanded : hasSets;
  if (hero) {
    const heroGrip = capabilities.reorderExercises ? (
      <Grip exercise={exercise} name={name} index={index} count={count} drag={drag} onMove={onMove} onPhoto trainer={trainer} />
    ) : null;
    return (
      <View testID={`plan-exercise-${exercise.id}`} style={[trainer ? styles.heroCardTrainer : styles.heroCard, isActive && styles.active]}>
        {trainer ? null : <CardHeroFill />}
        <ExerciseImage
          exercise={exercise.exercise}
          hero
          testID={`plan-exercise-photo-${exercise.id}`}
          style={[styles.heroImage, { height: HERO_HEIGHT[look] ?? HERO_HEIGHT.member }]}
        >
          {heroGrip}
          <View style={[styles.heroText, trainer && styles.heroTextTrainer]}>
            {nameText(styles.heroName)}
            <Text {...CAP_BODY} style={[styles.heroSummary, trainer && styles.heroSummaryTrainer]}>
              {summary}
            </Text>
          </View>
        </ExerciseImage>
        <View style={trainer ? styles.heroBodyTrainer : styles.heroBody}>
          {setList}
          <View style={styles.heroActions}>{actions}</View>
        </View>
      </View>
    );
  }

  // The compact row (member: no sets; trainer: collapsed).
  return (
    <View testID={`plan-exercise-${exercise.id}`} style={[trainer ? styles.compactTrainer : styles.compact, isActive && styles.active]}>
      <View style={styles.compactRow}>
        {trainer ? null : grip}
        <ExerciseImage exercise={exercise.exercise} size={72} style={trainer ? styles.thumbTrainer : styles.thumbMember} />
        <View style={styles.textColumn}>
          {nameText(trainer ? styles.nameCompactTrainer : styles.nameCompact)}
          <Text {...CAP_BODY} style={trainer ? styles.summaryCompactTrainer : styles.summaryCompact}>
            {summary}
          </Text>
          {trainer ? null : <View style={styles.compactActions}>{actions}</View>}
        </View>
        {trainer ? (
          // Collapsed: only the "Sets" toggle (the set controls return with the list).
          <CardActions exercise={exercise} name={name} capabilities={NO_ACTIONS} toggle={{ expanded, onPress: () => setExpanded(true) }} />
        ) : null}
        {trainer ? grip : null}
      </View>
    </View>
  );
}

// The drag grip: only it starts a drag (a touch arms it; the drag begins
// after 6 px). Move up / Move down for assistive tech. On a photo it is the
// dark 36×44 (member) or 44 circle (trainer) button; on a row it is plain.
function Grip({ exercise, name, index, count, drag, onMove, onPhoto, trainer = false }) {
  return (
    <Pressable
      testID={`plan-exercise-grip-${exercise.id}`}
      onPressIn={drag}
      accessibilityRole="adjustable"
      accessibilityLabel={`Drag to reorder ${name}`}
      accessibilityActions={[
        { name: 'moveUp', label: 'Move up' },
        { name: 'moveDown', label: 'Move down' },
      ]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'moveUp' && index > 0) {
          onMove(index, index - 1);
        } else if (event.nativeEvent.actionName === 'moveDown' && index < count - 1) {
          onMove(index, index + 1);
        }
      }}
      style={onPhoto ? [styles.gripPhoto, trainer && styles.gripPhotoTrainer] : styles.gripRow}
    >
      <GripIcon color={onPhoto ? colors.textPrimary : colors.textFaint} size={18} />
    </Pressable>
  );
}

function CardActions({ exercise, name, capabilities, fill, toggle, onAddSet, onDeleteExercise }) {
  if (!capabilities.addSet && !capabilities.deleteExercise && !toggle) {
    return null;
  }
  const cell = fill ? styles.fillCell : null;
  return (
    <View style={styles.actions}>
      {capabilities.addSet ? (
        <PillButton
          testID={`plan-exercise-add-set-${exercise.id}`}
          title="Add set"
          variant="secondary"
          size="compact"
          style={cell}
          onPress={() => onAddSet(exercise)}
        />
      ) : null}
      {capabilities.deleteExercise ? (
        <DangerTintButton
          testID={`plan-exercise-delete-${exercise.id}`}
          title="Delete"
          style={cell}
          onPress={() => onDeleteExercise(exercise)}
        />
      ) : null}
      {toggle ? (
        <PillButton
          testID={`plan-exercise-sets-${exercise.id}`}
          title="Sets"
          variant="secondary"
          size="compact"
          accessibilityLabel={`${toggle.expanded ? 'Hide' : 'Show'} the sets of ${name}`}
          onPress={toggle.onPress}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  active: {
    zIndex: 1,
    opacity: 0.8,
    boxShadow: shadows.float,
  },
  heroCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.choiceBorder,
    overflow: 'hidden',
  },
  heroCardTrainer: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  heroImage: {
    aspectRatio: undefined,
    borderRadius: 0,
  },
  heroText: {
    position: 'absolute',
    left: spacing['3_5'],
    right: 56,
    bottom: spacing['2_5'],
  },
  heroTextTrainer: {
    left: spacing[4],
    right: spacing[4],
  },
  heroName: {
    ...font(700),
    fontSize: 22,
    lineHeight: 24,
    letterSpacing: -0.66,
    color: colors.textPrimary,
  },
  heroSummary: {
    ...font(400),
    marginTop: spacing['0_5'],
    fontSize: 12,
    lineHeight: 16,
    color: colors.textStrong2,
  },
  heroSummaryTrainer: {
    fontSize: 13,
    lineHeight: 18,
  },
  heroBody: {
    paddingHorizontal: spacing['3_5'],
    paddingBottom: spacing['3_5'],
  },
  heroBodyTrainer: {
    paddingTop: spacing['2_5'],
    paddingHorizontal: spacing[3],
    paddingBottom: spacing['3_5'],
  },
  heroActions: {
    marginTop: spacing[2],
  },
  gripPhoto: {
    position: 'absolute',
    top: spacing['2_5'],
    right: spacing['2_5'],
    width: 36,
    height: layout.touchMin,
    borderRadius: radii.sm,
    backgroundColor: colors.onPhoto,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gripPhotoTrainer: {
    right: undefined,
    left: spacing[3],
    top: spacing[3],
    width: layout.touchMin,
    borderRadius: radii.full,
  },
  gripRow: {
    width: 28,
    minHeight: layout.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: {
    borderRadius: radii.lgPlus,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    padding: spacing['3_5'],
  },
  compactTrainer: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    paddingVertical: spacing['2_5'],
    paddingLeft: spacing['2_5'],
    paddingRight: spacing[3],
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing['2_5'],
  },
  thumbMember: {
    width: 72,
    height: 60,
    borderRadius: radii.sm,
  },
  thumbTrainer: {
    borderRadius: radii.lg,
  },
  textColumn: {
    flex: 1,
    minWidth: 0,
    gap: spacing['0_5'],
  },
  nameCompact: {
    ...font(600),
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  nameCompactTrainer: {
    ...font(700),
    fontSize: 16,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  summaryCompact: {
    ...font(400),
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  summaryCompactTrainer: {
    ...font(400),
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  compactActions: {
    marginTop: spacing[2],
  },
  article: {
    borderRadius: radii.lgPlus,
    borderWidth: 1,
    borderColor: colors.choiceBorder,
    padding: spacing[4],
    overflow: 'hidden',
  },
  articleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing['2_5'],
  },
  thumbArticle: {
    width: 96,
    height: 76,
  },
  nameArticle: {
    ...font(600),
    fontSize: 16,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  summaryArticle: {
    ...font(400),
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  articleIndent: {
    paddingLeft: 38,
  },
  articleActions: {
    marginTop: spacing['2_5'],
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing[2],
  },
  fillCell: {
    flexGrow: 1,
  },
});
