import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { getServerMessage, getStatus } from '../../../shared/api/apiError';
import EmptyState from '../../../shared/components/EmptyState';
import ErrorAlert from '../../../shared/components/ErrorAlert';
import { InlineError } from '../../../shared/components/FeedbackBox';
import Loader from '../../../shared/components/Loader';
import PillButton from '../../../shared/components/PillButton';
import { useFocusRemountKey } from '../../../shared/hooks/useFocusRemountKey';
import { breakpoints, colors, radii, shadows } from '../../../shared/theme/tokens';
import { Eyebrow } from '../../plans/components/PlanBits';
import ShellPage from '../../shell/ShellPage';
import { openShellPath } from '../../shell/shellLinks';
import { getGeneratorProfile, saveGeneratorProfile, searchExercises } from '../api/generatorApi';
import { Checkbox, Choice, ChoiceList, OptionPill, PillRow } from '../components/GeneratorControls';
import {
  COPY,
  QUESTIONS,
  STEP_COUNT,
  bandLabel,
  changeLabel,
  daysPillLabel,
  goalLabel,
  minutesPillLabel,
  pickUpTo,
  presetLabel,
  reasonLabel,
  removeLabel,
  stepEyebrow,
} from '../generatorCopy';
import {
  addExclusion,
  answersFromProfile,
  buildProfileBody,
  choosePreset,
  isFocusDisabled,
  isStepAnswered,
  optionCode,
  removeExclusion,
  reviewSummaries,
  searchTerm,
  setExclusionReason,
  step6NextLabel,
  stepErrorsFrom422,
  toggleFocus,
  toggleId,
  visibleSearchResults,
} from '../generatorLogic';
import { generatorRoutes } from '../generatorRoutes';

const REVIEW = STEP_COUNT + 1;
const SEARCH_DELAY_MS = 300;

// G1 (RN-SPEC-PLAN-GENERATOR §G1). Every focus remounts and reloads (§8.1).
export default function PlanGeneratorScreen() {
  const remountKey = useFocusRemountKey();
  return (
    <ShellPage testID="plan-generator-screen">
      <PlanGenerator key={remountKey} />
    </ShellPage>
  );
}

