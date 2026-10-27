import { useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  findNodeHandle,
  useWindowDimensions,
} from 'react-native';

import { getServerMessage, getStatus } from '../../../shared/api/apiError';
import ErrorAlert from '../../../shared/components/ErrorAlert';
import { InlineError } from '../../../shared/components/FeedbackBox';
import Loader from '../../../shared/components/Loader';
import PillButton from '../../../shared/components/PillButton';
import { useFocusRemountKey } from '../../../shared/hooks/useFocusRemountKey';
import { breakpoints, colors, font, radii, textInputColors, textScale } from '../../../shared/theme/tokens';
import { Eyebrow } from '../../../shared/components/Typography';
import ShellPage from '../../shell/ShellPage';
import { openShellPath } from '../../shell/shellLinks';
import { getGeneratorProfile, saveGeneratorProfile, searchExercises } from '../api/generatorApi';
import { Checkbox, Choice, ChoiceList, OptionPill, PillRow } from '../components/GeneratorControls';
import { GENERATOR_STATE_MAX_WIDTH, GeneratorUnavailable } from '../components/GeneratorStates';
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
  deepLinkStep,
  focusHint,
  goEasyAreaLabel,
  goEasyAreasOf,
  goEasyHint,
  goEasyNotice,
  isAreaBlocked,
  isFocusBlocked,
  isFocusPillDisabled,
  isStepAnswered,
  optionCode,
  removeExclusion,
  reviewSummaries,
  searchTerm,
  setExclusionReason,
  step6NextLabel,
  stepErrorsFrom422,
  toggleFocus,
  toggleGoEasyArea,
  toggleId,
  visibleSearchResults,
} from '../generatorLogic';
import { generatorRoutes } from '../generatorRoutes';

const REVIEW = STEP_COUNT + 1;
const SEARCH_DELAY_MS = 300;
// As the app's other focus moves: give the screen time to lay out first.
const FOCUS_DELAY_MS = 300;

// UX §9 large text. The step/review question is the page title: it scales at
// most 1.3×, wraps by word (max 3 lines) and shrinks a single over-long word
// (to 0.7×). Every other text is body/label text (2×) and never truncated.
const TITLE_TEXT = Object.freeze({
  textBreakStrategy: 'simple',
  maxFontSizeMultiplier: textScale.display,
  numberOfLines: 3,
  adjustsFontSizeToFit: true,
  minimumFontScale: 0.7,
});
const BODY_TEXT = Object.freeze({ maxFontSizeMultiplier: textScale.body });
// §9 rule 4: above 1.3× text, button pairs stack (primary on top, full width)
// and trailing row actions drop below the text.
export const isReflow = (fontScale) => fontScale > textScale.reflowAbove;

// The review "Change" pill: 34 visual, 44 hit.
const CHANGE_PILL_HEIGHT = 34;
const CHANGE_SLOP = (44 - CHANGE_PILL_HEIGHT) / 2;
const CHANGE_HIT_SLOP = Object.freeze({ top: CHANGE_SLOP, bottom: CHANGE_SLOP, left: 4, right: 4 });

// The §8.6 press overlay (rest colour + white 4 %).
function PressOverlay({ pressed }) {
  return pressed ? <View testID="press-overlay" pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pressOverlay]} /> : null;
}

