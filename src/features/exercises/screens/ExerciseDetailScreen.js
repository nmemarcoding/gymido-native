import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { routes } from '../../../navigation/routes';
import EmptyState from '../../../shared/components/EmptyState';
import ErrorAlert from '../../../shared/components/ErrorAlert';
import Loader from '../../../shared/components/Loader';
import RemoteImage from '../../../shared/components/RemoteImage';
import { useFocusRemountKey } from '../../../shared/hooks/useFocusRemountKey';
import { colors, radii, shadows } from '../../../shared/theme/tokens';
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
  substituteTileCode,
} from '../exerciseProfile';

const MAX_ALTERNATIVES = 10;

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
  const chips = factChips(profile);
  const equipment = equipmentLines(profile?.equipment);
  const substitutes = (profile?.substitutes ?? []).slice(0, MAX_ALTERNATIVES);
  const goBack = () => (navigation.canGoBack() ? navigation.goBack() : openShellPath('/exercises'));
  const openSubstitute = (id) => navigation.push(routes.ExerciseDetail, { exerciseId: String(id) });

  return (
    <View style={styles.page}>
      <Pressable testID="exercise-detail-back" accessibilityRole="button" onPress={goBack} style={styles.back} hitSlop={12}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>

      <View>
        <Text style={styles.eyebrow}>{primaryMuscle || 'Exercise'}</Text>
        <Text textBreakStrategy="simple" accessibilityRole="header" style={styles.title}>
          {exercise?.name}
        </Text>
      </View>

      <View style={styles.media}>
        {exercise?.thumbnail?.url ? (
          <RemoteImage url={exercise.thumbnail.url} style={styles.mediaImage} accessibilityLabel={exercise.name} />
        ) : (
          <Text style={styles.mediaPlaceholder}>{primaryMuscle || 'Exercise'}</Text>
        )}
      </View>

      {chips.length ? (
        <View style={styles.chipRow}>
          {chips.map((chip) => (
            <Chip key={chip} label={chip} />
          ))}
        </View>
      ) : null}

      {isComingSoon(profile) ? <Text style={styles.comingSoon}>More details for this exercise are coming soon.</Text> : null}

      {primaryMuscle ? (
        <Card title="Muscles" testID="exercise-detail-muscles">
          <View style={styles.muscleRows}>
            <MuscleRow label="Primary">
              <Text style={styles.strong}>{primaryMuscle}</Text>
            </MuscleRow>
            {profile?.secondary_muscles?.length ? (
              <MuscleRow label="Secondary">
                {profile.secondary_muscles.map((muscle) => (
                  <Chip key={muscle.id ?? muscle.name} label={muscle.name} />
                ))}
              </MuscleRow>
            ) : null}
            {profile?.stabilizer_muscles?.length ? (
              <MuscleRow label="Stabilizers">
                {profile.stabilizer_muscles.map((muscle) => (
                  <Chip key={muscle.id ?? muscle.name} label={muscle.name} />
                ))}
              </MuscleRow>
            ) : null}
          </View>
        </Card>
      ) : null}

      {equipment ? (
        <Card title="Equipment" testID="exercise-detail-equipment">
          <View style={styles.equipmentLines}>
            {equipment.map((line, index) => (
              <Text key={`${index}-${line}`} style={styles.strong}>
                {line}
              </Text>
            ))}
          </View>
        </Card>
      ) : null}

      {exercise?.description || exercise?.instructions ? (
        <Card title="How to do it" testID="exercise-detail-how-to">
          {exercise.description ? <Text style={[styles.howTo, styles.mt12]}>{exercise.description}</Text> : null}
          {exercise.instructions ? <Text style={[styles.howTo, styles.mt12]}>{exercise.instructions}</Text> : null}
        </Card>
      ) : null}

      {substitutes.length ? (
        <View>
          <Text style={[styles.cardTitle, styles.alternativesTitle]}>Alternatives</Text>
          <View style={styles.alternatives}>
            {substitutes.map((substitute, index) => (
              <Pressable
                key={substitute.id}
                testID={`exercise-alternative-${substitute.id}`}
                accessibilityRole="button"
                onPress={() => openSubstitute(substitute.id)}
                style={({ pressed }) => [styles.alternative, index > 0 && styles.divider, pressed && styles.alternativePressed]}
              >
                <View style={styles.tile}>
                  {substitute.thumbnail?.url ? (
                    <RemoteImage url={substitute.thumbnail.url} style={styles.tileImage} />
                  ) : (
                    <Text numberOfLines={1} textBreakStrategy="simple" style={styles.tileCode}>{substituteTileCode(substitute)}</Text>
                  )}
                </View>
                <View style={styles.textColumn}>
                  <Text numberOfLines={1} style={styles.alternativeName}>
                    {substitute.name}
                  </Text>
                  <Text numberOfLines={1} style={styles.alternativeSummary}>
                    {substituteSummary(substitute)}
                  </Text>
                </View>
                <Text style={styles.chevron} accessibilityElementsHidden importantForAccessibility="no">
                  ›
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Chip({ label }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

function Card({ title, testID, children }) {
  return (
    <View testID={testID} style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function MuscleRow({ label, children }) {
  return (
    <View style={styles.muscleRow}>
      <Text style={styles.muscleLabel}>{label}</Text>
      <View style={styles.muscleValues}>{children}</View>
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
    gap: 20,
    paddingBottom: 24,
  },
  back: {
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.brand700,
  },
  eyebrow: {
    fontSize: 11.2,
    lineHeight: 16.8,
    fontWeight: '700',
    letterSpacing: 2.016,
    textTransform: 'uppercase',
    color: colors.brand700,
  },
  title: {
    marginTop: 4,
    fontSize: 30,
    lineHeight: 37.5,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  media: {
    aspectRatio: 16 / 9,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: radii.xxxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    boxShadow: shadows.soft,
  },
  mediaImage: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  mediaPlaceholder: {
    paddingHorizontal: 12,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    letterSpacing: 2.52,
    textTransform: 'uppercase',
    textAlign: 'center',
    color: colors.brand700,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: radii.full,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  chipText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  comingSoon: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  card: {
    borderRadius: radii.xxxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 20,
    boxShadow: shadows.soft,
  },
  cardTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  muscleRows: {
    marginTop: 16,
    gap: 12,
  },
  muscleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: 12,
    rowGap: 8,
  },
  muscleLabel: {
    width: 96,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.44,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  muscleValues: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  strong: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  equipmentLines: {
    marginTop: 12,
    gap: 8,
  },
  howTo: {
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  alternativesTitle: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  alternatives: {
    overflow: 'hidden',
    borderRadius: radii.xxxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    boxShadow: shadows.soft,
  },
  alternative: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  alternativePressed: {
    backgroundColor: colors.rowPressedStrong,
  },
  tile: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: radii.xl,
    backgroundColor: colors.surfaceMuted,
  },
  tileImage: {
    width: 44,
    height: 44,
  },
  // Batch 2 #24: 11px in the same 44pt tile.
  tileCode: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
    color: colors.brand700,
  },
  textColumn: {
    flex: 1,
    minWidth: 0,
  },
  alternativeName: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  alternativeSummary: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  chevron: {
    fontSize: 18,
    lineHeight: 28,
    color: colors.textMuted,
  },
  mt12: {
    marginTop: 12,
  },
});
