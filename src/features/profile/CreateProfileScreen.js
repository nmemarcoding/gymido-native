import { useNavigation } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  BackHandler,
  Easing,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  findNodeHandle,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { routes } from '../../navigation/routes';
import { resolveLanding } from '../../navigation/resolveLanding';
import { getServerMessage, getStatus } from '../../shared/api/apiError';
import DateInput from '../../shared/components/DateInput';
import { InlineError } from '../../shared/components/FeedbackBox';
import FormField, { FieldFrame } from '../../shared/components/FormField';
import GradientFill from '../../shared/components/GradientFill';
import IconButton from '../../shared/components/IconButton';
import PillButton from '../../shared/components/PillButton';
import { AmbientGlow } from '../../shared/components/Screen';
import SegmentedSwitch from '../../shared/components/SegmentedSwitch';
import { useKeyboardOverlap } from '../../shared/hooks/useKeyboardHeight';
import { useReducedMotion } from '../../shared/hooks/useReducedMotion';
import { breakpoints, colors, font, gradients, motion, radii, spacing, textScale, titleTracking, typography } from '../../shared/theme/tokens';
import { useAuthStore } from '../auth/authStore';
import { getGeneratorProfile } from '../planGenerator/api/generatorApi';
import { OptionPill, PillRow, ProgressSegments } from '../planGenerator/components/GeneratorControls';
import { CheckIcon, ChevronLeftIcon } from '../planGenerator/components/GeneratorIcons';
import { FOCUS_DELAY_MS } from '../planGenerator/generatorLayout';
import { getScreenTab } from '../shell/shellNavigation';
import StatusBarBackdrop from '../shell/StatusBarBackdrop';
import { createProfile } from './api/profileApi';
import DeleteAccountAction from './DeleteAccountAction';
import { fetchProfile, setCreatedProfile, useProfileStore } from './profileStore';
import { weightPairStacks } from './weightPairLayout';
import {
  INITIAL_PROFILE_FORM,
  PROFILE_STEP_COUNT,
  SEX_OPTIONS,
  aboutYouEmpty,
  buildCreateProfilePayload,
  clearFieldErrors,
  fieldsOfStep,
  firstErrorTarget,
  numberValue,
  stepOfFirstError,
  updateHeightUnit,
  validateCreateProfile,
  validateStep,
  weightsEmpty,
} from './createProfileForm';

const EASE_OUT = Easing.bezier(0, 0, 0.58, 1);

// Board order ft/in · cm · in (ND1, PM 26 Oct 2026).
export const HEIGHT_UNITS = [
  { value: 'ft_in', label: 'ft/in', testID: 'profile-height-unit-ft_in' },
  { value: 'cm', label: 'cm', testID: 'profile-height-unit-cm' },
  { value: 'in', label: 'in', testID: 'profile-height-unit-in' },
];
export const WEIGHT_UNITS = [
  { value: 'lb', label: 'lb', testID: 'profile-weight-unit-lb' },
  { value: 'kg', label: 'kg', testID: 'profile-weight-unit-kg' },
];
// T-53 P4: the four pills; nothing selected = "Not set" (sent as null, D2).
const SEX_PILLS = SEX_OPTIONS.filter((option) => option.value !== '');

const NUMBER_FIELDS = ['height_value', 'height_feet', 'height_inches', 'current_weight_value', 'goal_weight_value'];
const NUMBER_KEYBOARD = Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric';
// T-16: a decimal keypad for the weights.
const WEIGHT_FIELDS = ['current_weight_value', 'goal_weight_value'];
const NO_AUTOFILL = { autoComplete: 'off', textContentType: 'none', importantForAutofill: 'no' };
// Batch k: the gold caret and selection on every input.
const GOLD_CARET = { selectionColor: colors.gold, cursorColor: colors.gold };
const HEIGHT_HELPER = 'Feet and inches are shown first. Switch to cm or inches if that is how you measure height.';

// The single Height field's placeholders, as on web (no other field has one).
export const PROFILE_PLACEHOLDERS = Object.freeze({
  height_cm: '180',
  height_in: '71',
});

// T-53 open UX answers (29 Oct 2026), one spot each:
// Q1 the step title: the generator's step title size (46 phone / 60 tablet,
//    titlePhone / titleTablet below), at most 2 lines, wrapping between words
//    (a single long word shrinks, never breaks).
const TITLE_MAX_LINES = 2;
// Q2 the tablet brand row stays (the phone has the top icon-button row).
const TABLET_BRAND_ROW = true;
// Q3 Date of birth above the Sex pills at every width.
const DOB_ABOVE_SEX = true;
// Q5 UX (29 Oct): no "In lb." / "In kg." on P3 (Edit profile keeps them).
const WEIGHT_UNIT_HELPERS = false;
// Q7 the height segments: the kit's 40 inside a 44 hit area (SegmentedSwitch
// default size; nothing to set here).

