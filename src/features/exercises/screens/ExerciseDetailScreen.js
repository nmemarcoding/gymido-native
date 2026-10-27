import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { routes } from '../../../navigation/routes';
import EmptyState from '../../../shared/components/EmptyState';
import ErrorAlert from '../../../shared/components/ErrorAlert';
import ExerciseImage, { muscleColor } from '../../../shared/components/ExerciseImage';
import GradientFill from '../../../shared/components/GradientFill';
import Loader from '../../../shared/components/Loader';
import { useFocusRemountKey } from '../../../shared/hooks/useFocusRemountKey';
import { breakpoints, colors, font, gradients, radii, spacing, typography } from '../../../shared/theme/tokens';
import GymIcon from '../../shell/GymIcon';
import ShellPage from '../../shell/ShellPage';
import { openShellPath } from '../../shell/shellLinks';
import { getExercise, getExerciseProfile } from '../api/exercisesApi';
import {
  equipmentLines,
  factChips,
  isComingSoon,
  primaryMuscleName,
  resolveExerciseLoad,
  substituteSummary,
} from '../exerciseProfile';

const MAX_ALTERNATIVES = 10;

// v2 Phase 2 C1 (UX C §Exercise detail / §Tablet): LOOK only. Phone: a
// full-bleed 400 hero with the Back pill and the caption on the photo;
// tablet (≥ 768): the Back pill above a rounded 520 hero card. Behaviour is v1.
export const PHONE_HERO = 400;
export const TABLET_HERO = 520;
const TOP_SCRIM = 120;
const BOTTOM_FADE = 220;
// The no-photo hero letters: 56 on phones; tablet capped at 120 (UX: 0.36 ×
// 520 is too big). ExerciseImage sizes its letters at 0.36 × `size`.
const PHONE_HERO_GLYPH = 56;
const TABLET_HERO_GLYPH = 120;
const glyphSize = (glyph) => Math.round(glyph / 0.36);
// Drawn off the 5-step radius scale ([no token], built as drawn).
const TABLET_HERO_RADIUS = 36;
const ALTERNATIVE_TILE_RADIUS = 22;
const ALTERNATIVE_ROW_RADIUS = 18;
export const ALTERNATIVE_TILE_HEIGHT = 150;
const ALTERNATIVE_ROW_IMAGE = Object.freeze({ width: 104, height: 84 });

// ND-4 (UX ruling): instructions with line breaks show one numbered step per
// non-empty line; otherwise null → today's single text block. No data change.
export function howToSteps(instructions) {
  if (typeof instructions !== 'string' || !/\r?\n/.test(instructions)) {
    return null;
  }
  const steps = instructions
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return steps.length > 1 ? steps : null;
}

// The eyebrow / Primary value colour: the primary muscle's hue, gold when the
// muscle has none (v1's brand colour).
export function primaryHue(profile, exercise) {
  return muscleColor(profile?.primary_muscle?.code ?? exercise?.primary_muscle_group?.code) ?? colors.gold;
}

// RN-SPEC-exercise-detail §X1. Pushed on the stack that opened it; every
// focus remounts and reloads (plans §8.1).
export default function ExerciseDetailScreen() {
  const remountKey = useFocusRemountKey();
  return (
    <ShellPage testID="exercise-detail-screen">
      <View style={styles.column}>
        <ExerciseDetail key={remountKey} />
      </View>
    </ShellPage>
  );
}