// The preview's 422 field errors ({ [step]: message }) from the route; any
// other shape → none.
export function initialStepErrors(param) {
  const result = {};
  if (!param || typeof param !== 'object') {
    return result;
  }
  for (const [key, message] of Object.entries(param)) {
    const step = Number(key);
    if (Number.isInteger(step) && step >= 1 && step <= STEP_COUNT && typeof message === 'string' && message) {
      result[step] = message;
    }
  }
  return result;
}

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
  const route = useRoute();
  const { width, fontScale } = useWindowDimensions();
  const reflow = isReflow(fontScale);
  // §9: at large text the pair stacks whatever the width.
  const wide = width >= breakpoints.sm && !reflow;
  const [load, setLoad] = useState({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const [options, setOptions] = useState(null);
  const [answers, setAnswers] = useState(() => answersFromProfile(null));
  const [step, setStep] = useState(1);
  const [editingEquipment, setEditingEquipment] = useState(false);
  // A preview 422 (go_easy_area_ids) hands its field errors over with the
  // deep link (`stepErrors` route param), read once on mount.
  const [stepErrors, setStepErrors] = useState(() => initialStepErrors(route.params?.stepErrors));
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const mounted = useRef(true);
  // T-18 deep link: the `step` route param, read once on mount.
  const deepStep = useRef(deepLinkStep(route.params?.step));
  const [focusHeading, setFocusHeading] = useState(false);
  const headingRef = useRef(null);
  const stepErrorRef = useRef(null);

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
          // T-18: a deep-linked step opens after the load, heading focused.
          setStep(deepStep.current ?? 1);
          setFocusHeading(deepStep.current !== null);
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

  useEffect(() => {
    if (!focusHeading || load.status !== 'ready') {
      return undefined;
    }
    const timer = setTimeout(() => {
      setFocusHeading(false);
      // PM parity (26 Oct): preview → step 6 with a 422 focuses the error.
      const node = findNodeHandle(stepErrorRef.current ?? headingRef.current);
      if (node) {
        AccessibilityInfo.setAccessibilityFocus(node);
      }
    }, FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [focusHeading, load.status]);

  if (load.status === 'loading') {
    return <Loader label={COPY.loadingQuestions} style={styles.loader} />;
  }
  if (load.status === 'unavailable') {
    return (
      <GeneratorUnavailable onBack={() => openShellPath('/plans')} />
    );
  }
  if (load.status === 'error') {
    // G2: Retry only for network/server errors; 403 (a member with a trainer) none.
    return (
      <ErrorAlert
        testID="generator-load-error"
        variant="generator"
        style={styles.stateCard}
        title={COPY.loadError}
        description={load.message}
        retryTestID="generator-load-retry"
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
      await saveGeneratorProfile(buildProfileBody(answers, {}, goEasyAreasOf(options)));
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
  // §9 reflow: primary on top of a stacked pair.
  const pair = (secondary, primary) => (reflow ? [primary, secondary] : [secondary, primary]);

  if (step === REVIEW) {
    const rows = reviewSummaries(answers, options);
    return (
      <View style={styles.column}>
        <View>
          <Eyebrow style={styles.eyebrow}>{COPY.reviewEyebrow}</Eyebrow>
          <Text {...TITLE_TEXT} accessibilityRole="header" style={styles.title}>
            {COPY.reviewTitle}
          </Text>
        </View>
        {saveError ? <InlineError testID="generator-save-error" title={COPY.saveError} message={saveError} /> : null}
        <View style={styles.reviewCard}>
          {rows.map((row, index) => (
            <View
              key={row.step}
              testID={`generator-review-${row.step}`}
              style={[styles.reviewRow, reflow && styles.reviewRowStacked, index > 0 && styles.divider]}
            >
              <View style={reflow ? null : styles.flex}>
                <Text {...BODY_TEXT} style={styles.reviewQuestion}>
                  {row.question}
                </Text>
                <Text {...BODY_TEXT} style={styles.reviewSummary}>
                  {row.summary}
                </Text>
                {stepErrors[row.step] ? (
                  <Text {...BODY_TEXT} style={styles.reviewError}>
                    {stepErrors[row.step]}
                  </Text>
                ) : null}
              </View>
              {/* GeneratorReview board: the 34 glass "Change" pill (44 hit). */}
              <Pressable
                testID={`generator-review-change-${row.step}`}
                accessibilityRole="button"
                accessibilityLabel={changeLabel(row.question)}
                hitSlop={CHANGE_HIT_SLOP}
                onPress={() => goTo(row.step)}
                style={styles.changePill}
              >
                {({ pressed }) => (
                  <>
                    <PressOverlay pressed={pressed} />
                    <Text {...BODY_TEXT} style={styles.changeLabel}>
                      {COPY.change}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          ))}
        </View>
        <View style={styles.disclaimer}>
          <Text {...BODY_TEXT} style={styles.disclaimerText}>
            {COPY.disclaimer}
          </Text>
        </View>
        <View testID="generator-buttons" style={buttonRow}>
          {pair(
            <PillButton key="back" testID="generator-back" title={COPY.back} variant="secondary" fullWidth={!wide} onPress={() => goTo(STEP_COUNT)} />,
            <PillButton key="see" testID="generator-see-plan" title={COPY.seeMyPlan} fullWidth={!wide} loading={saving} onPress={handleSave} />
          )}
        </View>
      </View>
    );
  }

  const nextLabel = step === STEP_COUNT ? step6NextLabel(answers) : COPY.next;

  return (
    <View style={styles.column}>
      {/* G3: the step error sits above the question and is read before the eyebrow. */}
      {stepErrors[step] ? (
        <InlineError ref={stepErrorRef} testID="generator-step-error" title={COPY.stepError} message={stepErrors[step]} />
      ) : null}
      <View>
        <Eyebrow style={styles.eyebrow}>{stepEyebrow(step)}</Eyebrow>
        <Text ref={headingRef} testID="generator-step-title" {...TITLE_TEXT} accessibilityRole="header" style={styles.title}>
          {QUESTIONS[step - 1]}
        </Text>
        {step === STEP_COUNT ? (
          <Text {...BODY_TEXT} style={styles.optional}>
            {COPY.optional}
          </Text>
        ) : null}
      </View>
      <StepBody
        step={step}
        answers={answers}
        options={options}
        update={update}
        setAnswers={setAnswers}
        editingEquipment={editingEquipment}
        setEditingEquipment={setEditingEquipment}
      />
      <View testID="generator-buttons" style={buttonRow}>
        {pair(
          step === 1 ? (
            <PillButton key="cancel" testID="generator-cancel" title={COPY.cancel} variant="secondary" fullWidth={!wide} onPress={() => navigation.goBack()} />
          ) : (
            <PillButton key="back" testID="generator-back" title={COPY.back} variant="secondary" fullWidth={!wide} onPress={() => goTo(step - 1)} />
          ),
          <PillButton
            key="next"
            testID="generator-next"
            title={nextLabel}
            fullWidth={!wide}
            disabled={!isStepAnswered(answers, step)}
            onPress={() => goTo(step + 1)}
          />
        )}
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
            <Text {...BODY_TEXT} style={styles.textButtonLabel}>
              {editing ? COPY.doneEditing : COPY.editEquipment}
            </Text>
          </Pressable>
          {editing ? (
            <View testID="generator-equipment-list" style={[styles.listCard, styles.mt8]}>
              <View style={styles.listRow}>
                <Text {...BODY_TEXT} style={[styles.listRowText, styles.flex]}>
                  {COPY.bodyweight}
                </Text>
                <Text {...BODY_TEXT} style={styles.alwaysIncluded}>
                  {COPY.alwaysIncluded}
                </Text>
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
                    <Text {...BODY_TEXT} style={[styles.listRowText, styles.flex]}>
                      {item.name}
                    </Text>
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

// T-18/T-40: a step-6 pill's hint is its section label; a blocked pill also
// gets the block hint (web: `aria-describedby` on the hint).
const pillHint = (sectionLabel, blockHint) => (blockHint ? `${sectionLabel}. ${blockHint}` : sectionLabel);

// §G1.2 step 6; T-18 adds "Anything to go easy on?" when areas are offered.
function FocusAvoidStep({ answers, options, setAnswers }) {
  const max = options.max_focus_muscles;
  const reasons = (options.exclusion_reasons ?? ['DISLIKE', 'DISCOMFORT']).map(optionCode);
  const focusMuscles = options.focus_muscles ?? [];
  const areas = goEasyAreasOf(options);
  const hasAreas = areas.length > 0;
  const focusBlockHint = hasAreas ? focusHint(answers, areas, focusMuscles) : '';
  const areaBlockHint = hasAreas ? goEasyHint(answers, areas) : '';
  const { fontScale } = useWindowDimensions();
  const reflow = isReflow(fontScale);

  return (
    <View testID="generator-step6" style={[styles.stepColumn, styles.stepSixColumn]}>
      <View>
        <Text {...BODY_TEXT} style={styles.sectionLabel}>
          {COPY.focusMuscles}
        </Text>
        <Text {...BODY_TEXT} style={styles.sectionHint}>
          {pickUpTo(max)}
        </Text>
        <PillRow style={styles.mt12}>
          {focusMuscles.map((muscle) => (
            <OptionPill
              key={muscle.id}
              testID={`generator-focus-${muscle.id}`}
              label={muscle.name}
              selected={answers.focus_muscle_ids.includes(muscle.id)}
              disabled={isFocusPillDisabled(answers, muscle.id, max, areas)}
              accessibilityHint={pillHint(COPY.focusMuscles, isFocusBlocked(answers, muscle.id, areas) ? focusBlockHint : '')}
              onPress={() =>
                setAnswers((current) =>
                  isFocusBlocked(current, muscle.id, areas)
                    ? current
                    : { ...current, focus_muscle_ids: toggleFocus(current.focus_muscle_ids, muscle.id, max) }
                )
              }
            />
          ))}
        </PillRow>
        {hasAreas ? <BlockHint testID="generator-focus-block-hint" text={focusBlockHint} /> : null}
      </View>
      {hasAreas ? (
        <View testID="generator-go-easy">
          <Text {...BODY_TEXT} style={styles.sectionLabel}>
            {COPY.goEasyLabel}
          </Text>
          <Text {...BODY_TEXT} style={[styles.sectionHint, styles.textSecondary]}>
            {goEasyNotice(options)}
          </Text>
          <PillRow style={styles.mt12}>
            {areas.map((area) => {
              const blocked = isAreaBlocked(answers, area);
              return (
                <OptionPill
                  key={area.id}
                  testID={`generator-go-easy-${area.id}`}
                  label={goEasyAreaLabel(area)}
                  selected={(answers.go_easy_area_ids ?? []).includes(area.id)}
                  disabled={blocked}
                  accessibilityRole="togglebutton"
                  accessibilityHint={pillHint(COPY.goEasyLabel, blocked ? areaBlockHint : '')}
                  onPress={() => setAnswers((current) => toggleGoEasyArea(current, area))}
                />
              );
            })}
          </PillRow>
          <BlockHint testID="generator-go-easy-block-hint" text={areaBlockHint} />
        </View>
      ) : null}
      <View>
        <Text {...BODY_TEXT} style={styles.sectionLabel}>
          {COPY.exercisesToAvoid}
        </Text>
        <AvoidSearch
          exclusions={answers.exclusions}
          onChoose={(exercise) => setAnswers((current) => ({ ...current, exclusions: addExclusion(current.exclusions, exercise) }))}
        />
        {answers.exclusions.length ? (
          <View style={[styles.avoidList, styles.mt12]}>
            {answers.exclusions.map((item) => (
              <View
                key={item.exercise?.id}
                testID={`generator-avoid-${item.exercise?.id}`}
                style={[styles.avoidRow, reflow && styles.avoidRowStacked]}
              >
                {/* §9: a user-facing name in a dense list may clip at 2 lines;
                    the full name stays in the accessibility label. */}
                <Text
                  {...BODY_TEXT}
                  numberOfLines={2}
                  accessibilityLabel={item.exercise?.name}
                  style={[styles.listRowText, styles.avoidName]}
                >
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
                  <Text maxFontSizeMultiplier={textScale.badge} style={styles.removeText}>
                    ×
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

// T-18 block hint: shown only while a block exists (mt 8). A polite live
// region: Android reads the region's change; iOS has none, so it announces.
function BlockHint({ text, testID }) {
  useEffect(() => {
    if (text && Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(text);
    }
  }, [text]);
  return (
    <View accessibilityLiveRegion="polite">
      {text ? (
        <Text testID={testID} {...BODY_TEXT} style={[styles.blockHint, styles.mt8]}>
          {text}
        </Text>
      ) : null}
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
        {...textInputColors}
        testID="generator-avoid-search"
        value={text}
        onChangeText={setText}
        placeholder={COPY.searchPlaceholder}
        placeholderTextColor={colors.textFaint}
        maxFontSizeMultiplier={textScale.body}
        accessibilityLabel={COPY.searchPlaceholder}
        autoCorrect={false}
        autoCapitalize="none"
        style={styles.search}
      />
      {searching ? (
        <Text {...BODY_TEXT} style={[styles.sectionHint, styles.mt8]}>
          {COPY.searching}
        </Text>
      ) : null}
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
              style={[styles.listRow, index > 0 && styles.divider]}
            >
              {({ pressed }) => (
                <>
                  <PressOverlay pressed={pressed} />
                  <Text {...BODY_TEXT} style={[styles.listRowText, styles.flex]}>
                    {item.name}
                  </Text>
                </>
              )}
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
  // G2: the part-failure card in the 640 content column.
  stateCard: {
    width: '100%',
    maxWidth: GENERATOR_STATE_MAX_WIDTH,
    alignSelf: 'center',
  },
  // v2 eyebrow rule (§D2): sentence case gold 13/600 (Typography Eyebrow is
  // gold 12/600; the board draws 13).
  eyebrow: {
    fontSize: 13,
    lineHeight: 18,
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
  // §G1.2 step 6 sections: gap 24, areas or not (FE ac21d959).
  stepSixColumn: {
    gap: 24,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...font(700),
    marginTop: 4,
    fontSize: 30,
    lineHeight: 36,
    color: colors.textPrimary,
  },
  optional: {
    ...font(400),
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
    ...font(700),
    fontSize: 14,
    lineHeight: 20,
    color: colors.gold,
  },
  // GeneratorReview board: 34 tall, padding 0 12, white 0.10 fill (→
  // hairline-strong), 13/600 text-primary; a 44 hit area.
  changePill: {
    alignSelf: 'flex-start',
    minHeight: CHANGE_PILL_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.hairlineStrong,
    overflow: 'hidden',
  },
  changeLabel: {
    ...font(600),
    fontSize: 13,
    lineHeight: 18,
    color: colors.textPrimary,
  },
  pressOverlay: {
    backgroundColor: colors.pressOverlay,
  },
  listCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
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
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  listRowText: {
    ...font(700),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  alwaysIncluded: {
    ...font(600),
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  sectionLabel: {
    ...font(700),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  sectionHint: {
    ...font(400),
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  textSecondary: {
    color: colors.textSecondary,
  },
  blockHint: {
    ...font(400),
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  // TabletGenerator board: the 52 search pill on surface-well, white
  // 0.10 edge, 16/20 text; min-height so large text grows it.
  search: {
    ...font(400),
    minHeight: 52,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surfaceWell,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    lineHeight: 20,
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
    // TabletGenerator board: fill-subtle 0.04 + hairline 0.07, radius 20.
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.fillWell,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  // §9 reflow: the reason pills and remove drop below the name.
  avoidRowStacked: {
    flexDirection: 'column',
    alignItems: 'flex-start',
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
    ...font(700),
    fontSize: 20,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  // GeneratorReview board: surface cards on a hairline 0.07 edge.
  reviewCard: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  // §9 reflow: "Change" drops below the answer.
  reviewRowStacked: {
    flexDirection: 'column',
  },
  // GeneratorStates/GeneratorReview boards: question 13 text-muted (sentence
  // case, never tracked caps), answer 15/600, field error 13 danger-text.
  reviewQuestion: {
    ...font(400),
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  reviewSummary: {
    ...font(600),
    marginTop: 4,
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  reviewError: {
    ...font(400),
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: colors.dangerText,
  },
  // GeneratorReview board: white 0.05 fill (→ fill-subtle 0.04) + 0.06 edge
  // (→ hairline 0.07), radius 20, 14/22 text-secondary.
  disclaimer: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.fillWell,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  disclaimerText: {
    ...font(400),
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  mt8: {
    marginTop: 8,
  },
  mt12: {
    marginTop: 12,
  },
});