// §9: titles cap at 1.3 and wrap by word; body copy and inputs scale to 2.0.
const TITLE = {
  numberOfLines: TITLE_MAX_LINES,
  adjustsFontSizeToFit: true,
  minimumFontScale: 0.7,
  textBreakStrategy: 'simple',
  maxFontSizeMultiplier: textScale.display,
};
const BODY = { maxFontSizeMultiplier: textScale.body };
const BADGE = { maxFontSizeMultiplier: textScale.badge };
// P10 moot: every field label is text-strong-2 (13/500 per the board).
const LABEL = { color: colors.textStrong2 };

// The fields a failed step can focus (a TextInput takes the keyboard focus;
// the rest get accessibility focus).
const TEXT_TARGETS = ['first_name', 'last_name', 'height_value', 'height_feet', 'height_inches', 'current_weight_value', 'goal_weight_value'];

// T-53 B: the bridge is a state of this screen (after P4 saves).
const BRIDGE = 'bridge';
// §5 large text: the pinned bar goes in flow past 40 % of the screen.
const BAR_MAX_SHARE = 0.4;
// §3 P3: the weight pair stacks below 360 at any text size.
const WEIGHTS_STACK_BELOW = 360;

const COPY = Object.freeze({
  titles: ['What should we call you?', 'How tall are you?', 'What do you weigh?', 'A bit about you'],
  helpers: [null, null, 'Optional. It helps you track progress.', 'Optional. This stays private.'],
  stepOf: (step) => `Step ${step} of ${PROFILE_STEP_COUNT}`,
  next: 'Next',
  skip: 'Skip',
  back: 'Back',
  create: 'Create profile',
  saving: 'Saving…',
  checkAnswer: 'Please check this answer',
  exists: 'A profile already exists for this account.',
  saved: 'Profile saved',
  bridgeTitle: 'Want us to build your first plan?',
  bridgeBody: "Answer 6 quick questions and we'll put together a plan for your goal, schedule and equipment. You'll see it before anything starts.",
  bridgeTitleBrowse: 'Find your first plan',
  bridgeBodyBrowse: 'Pick a ready-made plan to get your weekly schedule and guided workouts.',
  build: 'Build my plan',
  browse: 'Browse plans',
  notNow: 'Not now',
});