function ExerciseDetail() {
  const navigation = useNavigation();
  const route = useRoute();
  const { width } = useWindowDimensions();
  const tablet = width >= breakpoints.md;
  // ShellPage's phone gutter: the phone hero bleeds through it.
  const gutter = width >= breakpoints.sm ? spacing[5] : spacing[4];
  const exerciseId = route.params?.exerciseId;
  const [attempt, setAttempt] = useState(0);
  const [load, setLoad] = useState({ status: 'loading' });

  // §X1.1: both calls in parallel, both awaited. A 404 from either → not
  // found (⚠X-2); an exercise failure → error; a profile failure → basics (⚠X-1).
  useEffect(() => {
    let alive = true;
    setLoad({ status: 'loading' });
    Promise.allSettled([getExercise(exerciseId), getExerciseProfile(exerciseId)]).then(([exerciseResult, profileResult]) => {
      if (alive) {
        setLoad(resolveExerciseLoad(exerciseResult, profileResult));
      }
    });
    return () => {
      alive = false;
    };
  }, [exerciseId, attempt]);

  if (load.status === 'loading') {
    return <Loader label="Loading exercise" style={styles.loader} />;
  }
  if (load.status === 'notFound') {
    return (
      <EmptyState
        title="Exercise not found"
        message="This exercise isn’t available."
        actionLabel="Back to exercises"
        actionTestID="exercise-detail-back-to-exercises"
        onAction={() => openShellPath('/exercises')}
      />
    );
  }
  if (load.status === 'error') {
    // ⚠X-3: Retry reruns both calls behind the loader.
    return (
      <ErrorAlert title="Could not load this exercise" description={load.message} onRetry={() => setAttempt((n) => n + 1)} />
    );
  }

  const { exercise, profile } = load;
  const primaryMuscle = primaryMuscleName(profile, exercise);
  const hue = primaryHue(profile, exercise);
  const chips = factChips(profile);
  const equipment = equipmentLines(profile?.equipment);
  const substitutes = (profile?.substitutes ?? []).slice(0, MAX_ALTERNATIVES);
  const goBack = () => (navigation.canGoBack() ? navigation.goBack() : openShellPath('/exercises'));
  const openSubstitute = (id) => navigation.push(routes.ExerciseDetail, { exerciseId: String(id) });
  const steps = howToSteps(exercise?.instructions);

  const back = (
    <Pressable
      testID="exercise-detail-back"
      accessibilityRole="button"
      onPress={goBack}
      hitSlop={tablet ? 2 : 0}
      style={({ pressed }) => [tablet ? styles.backTablet : styles.backPhone, pressed && styles.backPressed]}
    >
      <Text style={styles.backText}>← Back</Text>
    </Pressable>
  );

  const muscles = primaryMuscle ? (
    <Section title="Muscles" testID="exercise-detail-muscles" tablet={tablet} gradient style={styles.half}>
      {tablet ? (
        <View style={styles.pairs}>
          <Pair label="Primary" value={primaryMuscle} />
          {profile?.secondary_muscles?.length ? (
            <Pair label="Secondary" value={profile.secondary_muscles.map((item) => item.name).join(' · ')} />
          ) : null}
          {profile?.stabilizer_muscles?.length ? (
            <Pair label="Stabilizers" value={profile.stabilizer_muscles.map((item) => item.name).join(' · ')} />
          ) : null}
        </View>
      ) : (
        <View>
          <Text style={[styles.smallLabel, styles.mt8]}>Primary</Text>
          <Text testID="exercise-detail-primary" style={[styles.primaryValue, { color: hue }]}>
            {primaryMuscle}
          </Text>
          {profile?.secondary_muscles?.length ? <MuscleChips label="Secondary" muscles={profile.secondary_muscles} /> : null}
          {profile?.stabilizer_muscles?.length ? <MuscleChips label="Stabilizers" muscles={profile.stabilizer_muscles} /> : null}
        </View>
      )}
    </Section>
  ) : null;

  const equipmentCard = equipment ? (
    <Section title="Equipment" testID="exercise-detail-equipment" tablet={tablet} gradient={tablet} style={styles.half}>
      {tablet ? (
        <View style={styles.chipWrap}>
          {equipment.map((line, index) => (
            <View key={`${index}-${line}`} style={styles.softChipTablet}>
              <Text style={styles.softChipTabletText}>{line}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.equipmentRows}>
          {equipment.map((line, index) => (
            <View key={`${index}-${line}`} style={styles.equipmentRow}>
              <View
                testID={`exercise-detail-equipment-icon-${index}`}
                style={[styles.equipmentIcon, index === 0 ? styles.equipmentIconFirst : styles.equipmentIconRest]}
              >
                <GymIcon name="workout" size={20} color={index === 0 ? colors.gold : colors.textStrong2} />
              </View>
              <Text style={[styles.equipmentLine, index === 0 ? styles.equipmentLineFirst : null]}>{line}</Text>
            </View>
          ))}
        </View>
      )}
    </Section>
  ) : null;

  return (
    <View style={[styles.page, tablet && styles.pageTablet]}>
      {tablet ? back : null}

      <View
        testID="exercise-detail-hero"
        style={[styles.hero, tablet ? styles.heroTablet : { height: PHONE_HERO, marginHorizontal: -gutter }]}
      >
        {/* The h1 sits on the photo, so the photo itself has no label (UX). */}
        <ExerciseImage
          testID="exercise-detail-image"
          url={exercise?.thumbnail?.url ?? null}
          name={exercise?.name}
          muscleCode={profile?.primary_muscle?.code ?? exercise?.primary_muscle_group?.code}
          size={glyphSize(tablet ? TABLET_HERO_GLYPH : PHONE_HERO_GLYPH)}
          style={styles.fill}
        />
        {/* Gradients exist from the first render (Android rule). */}
        {tablet ? null : (
          <View pointerEvents="none" style={styles.topScrim}>
            <GradientFill angle={180} colors={[colors.scrim, gradients.imageFade.colors[0]]} />
          </View>
        )}
        <View pointerEvents="none" style={tablet ? styles.fadeTablet : styles.fadePhone}>
          <GradientFill
            angle={180}
            colors={[gradients.imageFade.colors[0], gradients.imageFade.colors[1], colors.ground]}
            stops={tablet ? [0, 1, 1] : [0, 0.55, 1]}
          />
        </View>
        {tablet ? null : <View style={styles.backOnPhoto}>{back}</View>}
        <View style={tablet ? styles.captionTablet : styles.captionPhone}>
          <Text testID="exercise-detail-eyebrow" style={[tablet ? styles.eyebrowTablet : styles.eyebrow, { color: hue }]}>
            {primaryMuscle || 'Exercise'}
          </Text>
          <Text
            testID="exercise-detail-title"
            textBreakStrategy="simple"
            accessibilityRole="header"
            style={tablet ? styles.titleTablet : styles.title}
          >
            {exercise?.name}
          </Text>
          {chips.length ? (
            <View style={[styles.factChips, tablet && styles.factChipsTablet]}>
              {chips.map((chip) => (
                <View key={chip} style={[styles.factChip, tablet && styles.factChipTablet]}>
                  <Text style={[styles.factChipText, tablet && styles.factChipTextTablet]}>{chip}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      <View style={[styles.body, tablet && styles.bodyTablet]}>
        {isComingSoon(profile) ? <Text style={styles.comingSoon}>More details for this exercise are coming soon.</Text> : null}

        {muscles || equipmentCard ? (
          <View testID="exercise-detail-grid" style={[styles.grid, tablet && styles.gridTablet]}>
            {muscles}
            {equipmentCard}
          </View>
        ) : null}

        {exercise?.description || exercise?.instructions ? (
          <Section title="How to do it" testID="exercise-detail-how-to" tablet={tablet} gradient={tablet}>
            <View style={tablet ? styles.howToBodyTablet : styles.howToBody}>
              {exercise.description ? <Text style={[styles.howTo, tablet && styles.howToTablet]}>{exercise.description}</Text> : null}
              {steps ? (
                <View testID="exercise-detail-steps" style={styles.steps}>
                  {steps.map((step, index) => (
                    <View key={`${index}-${step}`} style={styles.step}>
                      <Text style={[styles.howTo, tablet && styles.howToTablet, styles.stepNumber]}>{`${index + 1}.`}</Text>
                      <Text style={[styles.howTo, tablet && styles.howToTablet, styles.stepText]}>{step}</Text>
                    </View>
                  ))}
                </View>
              ) : exercise.instructions ? (
                <Text testID="exercise-detail-instructions" style={[styles.howTo, tablet && styles.howToTablet]}>
                  {exercise.instructions}
                </Text>
              ) : null}
            </View>
          </Section>
        ) : null}

        {substitutes.length ? (
          tablet ? (
            <Section title="Alternatives" testID="exercise-detail-alternatives" tablet gradient>
              <View style={styles.altGrid}>
                {substitutes.map((substitute) => (
                  <Pressable
                    key={substitute.id}
                    testID={`exercise-alternative-${substitute.id}`}
                    accessibilityRole="button"
                    onPress={() => openSubstitute(substitute.id)}
                    style={({ pressed }) => [styles.altRow, pressed && styles.altRowPressed]}
                  >
                    <ExerciseImage
                      testID={`exercise-alternative-${substitute.id}-image`}
                      exercise={substitute}
                      size={ALTERNATIVE_ROW_IMAGE.height}
                      style={[ALTERNATIVE_ROW_IMAGE, styles.altRowImage]}
                    />
                    <View style={styles.textColumn}>
                      <Text numberOfLines={2} style={styles.altRowName}>
                        {substitute.name}
                      </Text>
                      <Text numberOfLines={2} style={styles.altRowSummary}>
                        {substituteSummary(substitute)}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </Section>
          ) : (
            <View testID="exercise-detail-alternatives">
              <Text accessibilityRole="header" style={[styles.sectionTitle, styles.alternativesTitle]}>
                Alternatives
              </Text>
              <View style={styles.altGrid}>
                {substitutes.map((substitute) => (
                  <Pressable
                    key={substitute.id}
                    testID={`exercise-alternative-${substitute.id}`}
                    accessibilityRole="button"
                    onPress={() => openSubstitute(substitute.id)}
                    style={({ pressed }) => [styles.altTile, pressed && styles.altTilePressed]}
                  >
                    <ExerciseImage
                      testID={`exercise-alternative-${substitute.id}-image`}
                      exercise={substitute}
                      size={ALTERNATIVE_TILE_HEIGHT}
                      style={styles.fill}
                    />
                    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                      <GradientFill
                        angle={180}
                        colors={[gradients.imageFade.colors[0], gradients.imageFade.colors[0], gradients.imageFade.colors[1]]}
                        stops={[0, 0.3, 1]}
                      />
                    </View>
                    <View style={styles.altCaption}>
                      <Text numberOfLines={2} style={styles.altName}>
                        {substitute.name}
                      </Text>
                      <Text numberOfLines={1} style={styles.altSummary}>
                        {substituteSummary(substitute)}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          )
        ) : null}
      </View>
    </View>
  );
}

// A card with its title as a header. Phone: surface (or gradient-card) at
// radius 24; tablet: gradient-card at radius 28, padding 24.
function Section({ title, testID, tablet, gradient = false, style, children }) {
  return (
    <View testID={testID} style={[styles.card, tablet ? styles.cardTablet : null, gradient ? styles.cardGradient : null, style]}>
      {gradient ? <GradientFill angle={gradients.card.angle} colors={gradients.card.colors} /> : null}
      <Text accessibilityRole="header" style={tablet ? styles.cardTitleTablet : styles.cardTitle}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Pair({ label, value }) {
  return (
    <View>
      <Text style={styles.pairLabel}>{label}</Text>
      <Text style={styles.pairValue}>{value}</Text>
    </View>
  );
}

function MuscleChips({ label, muscles }) {
  return (
    <View>
      <Text style={[styles.smallLabel, styles.chipsLabel]}>{label}</Text>
      <View style={styles.chipWrap}>
        {muscles.map((item) => (
          <View key={item.id ?? item.name} style={styles.softChip}>
            <Text style={styles.softChipText}>{item.name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    width: '100%',
    maxWidth: 672,
    alignSelf: 'center',
  },
  loader: {
    paddingVertical: 48,
    alignSelf: 'center',
  },
  page: {
    paddingBottom: spacing[6],
  },
  pageTablet: {
    gap: spacing[4],
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    borderRadius: 0,
  },
  // Phone Back: on the photo, 44 tall, a dark glass pill.
  backPhone: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingLeft: spacing[3],
    paddingRight: spacing[4],
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.hairlineButton,
    backgroundColor: colors.scrim,
  },
  // Tablet Back: a 40 pill (44 hit area via hitSlop) above the hero.
  backTablet: {
    alignSelf: 'flex-start',
    height: 40,
    justifyContent: 'center',
    paddingLeft: spacing[3],
    paddingRight: spacing[4],
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.fillSkeleton,
  },
  backPressed: {
    backgroundColor: colors.hairlineButton,
  },
  backText: {
    ...typography.bodySm,
    ...font(600),
    color: colors.textPrimary,
  },
  hero: {
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  heroTablet: {
    height: TABLET_HERO,
    borderRadius: TABLET_HERO_RADIUS,
    borderWidth: 1,
    borderColor: colors.choiceBorder,
  },
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: TOP_SCRIM,
  },
  fadePhone: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: BOTTOM_FADE,
  },
  fadeTablet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '70%',
  },
  backOnPhoto: {
    position: 'absolute',
    top: spacing[3],
    left: spacing[4],
  },
  captionPhone: {
    position: 'absolute',
    left: spacing[5],
    right: spacing[5],
    bottom: 14,
  },
  captionTablet: {
    position: 'absolute',
    left: spacing[7],
    right: spacing[7],
    bottom: 26,
    gap: spacing[3],
  },
  eyebrow: {
    ...typography.bodySm,
    ...font(600),
  },
  eyebrowTablet: {
    ...typography.body,
    ...font(600),
  },
  title: {
    ...typography.displayLg,
    marginTop: spacing[1],
    color: colors.textPrimary,
  },
  // 80/76 is larger than display-xl ([no token], built as drawn).
  titleTablet: {
    ...typography.displayXl,
    fontSize: 80,
    lineHeight: 76,
    letterSpacing: -4.8,
    color: colors.textPrimary,
  },
  factChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing[3],
  },
  factChipsTablet: {
    gap: spacing[2],
    marginTop: 0,
  },
  factChip: {
    height: 28,
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.switchTrackOff,
    backgroundColor: colors.scrim,
  },
  factChipTablet: {
    height: 30,
  },
  factChipText: {
    ...typography.caption,
    ...font(600),
    color: colors.textPrimary,
  },
  factChipTextTablet: {
    fontSize: 13,
    lineHeight: 18,
  },
  body: {
    gap: spacing[3],
    paddingTop: spacing[2],
  },
  bodyTablet: {
    gap: spacing[4],
    paddingTop: 0,
  },
  comingSoon: {
    ...typography.bodySm,
    color: colors.textMuted,
  },
  grid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  gridTablet: {
    gap: spacing[4],
  },
  half: {
    flex: 1,
    minWidth: 0,
  },
  card: {
    overflow: 'hidden',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    padding: spacing[4],
  },
  cardGradient: {
    borderColor: colors.choiceBorder,
  },
  cardTablet: {
    borderRadius: radii.xxl,
    padding: spacing[6],
    gap: spacing[3],
  },
  cardTitle: {
    ...typography.caption,
    ...font(600),
    color: colors.textMuted,
  },
  cardTitleTablet: {
    ...typography.titleSm,
    fontSize: 21,
    letterSpacing: -0.42,
    color: colors.textPrimary,
  },
  sectionTitle: {
    ...typography.titleXs,
    fontSize: 20,
    letterSpacing: -0.6,
    color: colors.textPrimary,
  },
  smallLabel: {
    ...typography.micro,
    ...font(400),
    color: colors.textMuted,
  },
  mt8: {
    marginTop: spacing[2],
  },
  chipsLabel: {
    marginTop: 10,
    marginBottom: spacing[1],
  },
  primaryValue: {
    ...typography.titleMd,
    fontSize: 26,
    letterSpacing: -1.04,
    marginTop: 2,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  softChip: {
    height: 26,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: radii.full,
    backgroundColor: colors.fillSkeleton,
  },
  softChipText: {
    ...typography.caption,
    color: colors.textStrong2,
  },
  softChipTablet: {
    height: 30,
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
    borderRadius: radii.full,
    backgroundColor: colors.fillSkeleton,
  },
  softChipTabletText: {
    ...typography.label,
    ...font(400),
    color: colors.textStrong2,
  },
  pairs: {
    gap: spacing[3],
  },
  pairLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  pairValue: {
    ...typography.body,
    ...font(600),
    marginTop: 3,
    color: colors.textPrimary,
  },
  equipmentRows: {
    marginTop: 10,
    gap: 10,
  },
  equipmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  equipmentIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  equipmentIconFirst: {
    backgroundColor: colors.goldTint,
  },
  equipmentIconRest: {
    backgroundColor: colors.fillSkeleton,
  },
  equipmentLine: {
    flex: 1,
    minWidth: 0,
    ...typography.bodySm,
    lineHeight: 18,
    ...font(700),
    color: colors.textPrimary,
  },
  equipmentLineFirst: {
    fontSize: 16,
    lineHeight: 20,
  },
  howToBody: {
    marginTop: 10,
    gap: spacing[2],
  },
  howToBodyTablet: {
    gap: 10,
  },
  howTo: {
    ...typography.body,
    lineHeight: 24,
    color: colors.textStrong2,
  },
  howToTablet: {
    color: colors.textSecondary,
  },
  steps: {
    gap: spacing[2],
  },
  step: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  stepNumber: {
    ...font(700),
    minWidth: 22,
    fontVariant: ['tabular-nums'],
  },
  stepText: {
    flex: 1,
    minWidth: 0,
  },
  alternativesTitle: {
    marginTop: spacing[1],
    marginBottom: 10,
    marginHorizontal: spacing[1],
  },
  altGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  altTile: {
    width: '47%',
    flexGrow: 1,
    height: ALTERNATIVE_TILE_HEIGHT,
    overflow: 'hidden',
    borderRadius: ALTERNATIVE_TILE_RADIUS,
    backgroundColor: colors.surface,
  },
  altTilePressed: {
    transform: [{ scale: 0.98 }],
  },
  altCaption: {
    position: 'absolute',
    left: spacing[3],
    right: spacing[3],
    bottom: 10,
  },
  altName: {
    ...typography.labelLg,
    ...font(700),
    lineHeight: 19,
    color: colors.textPrimary,
  },
  altSummary: {
    ...typography.micro,
    ...font(400),
    marginTop: 2,
    color: colors.textStrong2,
  },
  altRow: {
    width: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: 10,
    borderRadius: ALTERNATIVE_ROW_RADIUS,
    backgroundColor: colors.fillWell,
  },
  altRowPressed: {
    backgroundColor: colors.fillSkeleton,
  },
  altRowImage: {
    borderRadius: ALTERNATIVE_ROW_RADIUS,
  },
  textColumn: {
    flex: 1,
    minWidth: 0,
  },
  altRowName: {
    ...typography.body,
    ...font(600),
    color: colors.textPrimary,
  },
  altRowSummary: {
    ...typography.label,
    ...font(400),
    marginTop: 2,
    color: colors.textMuted,
  },
});
