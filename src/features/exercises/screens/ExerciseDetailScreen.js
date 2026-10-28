import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { routes } from '../../../navigation/routes';
import BlurLayer from '../../../shared/components/BlurLayer';
import EmptyState from '../../../shared/components/EmptyState';
import ErrorAlert from '../../../shared/components/ErrorAlert';
import ExerciseImage, { muscleColor, muscleTextColor } from '../../../shared/components/ExerciseImage';
import { usesSolidGlass } from '../../../shared/components/GlassSurface';
import GradientFill from '../../../shared/components/GradientFill';
import Loader from '../../../shared/components/Loader';
import { useFocusRemountKey } from '../../../shared/hooks/useFocusRemountKey';
import {
  blur,
  breakpoints,
  colors,
  font,
  gradients,
  muscleGlow,
  radii,
  spacing,
  textScale,
  titleTracking,
  typography,
} from '../../../shared/theme/tokens';
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
// The phone caption clears the Back pill (12 + 44 + 12) when large text grows it.
const PHONE_CAPTION_TOP = 68;
// Tablet: the muscle orb behind the hero (a 360 circle at left −80, bottom −120).
const HERO_ORB = Object.freeze({ size: 360, left: -80, bottom: -120 });
// Tablet cards: the drawn 160° card gradient folds onto surface-input →
// surface-sunk (UX §8.4).
const TABLET_CARD = Object.freeze({
  angle: 160,
  colors: Object.freeze([colors.surfaceInput, colors.surfaceSunk]),
});
// The tablet page's gold wash (radial 70 % 40 % at 90 % −6 %, as drawn) in the
// §8.5 glow-gold-ambient colours.
export const TABLET_PAGE_WASH = Object.freeze({
  radial: Object.freeze({ cx: 0.9, cy: -0.06, rx: 0.7, ry: 0.4 }),
  colors: gradients.accountGlow.colors,
  stops: Object.freeze([0, 0.6]),
});

// Large text (UX §9): role caps; titles wrap by word (max 3 lines) and a single
// long word shrinks the title instead of breaking inside it.
const DISPLAY_TEXT = Object.freeze({
  textBreakStrategy: 'simple',
  maxFontSizeMultiplier: textScale.display,
  numberOfLines: 3,
  adjustsFontSizeToFit: true,
  minimumFontScale: 0.7,
});
const TITLE_TEXT = Object.freeze({
  ...DISPLAY_TEXT,
  maxFontSizeMultiplier: textScale.title,
});
const BODY_TEXT = Object.freeze({ maxFontSizeMultiplier: textScale.body });
const PILL_TEXT = Object.freeze({ maxFontSizeMultiplier: textScale.pill });

// The shared kit helper (ExerciseImage), re-exported for this screen's callers.
export { muscleTextColor };

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
  const { width } = useWindowDimensions();
  return (
    <ShellPage testID="exercise-detail-screen" glow={width >= breakpoints.md ? TABLET_PAGE_WASH : false}>
      <View style={styles.column}>
        <ExerciseDetail key={remountKey} />
      </View>
    </ShellPage>
  );
}

