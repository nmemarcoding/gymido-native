import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View, findNodeHandle, useWindowDimensions } from 'react-native';

import { getServerMessage, getStatus } from '../../../shared/api/apiError';
import ErrorAlert from '../../../shared/components/ErrorAlert';
import { InlineError } from '../../../shared/components/FeedbackBox';
import IconButton from '../../../shared/components/IconButton';
import { NAME_TEXT } from '../../../shared/components/largeText';
import Loader from '../../../shared/components/Loader';
import PillButton, { BUTTON_HEIGHTS } from '../../../shared/components/PillButton';
import PinnedDock, { dockButtonsHeight, dockStacks } from '../../../shared/components/PinnedDock';
import { useFocusRemountKey } from '../../../shared/hooks/useFocusRemountKey';
import { colors, font, radii, spacing, titleTracking } from '../../../shared/theme/tokens';
import ShellPage from '../../shell/ShellPage';
import { openShellPath } from '../../shell/shellLinks';
import { useInnerBack } from '../../shell/useInnerBack';
import { getGeneratorProfile, saveGeneratorProfile } from '../api/generatorApi';
import FocusAvoidStep from '../components/FocusAvoidStep';
import { Checkbox, Choice, ChoiceList, OptionPill, PillRow, ProgressSegments } from '../components/GeneratorControls';
import { ArrowRightIcon, ChevronLeftIcon, CloseIcon, GoalIcon } from '../components/GeneratorIcons';
import GeneratorReview, { ReviewButtons } from '../components/GeneratorReview';
import { GENERATOR_STATE_MAX_WIDTH, GeneratorUnavailable } from '../components/GeneratorStates';
import { leaveToPlans, sitsAbovePreview, useLeaveOnBack } from '../generatorExit';
import {
  COPY,
  QUESTIONS,
  RADIO_GROUP_LABELS,
  STEP_COUNT,
  bandLabel,
  daysPillLabel,
  goalLabel,
  minutesPillLabel,
  presetLabel,
  stepEyebrow,
  stepFraction,
} from '../generatorCopy';
import { BODY_TEXT, DISPLAY_TEXT, FOCUS_DELAY_MS, PAGE_TITLE_TEXT, PressOverlay, isReflow, isTabletWidth } from '../generatorLayout';
import {
  answersFromProfile,
  buildProfileBody,
  choosePreset,
  deepLinkStep,
  goEasyAreasOf,
  isStepAnswered,
  optionCode,
  rememberExercises,
  step6NextLabel,
  stepErrorsFrom422,
  toggleId,
} from '../generatorLogic';
import { generatorRoutes } from '../generatorRoutes';

// Kept for callers/tests that import it from here.
export { isReflow };

const REVIEW = STEP_COUNT + 1;

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

// Where the phone step buttons go (UX J + §9 addendum): pinned in the shared
// dock above the tab bar (60 CTA, as drawn) while it fits one row; in the
// flow on tablets and at large text. UX native final audit 27 Oct 2026,
// ruling 1 (B237): step 6 is pinned too (was in the flow for the keyboard
// rule; the dock sits at the screen bottom, so the keyboard covers it and it
// never floats over the results). The Review follows the same rule (B242).
export function stepBarPlacement({ step, tablet, reflow }) {
  return !tablet && !reflow && step >= 1 && step <= STEP_COUNT ? 'pinned' : 'flow';
}

// G1 (RN-SPEC-PLAN-GENERATOR §G1). Every focus remounts and reloads (§8.1).
// The questionnaire's state lives ABOVE ShellPage, so a live text-size change
// (ShellPage remounts its content) keeps the answers.
export default function PlanGeneratorScreen() {
  const remountKey = useFocusRemountKey();
  return <PlanGenerator key={remountKey} />;
}

const GOAL_TONES = Object.freeze({ GENERAL_FITNESS: 'teal' });