// RN-SPEC-profile-create, T-53 (onboarding ruling, 29 Oct 2026): four steps,
// P1 names → P2 height → P3 weights (optional) → P4 date of birth + sex
// (optional; saves) → B the bridge. The answers live in memory only: Back
// keeps them, quitting midway keeps nothing.
export default function CreateProfileScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  // Batch k (PM, 27 Oct 2026): what the keyboard COVERS; the raw height
  // leaves out the Android nav bar under an edge-to-edge window.
  const keyboardHeight = useKeyboardOverlap();
  const { width, height: windowHeight, fontScale } = useWindowDimensions();
  // §9 reflow (live): the 2-column pairs become one column and the weight
  // unit switch drops below its label.
  const reflow = fontScale > textScale.reflowAbove;
  // The layout is fixed at mount: the phone bar's fade is a gradient, and a
  // gradient is never added on a later change (Android render rule).
  const [tablet] = useState(() => width >= breakpoints.md);
  const reducedMotion = useReducedMotion();
  const enter = useRef(new Animated.Value(0)).current;
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(INITIAL_PROFILE_FORM);
  // What each number input shows; state keeps only valid numbers (§3.4).
  const [display, setDisplay] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  // The InlineError above the title: { title?, message }.
  const [banner, setBanner] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  // B: whether the generator is open to this member (§0).
  const [canBuild, setCanBuild] = useState(false);
  const [barHeight, setBarHeight] = useState(0);
  // §5: once the pinned bar is too tall it stays in flow (no gradient comes back).
  const [barInFlow, setBarInFlow] = useState(false);
  // ⚠P9 retired: the synchronous lock (state alone lets a second tap in
  // before the re-render); `submitting` drives the look.
  const locked = useRef(false);
  // The saved profile, committed to the store when a B button is pressed.
  const created = useRef(null);
  // ⚠P8 retired: one request per failed step, run after the errors render.
  const [focusRequest, setFocusRequest] = useState(null);
  // §2: every step change moves the accessibility focus to the title.
  const [focusTitle, setFocusTitle] = useState(0);
  const targets = useRef({});
  const scrollRef = useRef(null);
  const formRef = useRef(null);
  const titleRef = useRef(null);
  const bindTarget = (key) => (node) => {
    targets.current[key] = node;
  };
  const contentTop = insets.top + (tablet ? 64 : spacing[6]);

  // §2 motion: a 200 ms cross-fade + 8 px slide on every step; Reduce Motion
  // = an instant swap.
  useEffect(() => {
    if (reducedMotion) {
      enter.setValue(1);
      return undefined;
    }
    enter.setValue(0);
    const animation = Animated.timing(enter, { toValue: 1, duration: motion.durationBase, easing: EASE_OUT, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [enter, reducedMotion, step]);

  // Brings the field into view, then focuses it.
  useEffect(() => {
    const node = focusRequest ? targets.current[focusRequest.target] : null;
    if (!node) {
      return;
    }
    node.measureLayout?.(
      formRef.current,
      (_x, y) => scrollRef.current?.scrollTo?.({ y: Math.max(0, y + contentTop - spacing[4]), animated: !reducedMotion }),
      () => {}
    );
    if (TEXT_TARGETS.includes(focusRequest.target)) {
      node.focus?.();
    } else {
      AccessibilityInfo.sendAccessibilityEvent(node, 'focus');
    }
    // contentTop and reducedMotion are read at the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest]);

  // The first field is never auto-focused (no keyboard jump over the title).
  useEffect(() => {
    if (!focusTitle) {
      return undefined;
    }
    scrollRef.current?.scrollTo?.({ y: 0, animated: false });
    const timer = setTimeout(() => {
      const node = titleRef.current ? findNodeHandle(titleRef.current) : null;
      if (node) {
        AccessibilityInfo.setAccessibilityFocus(node);
      }
    }, FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [focusTitle]);

  // §1 Android back: P2–P4 = Back; P1 and B do nothing (no exit, as before).
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (navigation?.isFocused && !navigation.isFocused()) {
        return false;
      }
      if (typeof step === 'number' && step > 1 && !locked.current) {
        goTo(step - 1);
      }
      return true;
    });
    return () => subscription.remove();
  }, [navigation, step]);

  const shown = (key) => (key in display ? display[key] : String(form[key] ?? ''));

  // ⚠P12 retired 27 Oct 2026: a change clears that field's error (height
  // inputs and the unit together, the Weight unit its unit errors).
  function edit(key, change) {
    if (locked.current) {
      return;
    }
    setFieldErrors((current) => clearFieldErrors(current, key));
    change();
  }

  function setText(key, text) {
    if (locked.current) {
      return;
    }
    setFieldErrors((current) => clearFieldErrors(current, key));
    if (NUMBER_FIELDS.includes(key) && !WEIGHT_FIELDS.includes(key)) {
      setDisplay((current) => ({ ...current, [key]: text }));
      setForm((current) => ({ ...current, [key]: numberValue(text) }));
    } else {
      setForm((current) => ({ ...current, [key]: text }));
    }
  }

  // A programmatic change shows String(value) again.
  function changeHeightUnit(unit) {
    if (locked.current || unit === form.height_unit) {
      return;
    }
    setFieldErrors((current) => clearFieldErrors(current, 'height_unit'));
    setForm((current) => updateHeightUnit(current, unit));
    setDisplay((current) => {
      const next = { ...current };
      delete next.height_value;
      delete next.height_feet;
      delete next.height_inches;
      return next;
    });
  }

  // §3 P4: tapping the selected pill clears it ("Not set").
  function toggleSex(value) {
    edit('sex', () => setForm((current) => ({ ...current, sex: current.sex === value ? '' : value })));
  }

  function goTo(next) {
    setBanner(null);
    setStep(next);
    setFocusTitle((value) => value + 1);
  }

  // ⚠P8 retired 27 Oct 2026: focus the first field in error, once per press.
  function focusFirstError(errors) {
    const target = firstErrorTarget(errors, form.height_unit);
    if (target) {
      setFocusRequest({ target });
    }
  }

  // §2/§4: the primary runs this step's rules; P4 saves.
  function primary() {
    if (locked.current) {
      return;
    }
    if (step === PROFILE_STEP_COUNT) {
      save();
      return;
    }
    const errors = validateStep(form, step);
    const stepKeys = fieldsOfStep(step);
    // This step's errors are re-run; the other steps keep theirs (a 422).
    setFieldErrors((current) => ({ ...Object.fromEntries(Object.entries(current).filter(([key]) => !stepKeys.includes(key))), ...errors }));
    if (Object.keys(errors).length > 0) {
      setBanner(null);
      focusFirstError(errors);
      return;
    }
    goTo(step + 1);
  }

  // The store commit + the navigation happen together (B buttons, the 403
  // and trainer destinations).
  function enterApp(screen) {
    setCreatedProfile(created.current);
    navigation.reset({
      index: 0,
      routes: [{ name: routes.AppShell, params: { screen: getScreenTab(screen.name), params: { screen: screen.name, params: screen.params } } }],
    });
  }

  // §0: after the 201 (or a 409's reload) the destination is decided once.
  // The primary keeps its spinner meanwhile.
  async function decide(profile) {
    created.current = profile;
    const { user, workspace } = useAuthStore.getState();
    const landing = resolveLanding({ roles: user?.roles ?? [], workspace });
    if (landing.name === routes.TrainerDashboard) {
      enterApp(landing);
      return;
    }
    let available = false;
    try {
      available = (await getGeneratorProfile())?.available === true;
    } catch (error) {
      // A coached member: their trainer assigns the plan (no bridge).
      if (getStatus(error) === 403) {
        enterApp({ name: routes.Home });
        return;
      }
    }
    setCanBuild(available);
    locked.current = false;
    setSubmitting(false);
    goTo(BRIDGE);
  }

  async function save() {
    setBanner(null);
    const errors = validateCreateProfile(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setStep(stepOfFirstError(errors) ?? PROFILE_STEP_COUNT);
      focusFirstError(errors);
      return;
    }
    // ⚠P9 retired 27 Oct 2026: everything locks until the request settles.
    locked.current = true;
    setSubmitting(true);
    try {
      await decide(await createProfile(buildCreateProfilePayload(form)));
    } catch (error) {
      const status = getStatus(error);
      if (status === 409) {
        // ⚠P7 retired 27 Oct 2026: a 409 counts as success. Reload the
        // profile (the store's GET /profile) and go on like a create; only
        // a failed reload shows the message. Still locked meanwhile.
        await fetchProfile();
        const existing = useProfileStore.getState().profile;
        if (existing) {
          await decide(existing);
          return;
        }
        setBanner({ message: COPY.exists });
      } else {
        setBanner({ title: status === 422 ? COPY.checkAnswer : undefined, message: getServerMessage(error) });
      }
      const serverErrors = error?.response?.data?.errors ?? {};
      const next = {};
      for (const key of Object.keys(serverErrors)) {
        const messages = serverErrors[key];
        next[key] = (Array.isArray(messages) ? messages[0] : messages) || '';
      }
      setFieldErrors(next);
      locked.current = false;
      setSubmitting(false);
      // §4 422: the step that owns the first error key, its first field focused.
      const owner = stepOfFirstError(next);
      if (owner) {
        setStep(owner);
      }
      focusFirstError(next);
    }
  }

  // ⚠P9 retired: SegmentedSwitch has no disabled prop (kit need), so its
  // wrapper takes no touches and shows the kit's disabled 0.5.
  const lock = (testID, child) => (
    <View testID={testID} pointerEvents={submitting ? 'none' : 'auto'} style={submitting ? styles.locked : null}>
      {child}
    </View>
  );

  // §2: Return/Go in the last field of a step = the primary; elsewhere the
  // next field.
  const input = (key, { nextField, ...props }) => (
    <FormField
      ref={bindTarget(key)}
      testID={`profile-${key}`}
      value={shown(key)}
      error={fieldErrors[key]}
      onChangeText={(text) => setText(key, text)}
      returnKeyType={nextField ? 'next' : 'go'}
      onSubmitEditing={nextField ? () => targets.current[nextField]?.focus?.() : primary}
      editable={!submitting}
      accessibilityState={{ invalid: Boolean(fieldErrors[key]) }}
      labelStyle={LABEL}
      {...BODY}
      {...NO_AUTOFILL}
      {...GOLD_CARET}
      {...(NUMBER_FIELDS.includes(key) ? { keyboardType: WEIGHT_FIELDS.includes(key) ? 'decimal-pad' : NUMBER_KEYBOARD } : null)}
      {...props}
    />
  );
  // ND6: the phone's numbers are 64 tall at 32/700; tablet keeps the kit 52.
  // C2 (verdict b7a7867): React Native draws the placeholder in the input's
  // font, so while a phone number is empty it wears the placeholder look
  // (text-faint 400, kit 16) and the value style starts with the first digit.
  const number = (key, props) =>
    input(key, tablet ? props : { ...props, style: shown(key) === '' ? styles.bigInputEmpty : styles.bigInput });

  // §9: past 1.3 every 2-column pair is one column.
  const pair = reflow ? styles.pairStacked : tablet ? styles.pairTablet : styles.pair;
  const cell = reflow ? styles.cellStacked : styles.cell;

  function namesStep() {
    const firstName = input('first_name', { label: 'First Name', nextField: 'last_name' });
    const lastName = input('last_name', { label: 'Last Name' });
    return (
      <>
        <View testID={tablet ? 'profile-names-pair' : 'profile-section-names'} style={tablet ? pair : [styles.section, pair]}>
          <View style={cell}>{firstName}</View>
          <View style={cell}>{lastName}</View>
        </View>
        {/* T-43 (P1b.4): P1 only, at the end of the content, 40 below it. */}
        <DeleteAccountAction profileLess disabled={submitting} style={styles.deleteAction} />
      </>
    );
  }

  function heightStep() {
    const ftIn = form.height_unit === 'ft_in';
    const heightSwitch = (
      <FieldFrame label="Height unit" helperText={HEIGHT_HELPER} error={fieldErrors.height_unit} labelStyle={LABEL}>
        {lock(
          'profile-height-unit-lock',
          <SegmentedSwitch
            testID="profile-height-unit"
            accessibilityLabel="Height unit"
            segments={HEIGHT_UNITS}
            value={form.height_unit}
            onChange={changeHeightUnit}
            segmentWidth={tablet ? 96 : undefined}
            style={tablet ? styles.switchWell : styles.switchStretch}
          />
        )}
      </FieldFrame>
    );
    const heightFields = ftIn ? (
      <View testID="profile-height-pair" style={reflow ? styles.pairStacked : styles.pair}>
        <View style={cell}>
          {number('height_feet', {
            label: 'Feet',
            unit: 'ft',
            helperText: 'Whole feet only.',
            error: fieldErrors.height_value ?? fieldErrors.height_feet,
            nextField: 'height_inches',
          })}
        </View>
        <View style={cell}>
          {number('height_inches', {
            label: 'Inches',
            unit: 'in',
            helperText: 'Use 0 to 11 inches. Leave blank if there are no extra inches.',
          })}
        </View>
      </View>
    ) : (
      number('height_value', {
        label: form.height_unit === 'cm' ? 'Height' : 'Height (inches)',
        placeholder: form.height_unit === 'cm' ? PROFILE_PLACEHOLDERS.height_cm : PROFILE_PLACEHOLDERS.height_in,
        unit: form.height_unit,
        helperText: form.height_unit === 'cm' ? 'Enter your height in centimeters.' : 'Enter your height in inches.',
      })
    );
    return (
      <>
        <View testID="profile-section-height-unit" style={tablet ? null : styles.section}>
          {heightSwitch}
        </View>
        {heightFields}
      </>
    );
  }

  function weightStep() {
    // PM fix (27 Oct 2026, Edit profile "78" for 178 lb at 320): the phone
    // weight pair stacks where a side-by-side input has no room for a whole
    // weight (weightPairStacks; the 16 gutters, the box border, 16 | 40
    // paddings), and below 360 at any size (T-53 §3 P3).
    const weightsStacked =
      !tablet &&
      !reflow &&
      (width < WEIGHTS_STACK_BELOW ||
        weightPairStacks({ column: width - 2 * spacing[4], gap: styles.pair.gap, chrome: PHONE_WEIGHT_CHROME, fontSize: styles.bigInput.fontSize, fontScale }));
    const weightsPair = weightsStacked ? styles.pairStacked : pair;
    const weightCell = weightsStacked ? styles.cellStacked : cell;
    // ND1: "In lb." / "In kg." under the weights (Q5).
    const weightHelper = WEIGHT_UNIT_HELPERS ? `In ${form.weight_unit}.` : undefined;
    return (
      <>
        <View testID="profile-weight-unit-row" style={[styles.unitRow, reflow && styles.unitRowStacked]}>
          <Text ref={bindTarget('weight_unit')} testID="profile-weight-unit-label" {...BODY} style={styles.rowLabel}>
            Weight unit
          </Text>
          {lock(
            'profile-weight-unit-lock',
            <SegmentedSwitch
              testID="profile-weight-unit"
              accessibilityLabel="Weight unit"
              segments={WEIGHT_UNITS}
              value={form.weight_unit}
              onChange={(value) => edit('weight_unit', () => setForm((current) => ({ ...current, weight_unit: value })))}
              compact={!tablet}
              segmentWidth={tablet ? 72 : 64}
              style={tablet ? styles.switchWell : null}
            />
          )}
        </View>
        <View testID="profile-weights-pair" style={weightsPair}>
          <View style={weightCell}>
            {number('current_weight_value', { label: 'Current Weight', unit: form.weight_unit, helperText: weightHelper, nextField: 'goal_weight_value' })}
          </View>
          <View style={weightCell}>{number('goal_weight_value', { label: 'Goal Weight', unit: form.weight_unit, helperText: weightHelper })}</View>
        </View>
      </>
    );
  }

  function aboutStep() {
    // ⚠P4 narrowed 27 Oct 2026: date_of_birth and sex server errors show
    // under their fields (the unit errors still have none: the banner + focus only).
    const dateOfBirth = (
      <View
        ref={bindTarget('date_of_birth')}
        collapsable={false}
        testID="profile-date-of-birth-field"
        pointerEvents={submitting ? 'none' : 'auto'}
        style={submitting ? styles.locked : null}
      >
        <DateInput
          testID="profile-date-of-birth"
          label="Date of Birth"
          labelStyle={LABEL}
          value={form.date_of_birth}
          error={fieldErrors.date_of_birth}
          onChange={(value) => edit('date_of_birth', () => setForm((current) => ({ ...current, date_of_birth: value })))}
        />
      </View>
    );
    // T-53 §3 P4 / §5: a radiogroup "Sex" of four 44 pills that wrap; the
    // wrapper is the focus target and takes the lock (DateInput's pattern).
    const sex = (
      <View
        ref={bindTarget('sex')}
        collapsable={false}
        testID="profile-sex-field"
        pointerEvents={submitting ? 'none' : 'auto'}
        style={submitting ? styles.locked : null}
      >
        <FieldFrame label="Sex" error={fieldErrors.sex} labelStyle={LABEL}>
          <PillRow testID="profile-sex" label="Sex" gap={spacing[2]}>
            {SEX_PILLS.map((option) => (
              <OptionPill
                key={option.value}
                testID={`profile-sex-${option.value}`}
                label={option.label}
                size="focusTablet"
                accessibilityRole="radio"
                selected={form.sex === option.value}
                disabled={submitting}
                onPress={() => toggleSex(option.value)}
              />
            ))}
          </PillRow>
        </FieldFrame>
      </View>
    );
    const stacked = DOB_ABOVE_SEX || reflow;
    return (
      <View testID="profile-dob-sex-pair" style={stacked ? styles.pairStacked : pair}>
        <View style={stacked ? styles.cellStacked : cell}>{dateOfBirth}</View>
        <View style={stacked ? styles.cellStacked : cell}>{sex}</View>
      </View>
    );
  }

  const bridge = step === BRIDGE;
  const STEP_BODIES = [namesStep, heightStep, weightStep, aboutStep];
  const body = bridge ? null : STEP_BODIES[step - 1]();

  // The buttons: the primary (gold), Back (glass) on P2–P4; B's three.
  function stepButtons() {
    const size = tablet ? 'default' : 'cta';
    const row = tablet && !reflow;
    if (bridge) {
      const build = canBuild ? (
        <PillButton
          key="build"
          testID="bridge-build"
          title={COPY.build}
          size={size}
          fullWidth={!row}
          onPress={() => enterApp({ name: routes.PlanGenerator, params: { from: 'onboarding' } })}
        />
      ) : null;
      const browse = (
        <PillButton
          key="browse"
          testID="bridge-browse"
          title={COPY.browse}
          variant={canBuild ? 'secondary' : 'primary'}
          size={size}
          fullWidth={!row}
          onPress={() => enterApp({ name: routes.PlansLibrary })}
        />
      );
      const notNow = (
        <PillButton key="not-now" testID="bridge-not-now" title={COPY.notNow} variant="ghost" size="compact" fullWidth={!row} onPress={() => enterApp({ name: routes.Home })} />
      );
      return (
        <View testID="profile-buttons" style={row ? styles.buttonsTablet : styles.buttonsStacked}>
          {row ? [notNow, browse, build] : [build, browse, notNow]}
        </View>
      );
    }
    const last = step === PROFILE_STEP_COUNT;
    const skip = (step === 3 && weightsEmpty(form)) || (last && aboutYouEmpty(form));
    const title = submitting ? COPY.saving : skip ? COPY.skip : last ? COPY.create : COPY.next;
    const first = (
      <PillButton
        key="primary"
        testID={last ? 'profile-submit' : 'profile-next'}
        title={title}
        size={size}
        fullWidth={!tablet || reflow}
        loading={submitting}
        style={!tablet && !reflow && step > 1 ? styles.flex : null}
        onPress={primary}
      />
    );
    if (step === 1) {
      return (
        <View testID="profile-buttons" style={tablet ? styles.buttonsTablet : null}>
          {first}
        </View>
      );
    }
    const back = (
      <PillButton key="back" testID="profile-back" title={COPY.back} variant="secondary" size={size} fullWidth={reflow} disabled={submitting} onPress={() => goTo(step - 1)} />
    );
    return (
      <View testID="profile-buttons" style={reflow ? styles.buttonsStacked : tablet ? styles.buttonsTablet : styles.buttonsPhone}>
        {reflow ? [first, back] : [back, first]}
      </View>
    );
  }

  const eyebrow = bridge ? COPY.saved : COPY.stepOf(step);
  const title = bridge ? (canBuild ? COPY.bridgeTitle : COPY.bridgeTitleBrowse) : COPY.titles[step - 1];
  const helper = bridge ? (canBuild ? COPY.bridgeBody : COPY.bridgeBodyBrowse) : COPY.helpers[step - 1];
  const enterStyle = { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [motion.cardOffsetY, 0] }) }] };
  const pinned = !tablet && !barInFlow;
  const buttons = stepButtons();
  // Android edge-to-edge doesn't resize for the keyboard; iOS uses
  // automaticallyAdjustKeyboardInsets.
  const androidKeyboard = Platform.OS === 'android' && keyboardHeight > 0 ? keyboardHeight : 0;

  return (
    <View testID="create-profile-root" style={styles.screen}>
      <AmbientGlow glow />
      <ScrollView
        ref={scrollRef}
        testID="create-profile-screen"
        contentContainerStyle={{
          paddingTop: contentTop,
          // Phone: room for the pinned bar (on the keyboard while it is up)
          // so the last field never hides behind it.
          paddingBottom: pinned ? (androidKeyboard ? androidKeyboard + barHeight : barHeight + spacing[4]) : androidKeyboard || insets.bottom + 64,
          paddingLeft: insets.left + (tablet ? 72 : spacing[4]),
          paddingRight: insets.right + (tablet ? 72 : spacing[4]),
        }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Animated.View ref={formRef} testID="create-profile-form" style={[tablet ? styles.formTablet : styles.formPhone, enterStyle]}>
          {tablet && TABLET_BRAND_ROW ? (
            <View style={styles.brandRow}>
              <View style={styles.brandTile} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Text {...BADGE} style={styles.brandLetter}>
                  G
                </Text>
              </View>
              <Text {...BODY} style={styles.brandName}>
                Gymido
              </Text>
            </View>
          ) : null}
          {/* §2 phone top row: the 44 glass "Back" on P2–P4 (none on P1 and B). */}
          {!tablet && !bridge && step > 1 ? (
            <View testID="profile-top-row" style={styles.topRow}>
              <IconButton testID="profile-top-back" accessibilityLabel={COPY.back} disabled={submitting} onPress={() => goTo(step - 1)}>
                {({ color }) => <ChevronLeftIcon size={20} color={color} />}
              </IconButton>
            </View>
          ) : null}
          {bridge ? null : <ProgressSegments testID="profile-progress" step={step} total={PROFILE_STEP_COUNT} tablet={tablet} label={COPY.stepOf(step)} />}
          {banner ? <InlineError testID="profile-error" title={banner.title} message={banner.message} /> : null}
          <View>
            <View style={styles.eyebrowRow}>
              {bridge ? (
                <View testID="bridge-check" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <CheckIcon size={16} color={colors.teal} />
                </View>
              ) : null}
              <Text {...BODY} testID="profile-step-eyebrow" style={styles.eyebrow}>
                {eyebrow}
              </Text>
            </View>
            <Text ref={titleRef} testID="profile-step-title" accessibilityRole="header" {...TITLE} style={tablet ? styles.titleTablet : styles.titlePhone}>
              {title}
            </Text>
            {helper ? (
              <Text {...BODY} testID="profile-step-helper" style={styles.helper}>
                {helper}
              </Text>
            ) : null}
          </View>
          {body}
          {pinned ? null : buttons}
        </Animated.View>
      </ScrollView>
      {/* UX native final audit 27 Oct 2026, ruling 2 (A101): the form scrolls
          under the status bar, so the band gets the backdrop. */}
      <StatusBarBackdrop />
      {pinned ? (
        <View
          testID="profile-cta-bar"
          style={[
            styles.bar,
            {
              // Q4 (PM): the bar rides on the keyboard (useKeyboardOverlap).
              bottom: keyboardHeight,
              paddingBottom: (keyboardHeight ? 0 : insets.bottom) + spacing[4],
              paddingLeft: insets.left + spacing[5],
              paddingRight: insets.right + spacing[5],
            },
          ]}
          onLayout={(event) => {
            const measured = event.nativeEvent.layout.height;
            setBarHeight(measured);
            if (windowHeight > 0 && measured > windowHeight * BAR_MAX_SHARE) {
              setBarInFlow(true);
            }
          }}
        >
          <GradientFill angle={gradients.ctaBarFade.angle} colors={gradients.ctaBarFade.colors} stops={gradients.ctaBarFade.stops} />
          {buttons}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ground,
  },
  formPhone: {
    gap: spacing[3],
  },
  // §2 tablet / web ≥768: one centred column, max-width 560.
  formTablet: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    gap: spacing['5_5'],
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['2_5'],
  },
  // The G tile, solid gold (tokens §7.1).
  brandTile: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
  },
  brandLetter: {
    ...font(700),
    fontSize: 16,
    lineHeight: 20,
    color: colors.onGold,
  },
  brandName: {
    ...font(700),
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: -0.57,
    color: colors.textPrimary,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['1_5'],
  },
  // §2: the eyebrow caption 12/600 gold, sentence case.
  eyebrow: {
    ...font(600),
    fontSize: 12,
    lineHeight: 16,
    color: colors.gold,
  },
  // Q1: the generator's step title, phone 46/44/700 −0.05em.
  titlePhone: {
    ...font(700),
    marginTop: spacing[2],
    fontSize: 46,
    lineHeight: 44,
    letterSpacing: titleTracking(46, -0.05),
    color: colors.textPrimary,
  },
  // Q1: tablet 60/60/700 −0.055em (TabletGenerator).
  titleTablet: {
    ...font(700),
    marginTop: spacing['2_5'],
    fontSize: 60,
    lineHeight: 60,
    letterSpacing: titleTracking(60, -0.055),
    color: colors.textPrimary,
  },
  // §2: the helper body 15/24 secondary.
  helper: {
    ...font(400),
    marginTop: spacing[2],
    fontSize: 15,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  // Phone section cards: padding 14, radius 24, surface + hairline.
  section: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    padding: spacing['3_5'],
  },
  pair: {
    flexDirection: 'row',
    gap: spacing['2_5'],
  },
  pairTablet: {
    flexDirection: 'row',
    gap: spacing['3_5'],
  },
  cell: {
    flex: 1,
    minWidth: 0,
  },
  pairStacked: {
    flexDirection: 'column',
    gap: spacing[3],
  },
  // flex:1 would collapse in a column.
  cellStacked: {
    minWidth: 0,
  },
  switchStretch: {
    alignSelf: 'stretch',
  },
  // Tablet: segmented tracks are wells (UX §8.3 surface-well, as drawn).
  switchWell: {
    backgroundColor: colors.surfaceWell,
  },
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  unitRowStacked: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  rowLabel: {
    ...typography.label,
    color: colors.textStrong2,
  },
  // ND6: the input inside the kit box (1 px border) → 64 tall, 32/700
  // tabular, room for the unit suffix at the right. §9: minHeight, so the
  // scaled digits are never clipped.
  bigInput: {
    ...font(700),
    minHeight: 62,
    paddingVertical: 0,
    paddingLeft: spacing[4],
    paddingRight: 40,
    fontSize: 32,
    letterSpacing: -0.96,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  // C2: the same 62 box while empty, in the placeholder look (UX: text-faint,
  // 400, the normal input size = the kit's bodyLg 16).
  bigInputEmpty: {
    ...font(400),
    minHeight: 62,
    paddingVertical: 0,
    paddingLeft: spacing[4],
    paddingRight: 40,
    fontSize: typography.bodyLg.fontSize,
    color: colors.textFaint,
  },
  // §2: the pinned CTA bar, padding 16 20 + the safe area.
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingTop: spacing[4],
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  // Phone P2–P4: glass Back, then the primary taking the rest (gap 10).
  buttonsPhone: {
    flexDirection: 'row',
    gap: spacing['2_5'],
  },
  // Tablet: a right-aligned row, the primary last.
  buttonsTablet: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing[3],
  },
  // B (phone) and §9 reflow: stacked full width, the primary on top.
  buttonsStacked: {
    gap: spacing['2_5'],
  },
  deleteAction: {
    marginTop: 40,
  },
  // The kit's disabled look (FormField boxDisabled 0.5).
  locked: {
    opacity: 0.5,
  },
});

// What a phone weight input spends around the value: the field box's 1 + 1
// border and its paddings (16 | 40, the unit inside the 40).
const PHONE_WEIGHT_CHROME = 2 + styles.bigInput.paddingLeft + styles.bigInput.paddingRight;