function ExerciseDetail() {
  const navigation = useNavigation();
  const route = useRoute();
  const { width, fontScale } = useWindowDimensions();
  const tablet = width >= breakpoints.md;
  // UX §9 reflow: past 1.3× the two-column grids become one column.
  const stacked = fontScale > textScale.reflowAbove;
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
  const muscleCode = profile?.primary_muscle?.code ?? exercise?.primary_muscle_group?.code;
  const orbHue = muscleColor(muscleCode);
  const eyebrowColor = tablet ? (muscleTextColor(muscleCode) ?? hue) : hue;
  const half = stacked ? null : styles.half;
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
      style={tablet ? styles.backTablet : styles.backPhone}
    >
      {({ pressed }) => (
        <>
          {tablet ? null : <PhotoGlass />}
          {pressed ? <PressOverlay testID="exercise-detail-back-pressed" /> : null}
          <Text {...BODY_TEXT} style={styles.backText}>
            ← Back
          </Text>
        </>
      )}
    </Pressable>
  );

  const muscles = primaryMuscle ? (
    <Section title="Muscles" testID="exercise-detail-muscles" tablet={tablet} gradient style={half}>
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
          <Text {...BODY_TEXT} style={[styles.smallLabel, styles.mt8]}>
            Primary
          </Text>
          <Text {...TITLE_TEXT} testID="exercise-detail-primary" style={[styles.primaryValue, { color: hue }]}>
            {primaryMuscle}
          </Text>
          {profile?.secondary_muscles?.length ? <MuscleChips label="Secondary" muscles={profile.secondary_muscles} /> : null}
          {profile?.stabilizer_muscles?.length ? <MuscleChips label="Stabilizers" muscles={profile.stabilizer_muscles} /> : null}
        </View>
      )}
    </Section>
  ) : null;

  const equipmentCard = equipment ? (
    <Section title="Equipment" testID="exercise-detail-equipment" tablet={tablet} gradient={tablet} style={half}>
      {tablet ? (
        <View style={styles.chipWrap}>
          {equipment.map((line, index) => (
            <View key={`${index}-${line}`} style={styles.softChipTablet}>
              <Text {...PILL_TEXT} style={styles.softChipTabletText}>
                {line}
              </Text>
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
              <Text {...BODY_TEXT} style={[styles.equipmentLine, index === 0 ? styles.equipmentLineFirst : null]}>
                {line}
              </Text>
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
        style={[styles.hero, tablet ? styles.heroTablet : { minHeight: PHONE_HERO, marginHorizontal: -gutter }]}
      >
        {/* The h1 sits on the photo, so the photo itself has no label (UX). */}
        <ExerciseImage
          testID="exercise-detail-image"
          url={exercise?.thumbnail?.url ?? null}
          name={exercise?.name}
          muscleCode={muscleCode}
          size={glyphSize(tablet ? TABLET_HERO_GLYPH : PHONE_HERO_GLYPH)}
          style={styles.fill}
        />
        {/* Gradients exist from the first render (Android rule). */}
        {tablet ? null : (
          <View pointerEvents="none" style={styles.topScrim}>
            <GradientFill angle={180} colors={[colors.scrim, gradients.photoFade.colors[0]]} />
          </View>
        )}
        <View pointerEvents="none" style={tablet ? styles.fadeTablet : styles.fadePhone}>
          {tablet ? (
            <GradientFill angle={gradients.photoFade.angle} colors={gradients.photoFade.colors} />
          ) : (
            <GradientFill angle={180} colors={[...gradients.photoFade.colors, colors.ground]} stops={[0, 0.55, 1]} />
          )}
        </View>
        {tablet && orbHue ? (
          <View
            testID="exercise-detail-orb"
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.orb}
          >
            <GradientFill {...muscleGlow(orbHue)} />
          </View>
        ) : null}
        {tablet ? null : <View style={styles.backOnPhoto}>{back}</View>}
        <View style={tablet ? styles.captionTablet : styles.captionPhone}>
          <Text
            {...BODY_TEXT}
            testID="exercise-detail-eyebrow"
            style={[tablet ? styles.eyebrowTablet : styles.eyebrow, { color: eyebrowColor }]}
          >
            {primaryMuscle || 'Exercise'}
          </Text>
          <Text
            {...DISPLAY_TEXT}
            testID="exercise-detail-title"
            accessibilityRole="header"
            style={tablet ? styles.titleTablet : styles.title}
          >
            {exercise?.name}
          </Text>
          {chips.length ? (
            <View style={[styles.factChips, tablet && styles.factChipsTablet]}>
              {chips.map((chip) => (
                <View key={chip} testID="exercise-detail-fact-chip" style={[styles.factChip, tablet && styles.factChipTablet]}>
                  <PhotoGlass />
                  <Text {...PILL_TEXT} style={[styles.factChipText, tablet && styles.factChipTextTablet]}>
                    {chip}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      <View style={[styles.body, tablet && styles.bodyTablet]}>
        {isComingSoon(profile) ? (
          <Text {...BODY_TEXT} style={styles.comingSoon}>
            More details for this exercise are coming soon.
          </Text>
        ) : null}

        {muscles || equipmentCard ? (
          <View testID="exercise-detail-grid" style={[styles.grid, tablet && styles.gridTablet, stacked && styles.gridStacked]}>
            {muscles}
            {equipmentCard}
          </View>
        ) : null}

        {exercise?.description || exercise?.instructions ? (
          <Section title="How to do it" testID="exercise-detail-how-to" tablet={tablet} gradient={tablet}>
            <View style={tablet ? styles.howToBodyTablet : styles.howToBody}>
              {exercise.description ? (
                <Text {...BODY_TEXT} style={[styles.howTo, tablet && styles.howToTablet]}>
                  {exercise.description}
                </Text>
              ) : null}
              {steps ? (
                <View testID="exercise-detail-steps" style={styles.steps}>
                  {steps.map((step, index) => (
                    <View key={`${index}-${step}`} style={styles.step}>
                      <Text {...BODY_TEXT} style={[styles.howTo, tablet && styles.howToTablet, styles.stepNumber]}>
                        {`${index + 1}.`}
                      </Text>
                      <Text {...BODY_TEXT} style={[styles.howTo, tablet && styles.howToTablet, styles.stepText]}>
                        {step}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : exercise.instructions ? (
                <Text {...BODY_TEXT} testID="exercise-detail-instructions" style={[styles.howTo, tablet && styles.howToTablet]}>
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
                    style={[styles.altRow, stacked && styles.altFull]}
                  >
                    {({ pressed }) => (
                      <>
                        {pressed ? <PressOverlay testID={`exercise-alternative-${substitute.id}-pressed`} /> : null}
                        <ExerciseImage
                          testID={`exercise-alternative-${substitute.id}-image`}
                          exercise={substitute}
                          size={ALTERNATIVE_ROW_IMAGE.height}
                          style={[ALTERNATIVE_ROW_IMAGE, styles.altRowImage]}
                        />
                        <View style={styles.textColumn}>
                          <Text {...BODY_TEXT} numberOfLines={2} style={styles.altRowName}>
                            {substitute.name}
                          </Text>
                          <Text {...BODY_TEXT} numberOfLines={2} style={styles.altRowSummary}>
                            {substituteSummary(substitute)}
                          </Text>
                        </View>
                      </>
                    )}
                  </Pressable>
                ))}
              </View>
            </Section>
          ) : (
            <View testID="exercise-detail-alternatives">
              <Text {...TITLE_TEXT} accessibilityRole="header" style={[styles.sectionTitle, styles.alternativesTitle]}>
                Alternatives
              </Text>
              <View style={styles.altGrid}>
                {substitutes.map((substitute) => (
                  <Pressable
                    key={substitute.id}
                    testID={`exercise-alternative-${substitute.id}`}
                    accessibilityRole="button"
                    onPress={() => openSubstitute(substitute.id)}
                    style={({ pressed }) => [styles.altTile, stacked && styles.altFull, pressed && styles.altTilePressed]}
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
                        colors={[gradients.photoFade.colors[0], ...gradients.photoFade.colors]}
                        stops={[0, 0.3, 1]}
                      />
                    </View>
                    <View style={styles.altCaption}>
                      <Text {...BODY_TEXT} numberOfLines={2} style={styles.altName}>
                        {substitute.name}
                      </Text>
                      <Text {...BODY_TEXT} numberOfLines={2} style={styles.altSummary}>
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
      {gradient ? (
        <GradientFill
          angle={tablet ? TABLET_CARD.angle : gradients.card.angle}
          colors={tablet ? TABLET_CARD.colors : gradients.card.colors}
        />
      ) : null}
      <Text
        {...(tablet ? TITLE_TEXT : BODY_TEXT)}
        accessibilityRole="header"
        style={tablet ? styles.cardTitleTablet : styles.cardTitle}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

// Glass over the photo (UX §8.4 color-on-photo + blur 12): the blur, then
// the on-photo fill. Before Android 12 the fill alone (the GlassSurface rule).
function PhotoGlass() {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.photoGlass]}>
      {usesSolidGlass() ? null : <BlurLayer blurPx={blur.onPhoto} />}
      <View style={[StyleSheet.absoluteFill, styles.onPhotoFill]} />
    </View>
  );
}

// The v2 state rule: pressed = the rest look + a 4 % white overlay.
function PressOverlay({ testID }) {
  return <View testID={testID} pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pressOverlay]} />;
}

function Pair({ label, value }) {
  return (
    <View>
      <Text {...BODY_TEXT} style={styles.pairLabel}>
        {label}
      </Text>
      <Text {...BODY_TEXT} style={styles.pairValue}>
        {value}
      </Text>
    </View>
  );
}

function MuscleChips({ label, muscles }) {
  return (
    <View>
      <Text {...BODY_TEXT} style={[styles.smallLabel, styles.chipsLabel]}>
        {label}
      </Text>
      <View style={styles.chipWrap}>
        {muscles.map((item) => (
          <View key={item.id ?? item.name} style={styles.softChip}>
            <Text {...PILL_TEXT} style={styles.softChipText}>
              {item.name}
            </Text>
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
  // Phone Back: on the photo, 44 tall, on-photo glass (UX §8.4; folds 0.5),
  // the 0.12 hairline-strong edge.
  backPhone: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingLeft: spacing[3],
    paddingRight: spacing[4],
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.hairlineButton,
  },
  photoGlass: {
    overflow: 'hidden',
    borderRadius: radii.full,
  },
  onPhotoFill: {
    backgroundColor: colors.onPhoto,
  },
  pressOverlay: {
    backgroundColor: colors.pressOverlay,
  },
  // Tablet Back: a 40 pill (44 hit area via hitSlop) above the hero.
  backTablet: {
    alignSelf: 'flex-start',
    minHeight: 40,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingLeft: spacing[3],
    paddingRight: spacing[4],
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.fillSkeleton,
  },
  backText: {
    ...typography.bodySm,
    ...font(600),
    color: colors.textPrimary,
  },
  // minHeight (UX §9): large text grows the hero instead of clipping the caption.
  hero: {
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: colors.surface,
  },
  heroTablet: {
    minHeight: TABLET_HERO,
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
  orb: {
    position: 'absolute',
    left: HERO_ORB.left,
    bottom: HERO_ORB.bottom,
    width: HERO_ORB.size,
    height: HERO_ORB.size,
  },
  backOnPhoto: {
    position: 'absolute',
    top: spacing[3],
    left: spacing[4],
  },
  captionPhone: {
    paddingTop: PHONE_CAPTION_TOP,
    paddingHorizontal: spacing[5],
    paddingBottom: 14,
  },
  captionTablet: {
    paddingTop: spacing[6],
    paddingHorizontal: spacing[7],
    paddingBottom: 26,
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
    letterSpacing: titleTracking(80, -0.06),
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
  // On-photo glass chips; the drawn 0.14 edge is hairline-strong 0.12 (§8.5).
  factChip: {
    minHeight: 28,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: spacing[3],
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.hairlineButton,
  },
  factChipTablet: {
    minHeight: 30,
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
  gridStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
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
    minHeight: 26,
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
    minHeight: 30,
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
    minHeight: ALTERNATIVE_TILE_HEIGHT,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderRadius: ALTERNATIVE_TILE_RADIUS,
    backgroundColor: colors.surface,
  },
  altTilePressed: {
    transform: [{ scale: 0.98 }],
  },
  altFull: {
    width: '100%',
  },
  altCaption: {
    paddingTop: spacing[6],
    paddingHorizontal: spacing[3],
    paddingBottom: 10,
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
    overflow: 'hidden',
    backgroundColor: colors.fillWell,
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