function PlanGenerator() {
  const navigation = useNavigation();
  // T-65 (PHONE-NAV spec §3, PM correction 27 Oct 2026): no extra pill here;
  // step 1's ✕ Cancel (top row + dock) is the exit: back in history, else
  // REPLACE to Plans; Android back the same.
  // G1 (PM 28 Oct): opened from the preview, the ✕ / Cancel and Android back
  // (any step) reset the stack to Plans instead (no step ↔ preview loop).
  const abovePreview = sitsAbovePreview(navigation);
  const innerBack = useInnerBack(navigation, abovePreview ? null : '/plans');
  useLeaveOnBack(navigation, abovePreview);
  const exit = abovePreview ? () => leaveToPlans(navigation) : innerBack;
  const route = useRoute();
  const { width, fontScale } = useWindowDimensions();
  const reflow = isReflow(fontScale);
  const tablet = isTabletWidth(width);
  const [load, setLoad] = useState({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const [options, setOptions] = useState(null);
  const [answers, setAnswers] = useState(() => answersFromProfile(null));
  const [step, setStep] = useState(1);
  const [editingEquipment, setEditingEquipment] = useState(false);
  // UX N4: exercises already loaded on the client (search results), by id.
  const [knownExercises, setKnownExercises] = useState({});
  // A preview 422 (go_easy_area_ids) hands its field errors over with the
  // deep link (`stepErrors` route param), read once on mount.
  const [stepErrors, setStepErrors] = useState(() => initialStepErrors(route.params?.stepErrors));
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const mounted = useRef(true);
  // T-18 deep link: the `step` route param, read once on mount.
  const deepStep = useRef(deepLinkStep(route.params?.step));
  // A counter: every bump moves the focus once (deep link, step change).
  const [focusHeading, setFocusHeading] = useState(0);
  const headingRef = useRef(null);
  // G1.3 (27 Oct): the Review opens at the top with its title focused.
  const reviewTitleRef = useRef(null);
  const scrollRef = useRef(null);
  const stepErrorRef = useRef(null);
  // The pinned dock's live height (re-measured on every layout, never cached;
  // null until measured). ShellPage keeps exactly this much scroll room.
  const [barHeight, setBarHeight] = useState(null);
  // Below 21rem the docked pair stacks (ruling 1).
  const narrow = dockStacks(width);

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
          if (deepStep.current !== null) {
            setFocusHeading((value) => value + 1);
          }
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
      // PM parity (26 Oct): preview → step 6 with a 422 focuses the error.
      const node = findNodeHandle(stepErrorRef.current ?? reviewTitleRef.current ?? headingRef.current);
      if (node) {
        AccessibilityInfo.setAccessibilityFocus(node);
      }
    }, FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [focusHeading, load.status]);

  let content;
  let pinnedBar = null;
  if (load.status === 'loading') {
    content = <Loader label={COPY.loadingQuestions} style={styles.loader} />;
  } else if (load.status === 'unavailable') {
    content = <GeneratorUnavailable onBack={() => openShellPath('/plans')} />;
  } else if (load.status === 'error') {
    // G2: Retry only for network/server errors; 403 (a member with a trainer) none.
    content = (
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
  } else {
    const update = (patch) => setAnswers((current) => ({ ...current, ...patch }));
    // UX J a11y: the heading takes the focus on every step change.
    const goTo = (next) => {
      setStep(next);
      setFocusHeading((value) => value + 1);
      // G1.3: arriving on the Review scrolls the page to y 0 (it used to keep
      // step 6's scroll position and could open mid-page).
      if (next === REVIEW) {
        scrollRef.current?.scrollTo?.({ y: 0, animated: false });
      }
    };

    // §G1.5
    const handleSave = async () => {
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
    };

    if (step === REVIEW) {
      const reviewPinned = stepBarPlacement({ step: STEP_COUNT, tablet, reflow }) === 'pinned';
      if (reviewPinned) {
        pinnedBar = (
          <PinnedDock testID="generator-review-bar" onHeight={setBarHeight} contentStyle={styles.dockContent} estimate={dockButtonsHeight({ rows: narrow ? 2 : 1 })}>
            <ReviewButtons saving={saving} stacked={narrow} onBack={goTo} onSave={handleSave} />
          </PinnedDock>
        );
      }
      content = (
        <GeneratorReview
          answers={answers}
          options={options}
          stepErrors={stepErrors}
          saveError={saveError}
          saving={saving}
          reflow={reflow}
          knownExercises={knownExercises}
          onChange={goTo}
          onBack={goTo}
          onSave={handleSave}
          titleRef={reviewTitleRef}
          buttonsPinned={reviewPinned}
        />
      );
    } else {
      const placement = stepBarPlacement({ step, tablet, reflow });
      const secondary =
        step === 1
          ? { testID: 'generator-cancel', title: COPY.cancel, onPress: exit }
          : { testID: 'generator-back', title: COPY.back, onPress: () => goTo(step - 1) };
      const primary = {
        testID: 'generator-next',
        title: step === STEP_COUNT ? step6NextLabel(answers) : COPY.next,
        disabled: !isStepAnswered(answers, step),
        onPress: () => goTo(step + 1),
      };
      const pinned = placement === 'pinned';
      const stacked = reflow || (pinned && narrow);
      const buttons = (
        <StepButtons secondary={secondary} primary={primary} tablet={tablet} reflow={stacked} size={pinned && !stacked ? 'cta' : 'default'} />
      );
      if (pinned) {
        pinnedBar = (
          <PinnedDock
            testID="generator-step-bar"
            onHeight={setBarHeight}
            contentStyle={styles.dockContent}
            estimate={stacked ? dockButtonsHeight({ rows: 2 }) : dockButtonsHeight({ buttonHeight: BUTTON_HEIGHTS.cta })}
          >
            {buttons}
          </PinnedDock>
        );
      }
      content = (
        <View style={[styles.column, tablet && styles.columnTablet]}>
          {!tablet ? (
            <TopRow
              step={step}
              onPress={secondary.onPress}
            />
          ) : null}
          <ProgressSegments step={step} total={STEP_COUNT} tablet={tablet} label={stepEyebrow(step)} />
          {/* G3: the step error sits above the question and is read before the eyebrow. */}
          {stepErrors[step] ? (
            <InlineError ref={stepErrorRef} testID="generator-step-error" title={COPY.stepError} message={stepErrors[step]} />
          ) : null}
          <View testID="generator-title-block" style={[styles.titleBlock, tablet && styles.titleBlockTablet]}>
            <View style={styles.flex}>
              <Text {...BODY_TEXT} testID="generator-step-eyebrow" style={[styles.eyebrow, tablet && styles.eyebrowTablet]}>
                {stepEyebrow(step)}
              </Text>
              <Text
                ref={headingRef}
                testID="generator-step-title"
                {...PAGE_TITLE_TEXT}
                accessibilityRole="header"
                style={[styles.title, tablet && styles.titleTablet, step === STEP_COUNT && !tablet && styles.titleStep6]}
              >
                {QUESTIONS[step - 1]}
              </Text>
              {step === STEP_COUNT ? (
                <Text {...BODY_TEXT} style={[styles.optional, tablet && styles.optionalTablet]}>
                  {COPY.optional}
                </Text>
              ) : null}
            </View>
            {/* The ghost numeral (phone only; decoration, hidden from readers). */}
            {!tablet && !reflow ? (
              <Text
                testID="generator-ghost-numeral"
                {...DISPLAY_TEXT}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={styles.ghost}
              >
                {stepFraction(step)}
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
            tablet={tablet}
            reflow={reflow}
            knownExercises={knownExercises}
            onResults={(items) => setKnownExercises((current) => rememberExercises(current, items))}
          />
          {step === 1 && !tablet ? (
            <Text testID="generator-step1-hint" {...BODY_TEXT} style={styles.hint}>
              {COPY.step1Hint}
            </Text>
          ) : null}
          {placement === 'flow' ? <View style={tablet ? styles.buttonsTabletTop : null}>{buttons}</View> : null}
        </View>
      );
    }
  }

  return (
    <View style={styles.screen}>
      {/* UX native final audit 27 Oct 2026, ruling 1: the scroll room = the dock's measured height. */}
      <ShellPage testID="plan-generator-screen" scrollRef={scrollRef} dockHeight={pinnedBar ? barHeight : null}>
        <View style={styles.page}>{content}</View>
      </ShellPage>
      {pinnedBar}
    </View>
  );
}

// PlanGenerator board top row (phone only): the 44 glass icon button (✕
// "Cancel" on step 1, ‹ "Back" after), "Build me a plan" 14/600 secondary,
// centred, and a 44 spacer.
function TopRow({ step, onPress }) {
  const first = step === 1;
  return (
    <View testID="generator-top-row" style={styles.topRow}>
      <IconButton testID="generator-top-back" accessibilityLabel={first ? COPY.cancel : COPY.back} onPress={onPress}>
        {({ color }) => (first ? <CloseIcon size={18} color={color} /> : <ChevronLeftIcon size={20} color={color} />)}
      </IconButton>
      <Text {...BODY_TEXT} style={styles.topTitle}>
        {COPY.entryTitle}
      </Text>
      <View style={styles.topSpacer} />
    </View>
  );
}

// The step's secondary (Cancel/Back) + primary (Next/Skip →) pair. Phone: a
// row, the primary taking the rest (gap 10); tablet: right-aligned (gap 12);
// §9 reflow: stacked full width, primary on top.
function StepButtons({ secondary, primary, tablet, reflow, size }) {
  const arrow = ({ color }) => <ArrowRightIcon size={18} color={color} />;
  const second = (
    <PillButton key="secondary" variant="secondary" size={size} fullWidth={reflow} testID={secondary.testID} title={secondary.title} onPress={secondary.onPress} />
  );
  const first = (
    <PillButton
      key="primary"
      size={size}
      fullWidth={reflow}
      style={!reflow && !tablet ? styles.flex : null}
      testID={primary.testID}
      title={primary.title}
      disabled={primary.disabled}
      icon={arrow}
      onPress={primary.onPress}
    />
  );
  return (
    <View testID="generator-buttons" style={[styles.buttons, tablet && styles.buttonsTablet, reflow && styles.buttonsStacked]}>
      {reflow ? [first, second] : [second, first]}
    </View>
  );
}

function StepBody({ step, answers, options, update, setAnswers, editingEquipment, setEditingEquipment, tablet, reflow, knownExercises, onResults }) {
  const opts = options ?? {};
  switch (step) {
    case 1:
      return (
        <ChoiceList label={RADIO_GROUP_LABELS[1]} testID="generator-goals">
          {(opts.goals ?? []).map((option) => {
            const code = optionCode(option);
            return (
              <Choice
                key={code}
                testID={`generator-goal-${code}`}
                label={goalLabel(code)}
                selected={answers.goal === code}
                renderIcon={({ color }) => <GoalIcon code={code} size={24} color={color} />}
                iconTone={GOAL_TONES[code]}
                onPress={() => update({ goal: code })}
              />
            );
          })}
        </ChoiceList>
      );
    case 2:
      return (
        <ChoiceList label={RADIO_GROUP_LABELS[2]} testID="generator-bands">
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
        <PillRow label={RADIO_GROUP_LABELS[3]} gap={spacing['2_5']} testID="generator-days">
          {(opts.days_per_week ?? []).map((n) => (
            <OptionPill
              key={n}
              size="large"
              accessibilityRole="radio"
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
        <PillRow label={RADIO_GROUP_LABELS[4]} gap={spacing['2_5']} testID="generator-minutes">
          {(opts.session_minutes ?? []).map((n) => (
            <OptionPill
              key={n}
              size="large"
              accessibilityRole="radio"
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
      return (
        <FocusAvoidStep
          answers={answers}
          options={opts}
          setAnswers={setAnswers}
          tablet={tablet}
          reflow={reflow}
          knownExercises={knownExercises}
          onResults={onResults}
        />
      );
  }
}

// §G1.2 step 5
function EquipmentStep({ answers, options, setAnswers, editing, setEditing }) {
  // Server order, never re-sorted.
  const equipment = options.equipment ?? [];
  return (
    <View style={styles.stepColumn}>
      <ChoiceList label={RADIO_GROUP_LABELS[5]} testID="generator-presets">
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
                    {({ pressed }) => (
                      <>
                        <PressOverlay pressed={pressed} />
                        <Text {...NAME_TEXT} style={[styles.listRowText, styles.flex]}>
                          {item.name}
                        </Text>
                        <Checkbox checked={checked} />
                      </>
                    )}
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  // Phone: the content column; tablet: the 640 column (the board's 634).
  page: {
    width: '100%',
    maxWidth: GENERATOR_STATE_MAX_WIDTH,
    alignSelf: 'center',
  },
  loader: {
    paddingVertical: 48,
  },
  // G2: the part-failure card in the 640 content column.
  stateCard: {
    width: '100%',
    maxWidth: GENERATOR_STATE_MAX_WIDTH,
    alignSelf: 'center',
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  // PlanGenerator board: column gap 16; TabletGenerator: gap 22.
  column: {
    gap: spacing[4],
  },
  columnTablet: {
    gap: spacing['5_5'],
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  topTitle: {
    ...font(600),
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  topSpacer: {
    width: 44,
  },
  titleBlock: {
    marginTop: spacing[3],
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  titleBlockTablet: {
    marginTop: 0,
  },
  // Sentence case gold 14/600 (phone), 15/600 (tablet).
  eyebrow: {
    ...font(600),
    fontSize: 14,
    lineHeight: 20,
    color: colors.gold,
  },
  eyebrowTablet: {
    fontSize: 15,
  },
  // Drawn 46/44/700 −0.05em (phone; display-md is 44/44: drawn size used).
  title: {
    ...font(700),
    marginTop: spacing[2],
    fontSize: 46,
    lineHeight: 44,
    letterSpacing: titleTracking(46, -0.05),
    color: colors.textPrimary,
  },
  // PlanGeneratorGoEasy410: step 6 at 42/42.
  titleStep6: {
    fontSize: 42,
    lineHeight: 42,
    letterSpacing: titleTracking(42, -0.05),
  },
  // TabletGenerator: 60/60/700 −0.055em (display-lg is 52: drawn size used).
  titleTablet: {
    marginTop: spacing['2_5'],
    fontSize: 60,
    lineHeight: 60,
    letterSpacing: titleTracking(60, -0.055),
  },
  // The ghost numeral: 64/56/700 −0.06em tabular, gold 0.22 drawn → gold-line 0.30.
  ghost: {
    ...font(700),
    fontSize: 64,
    lineHeight: 56,
    letterSpacing: titleTracking(64, -0.06),
    fontVariant: ['tabular-nums'],
    color: colors.goldLine,
  },
  optional: {
    ...font(400),
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  optionalTablet: {
    marginTop: spacing['2_5'],
    fontSize: 16,
    lineHeight: 22,
  },
  hint: {
    ...font(400),
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  stepColumn: {
    gap: spacing[4],
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing['2_5'],
  },
  buttonsTablet: {
    justifyContent: 'flex-end',
    gap: spacing[3],
  },
  buttonsTabletTop: {
    marginTop: spacing[2],
  },
  buttonsStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  // The docked pair keeps the phone's 16 sides (the dock is edge to edge).
  dockContent: {
    paddingHorizontal: spacing[4],
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
  mt8: {
    marginTop: 8,
  },
});