function PlanGenerator() {
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const wide = width >= breakpoints.sm;
  const [load, setLoad] = useState({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const [options, setOptions] = useState(null);
  const [answers, setAnswers] = useState(() => answersFromProfile(null));
  const [step, setStep] = useState(1);
  const [editingEquipment, setEditingEquipment] = useState(false);
  const [stepErrors, setStepErrors] = useState({});
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // §G1.1
  useEffect(() => {
    let alive = true;
    setLoad({ status: 'loading' });
    getGeneratorProfile()
      .then((result) => {
        if (!alive) {
          return;
        }
        if (result?.available) {
          setOptions(result.options ?? {});
          setAnswers(answersFromProfile(result.profile));
          setStep(1);
          setLoad({ status: 'ready' });
        } else {
          setLoad({ status: 'unavailable' });
        }
      })
      .catch((error) => {
        if (alive) {
          setLoad({ status: 'error', forbidden: getStatus(error) === 403, message: getServerMessage(error) });
        }
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  if (load.status === 'loading') {
    return <Loader label={COPY.loadingQuestions} style={styles.loader} />;
  }
  if (load.status === 'unavailable') {
    return (
      <EmptyState
        title={COPY.unavailableTitle}
        message={COPY.unavailableMessage}
        actionLabel={COPY.backToPlans}
        actionTestID="generator-back-to-plans"
        onAction={() => openShellPath('/plans')}
      />
    );
  }
  if (load.status === 'error') {
    return (
      <ErrorAlert
        title={COPY.loadError}
        description={load.message}
        onRetry={load.forbidden ? undefined : () => setReloadKey((value) => value + 1)}
      />
    );
  }

  const update = (patch) => setAnswers((current) => ({ ...current, ...patch }));
  const goTo = (next) => {
    setStep(next);
  };

  // §G1.5
  async function handleSave() {
    setSaving(true);
    setSaveError('');
    setStepErrors({});
    try {
      await saveGeneratorProfile(buildProfileBody(answers));
      if (mounted.current) {
        setSaving(false);
        navigation.push(generatorRoutes.PlanGeneratorPreview);
      }
    } catch (error) {
      if (!mounted.current) {
        return;
      }
      setSaving(false);
      setSaveError(getServerMessage(error));
      if (getStatus(error) === 422) {
        setStepErrors(stepErrorsFrom422(error?.response?.data?.errors));
      }
    }
  }

  const buttonRow = [styles.buttons, wide && styles.buttonsWide];

  if (step === REVIEW) {
    const rows = reviewSummaries(answers, options);
    return (
      <View style={styles.column}>
        <View>
          <Eyebrow>{COPY.reviewEyebrow}</Eyebrow>
          <Text textBreakStrategy="simple" accessibilityRole="header" style={styles.title}>
            {COPY.reviewTitle}
          </Text>
        </View>
        {saveError ? <InlineError testID="generator-save-error" title={COPY.saveError} message={saveError} /> : null}
        <View style={styles.reviewCard}>
          {rows.map((row, index) => (
            <View key={row.step} testID={`generator-review-${row.step}`} style={[styles.reviewRow, index > 0 && styles.divider]}>
              <View style={styles.flex}>
                <Text style={styles.reviewQuestion}>{row.question}</Text>
                <Text style={styles.reviewSummary}>{row.summary}</Text>
                {stepErrors[row.step] ? <Text style={styles.reviewError}>{stepErrors[row.step]}</Text> : null}
              </View>
              <Pressable
                testID={`generator-review-change-${row.step}`}
                accessibilityRole="button"
                accessibilityLabel={changeLabel(row.question)}
                hitSlop={12}
                onPress={() => goTo(row.step)}
                style={styles.textButton}
              >
                <Text style={styles.textButtonLabel}>{COPY.change}</Text>
              </Pressable>
            </View>
          ))}
        </View>
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>{COPY.disclaimer}</Text>
        </View>
        <View style={buttonRow}>
          <PillButton testID="generator-back" title={COPY.back} variant="secondary" fullWidth={!wide} onPress={() => goTo(STEP_COUNT)} />
          <PillButton testID="generator-see-plan" title={COPY.seeMyPlan} fullWidth={!wide} loading={saving} onPress={handleSave} />
        </View>
      </View>
    );
  }

  const nextLabel = step === STEP_COUNT ? step6NextLabel(answers) : COPY.next;

  return (
    <View style={styles.column}>
      <View>
        <Eyebrow>{stepEyebrow(step)}</Eyebrow>
        <Text textBreakStrategy="simple" accessibilityRole="header" style={styles.title}>
          {QUESTIONS[step - 1]}
        </Text>
        {step === STEP_COUNT ? <Text style={styles.optional}>{COPY.optional}</Text> : null}
      </View>
      {stepErrors[step] ? <InlineError testID="generator-step-error" title={COPY.stepError} message={stepErrors[step]} /> : null}
      <StepBody
        step={step}
        answers={answers}
        options={options}
        update={update}
        setAnswers={setAnswers}
        editingEquipment={editingEquipment}
        setEditingEquipment={setEditingEquipment}
      />
      <View style={buttonRow}>
        {step === 1 ? (
          <PillButton testID="generator-cancel" title={COPY.cancel} variant="secondary" fullWidth={!wide} onPress={() => navigation.goBack()} />
        ) : (
          <PillButton testID="generator-back" title={COPY.back} variant="secondary" fullWidth={!wide} onPress={() => goTo(step - 1)} />
        )}
        <PillButton
          testID="generator-next"
          title={nextLabel}
          fullWidth={!wide}
          disabled={!isStepAnswered(answers, step)}
          onPress={() => goTo(step + 1)}
        />
      </View>
    </View>
  );
}

function StepBody({ step, answers, options, update, setAnswers, editingEquipment, setEditingEquipment }) {
  const opts = options ?? {};
  switch (step) {
    case 1:
      return (
        <ChoiceList>
          {(opts.goals ?? []).map((option) => {
            const code = optionCode(option);
            return (
              <Choice
                key={code}
                testID={`generator-goal-${code}`}
                label={goalLabel(code)}
                selected={answers.goal === code}
                onPress={() => update({ goal: code })}
              />
            );
          })}
        </ChoiceList>
      );
    case 2:
      return (
        <ChoiceList>
          {(opts.experience_bands ?? []).map((option) => {
            const code = optionCode(option);
            return (
              <Choice
                key={code}
                testID={`generator-band-${code}`}
                label={bandLabel(code)}
                selected={answers.experience_band === code}
                onPress={() => update({ experience_band: code })}
              />
            );
          })}
        </ChoiceList>
      );
    case 3:
      return (
        <PillRow>
          {(opts.days_per_week ?? []).map((n) => (
            <OptionPill
              key={n}
              testID={`generator-days-${n}`}
              label={daysPillLabel(n)}
              selected={answers.days_per_week === n}
              onPress={() => update({ days_per_week: n })}
            />
          ))}
        </PillRow>
      );
    case 4:
      return (
        <PillRow>
          {(opts.session_minutes ?? []).map((n) => (
            <OptionPill
              key={n}
              testID={`generator-minutes-${n}`}
              label={minutesPillLabel(n)}
              selected={answers.session_minutes === n}
              onPress={() => update({ session_minutes: n })}
            />
          ))}
        </PillRow>
      );
    case 5:
      return (
        <EquipmentStep
          answers={answers}
          options={opts}
          setAnswers={setAnswers}
          editing={editingEquipment}
          setEditing={setEditingEquipment}
        />
      );
    default:
      return <FocusAvoidStep answers={answers} options={opts} setAnswers={setAnswers} />;
  }
}

// §G1.2 step 5
function EquipmentStep({ answers, options, setAnswers, editing, setEditing }) {
  // Server order, never re-sorted.
  const equipment = options.equipment ?? [];
  return (
    <View style={styles.stepColumn}>
      <ChoiceList>
        {(options.presets ?? []).map((preset) => (
          <Choice
            key={preset.code}
            testID={`generator-preset-${preset.code}`}
            label={presetLabel(preset.code)}
            hint={preset.enabled === false ? COPY.notAvailableYet : undefined}
            disabled={preset.enabled === false}
            selected={answers.equipment_preset === preset.code}
            onPress={() => setAnswers((current) => choosePreset(current, preset))}
          />
        ))}
      </ChoiceList>
      {answers.equipment_preset ? (
        <View>
          <Pressable
            testID="generator-edit-equipment"
            accessibilityRole="button"
            onPress={() => setEditing(!editing)}
            style={styles.textButton}
          >
            <Text style={styles.textButtonLabel}>{editing ? COPY.doneEditing : COPY.editEquipment}</Text>
          </Pressable>
          {editing ? (
            <View testID="generator-equipment-list" style={[styles.listCard, styles.mt8]}>
              <View style={styles.listRow}>
                <Text style={styles.listRowText}>{COPY.bodyweight}</Text>
                <Text style={styles.alwaysIncluded}>{COPY.alwaysIncluded}</Text>
              </View>
              {equipment.map((item) => {
                const checked = answers.equipment_type_ids.includes(item.id);
                return (
                  <Pressable
                    key={item.id}
                    testID={`generator-equipment-${item.id}`}
                    accessibilityRole="checkbox"
                    accessibilityLabel={item.name}
                    accessibilityState={{ checked }}
                    onPress={() =>
                      setAnswers((current) => ({ ...current, equipment_type_ids: toggleId(current.equipment_type_ids, item.id) }))
                    }
                    style={[styles.listRow, styles.divider]}
                  >
                    <Text style={[styles.listRowText, styles.flex]}>{item.name}</Text>
                    <Checkbox checked={checked} />
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// §G1.2 step 6
function FocusAvoidStep({ answers, options, setAnswers }) {
  const max = options.max_focus_muscles;
  const reasons = (options.exclusion_reasons ?? ['DISLIKE', 'DISCOMFORT']).map(optionCode);

  return (
    <View style={styles.stepColumn}>
      <View>
        <Text style={styles.sectionLabel}>{COPY.focusMuscles}</Text>
        <Text style={styles.sectionHint}>{pickUpTo(max)}</Text>
        <PillRow style={styles.mt12}>
          {(options.focus_muscles ?? []).map((muscle) => (
            <OptionPill
              key={muscle.id}
              testID={`generator-focus-${muscle.id}`}
              label={muscle.name}
              selected={answers.focus_muscle_ids.includes(muscle.id)}
              disabled={isFocusDisabled(answers.focus_muscle_ids, muscle.id, max)}
              onPress={() =>
                setAnswers((current) => ({ ...current, focus_muscle_ids: toggleFocus(current.focus_muscle_ids, muscle.id, max) }))
              }
            />
          ))}
        </PillRow>
      </View>
      <View>
        <Text style={styles.sectionLabel}>{COPY.exercisesToAvoid}</Text>
        <AvoidSearch
          exclusions={answers.exclusions}
          onChoose={(exercise) => setAnswers((current) => ({ ...current, exclusions: addExclusion(current.exclusions, exercise) }))}
        />
        {answers.exclusions.length ? (
          <View style={[styles.avoidList, styles.mt12]}>
            {answers.exclusions.map((item) => (
              <View key={item.exercise?.id} testID={`generator-avoid-${item.exercise?.id}`} style={styles.avoidRow}>
                <Text numberOfLines={1} style={[styles.listRowText, styles.avoidName]}>
                  {item.exercise?.name}
                </Text>
                <PillRow>
                  {reasons.map((reason) => (
                    <OptionPill
                      key={reason}
                      testID={`generator-avoid-${item.exercise?.id}-${reason}`}
                      label={reasonLabel(reason)}
                      selected={item.reason === reason}
                      onPress={() =>
                        setAnswers((current) => ({
                          ...current,
                          exclusions: setExclusionReason(current.exclusions, item.exercise?.id, reason),
                        }))
                      }
                    />
                  ))}
                </PillRow>
                <Pressable
                  testID={`generator-avoid-remove-${item.exercise?.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={removeLabel(item.exercise?.name)}
                  onPress={() =>
                    setAnswers((current) => ({ ...current, exclusions: removeExclusion(current.exclusions, item.exercise?.id) }))
                  }
                  style={styles.removeButton}
                >
                  <Text style={styles.removeText}>×</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

// 300 ms after typing stops, a non-empty trimmed term searches (per_page 20).
// A failed search shows no results; a newer term discards older replies.
function AvoidSearch({ exclusions, onChoose }) {
  const [text, setText] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const requestId = useRef(0);

  const run = useCallback((value) => {
    const term = searchTerm(value);
    const id = ++requestId.current;
    if (!term) {
      setResults([]);
      setSearching(false);
      return () => {};
    }
    setSearching(true);
    const timer = setTimeout(() => {
      searchExercises(term)
        .then((items) => {
          if (requestId.current === id) {
            setResults(items);
          }
        })
        .catch(() => {
          if (requestId.current === id) {
            setResults([]);
          }
        })
        .finally(() => {
          if (requestId.current === id) {
            setSearching(false);
          }
        });
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => run(text), [text, run]);
  useEffect(
    () => () => {
      requestId.current += 1;
    },
    []
  );

  const visible = visibleSearchResults(results, exclusions);

  return (
    <View style={styles.mt8}>
      <TextInput
        testID="generator-avoid-search"
        value={text}
        onChangeText={setText}
        placeholder={COPY.searchPlaceholder}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={COPY.searchPlaceholder}
        autoCorrect={false}
        autoCapitalize="none"
        style={styles.search}
      />
      {searching ? <Text style={[styles.sectionHint, styles.mt8]}>{COPY.searching}</Text> : null}
      {visible.length ? (
        <View style={[styles.listCard, styles.mt8]}>
          {visible.map((item, index) => (
            <Pressable
              key={item.id}
              testID={`generator-avoid-result-${item.id}`}
              accessibilityRole="button"
              accessibilityLabel={item.name}
              onPress={() => {
                onChoose(item);
                setText('');
              }}
              style={({ pressed }) => [styles.listRow, index > 0 && styles.divider, pressed && styles.rowPressed]}
            >
              <Text style={styles.listRowText}>{item.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  loader: {
    paddingVertical: 48,
  },
  column: {
    width: '100%',
    maxWidth: 672,
    alignSelf: 'center',
    gap: 20,
  },
  stepColumn: {
    gap: 20,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    marginTop: 4,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  optional: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  buttons: {
    flexDirection: 'column',
    gap: 12,
  },
  buttonsWide: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  textButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  textButtonLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.brand700,
  },
  listCard: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  listRowText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  alwaysIncluded: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: colors.textMuted,
  },
  sectionLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sectionHint: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  search: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.textPrimary,
  },
  avoidList: {
    gap: 8,
  },
  avoidRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  avoidName: {
    flexShrink: 1,
    minWidth: 0,
  },
  removeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
    color: colors.textMuted,
  },
  reviewCard: {
    borderRadius: radii.xxxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    boxShadow: shadows.soft,
    overflow: 'hidden',
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  reviewQuestion: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.44,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  reviewSummary: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  reviewError: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: colors.danger700,
  },
  disclaimer: {
    borderRadius: radii.xxl,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  disclaimerText: {
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  mt8: {
    marginTop: 8,
  },
  mt12: {
    marginTop: 12,
  },
});
