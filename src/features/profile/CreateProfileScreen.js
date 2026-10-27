import { useNavigation } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { routes } from '../../navigation/routes';
import { resolveLanding } from '../../navigation/resolveLanding';
import { getServerMessage, getStatus } from '../../shared/api/apiError';
import { CardSurface } from '../../shared/components/Card';
import DateInput from '../../shared/components/DateInput';
import { InlineError, SuccessState } from '../../shared/components/FeedbackBox';
import FormField, { FieldFrame } from '../../shared/components/FormField';
import GradientFill from '../../shared/components/GradientFill';
import PillButton from '../../shared/components/PillButton';
import { AmbientGlow } from '../../shared/components/Screen';
import SegmentedSwitch from '../../shared/components/SegmentedSwitch';
import { useKeyboardHeight } from '../../shared/hooks/useKeyboardHeight';
import { useReducedMotion } from '../../shared/hooks/useReducedMotion';
import { breakpoints, colors, font, gradients, motion, radii, spacing, textScale, typography } from '../../shared/theme/tokens';
import { useAuthStore } from '../auth/authStore';
import { getScreenTab } from '../shell/shellNavigation';
import { createProfile } from './api/profileApi';
import DeleteAccountAction from './DeleteAccountAction';
import { fetchProfile, setCreatedProfile, useProfileStore } from './profileStore';
import SexPills from './SexPills';
import {
  INITIAL_PROFILE_FORM,
  SEX_OPTIONS,
  buildCreateProfilePayload,
  clearFieldErrors,
  firstErrorTarget,
  numberValue,
  updateHeightUnit,
  validateCreateProfile,
} from './createProfileForm';

const EASE_OUT = Easing.bezier(0, 0, 0.58, 1);
// v2 Phase 2 (B1, UX ND1 + PM 26 Oct): a three-segment switch in the board's
// order ft/in · cm · in; the values and updateHeightUnit are v1's.
export const HEIGHT_UNITS = [
  { value: 'ft_in', label: 'ft/in', testID: 'profile-height-unit-ft_in' },
  { value: 'cm', label: 'cm', testID: 'profile-height-unit-cm' },
  { value: 'in', label: 'in', testID: 'profile-height-unit-in' },
];
export const WEIGHT_UNITS = [
  { value: 'lb', label: 'lb', testID: 'profile-weight-unit-lb' },
  { value: 'kg', label: 'kg', testID: 'profile-weight-unit-kg' },
];
// Sex: SEX_OPTIONS (createProfileForm.js), "Not set" first and "Prefer not
// to say" once (D2, ⚠P5 retired 27 Oct 2026), drawn as the S4 pills.
const NUMBER_FIELDS = ['height_value', 'height_feet', 'height_inches', 'current_weight_value', 'goal_weight_value'];
const NUMBER_KEYBOARD = Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric';
// T-16: the weights are text with a decimal keypad, kept exactly as typed.
const WEIGHT_FIELDS = ['current_weight_value', 'goal_weight_value'];
const NO_AUTOFILL = { autoComplete: 'off', textContentType: 'none', importantForAutofill: 'no' };
// UX ruling: the caret and the selection are gold.
const GOLD_CARET = { selectionColor: colors.gold, cursorColor: colors.gold };
const HEIGHT_HELPER = 'Feet and inches are shown first. Switch to cm or inches if that is how you measure height.';
// C2: every placeholder text in one map (the web's exact texts drop in here).
export const PROFILE_PLACEHOLDERS = Object.freeze({
  first_name: 'John',
  last_name: 'Doe',
  height_feet: '5',
  height_inches: '9',
  height_cm: '180',
  height_in: '71',
  current_weight_value: '82.5',
  goal_weight_value: '78',
});
// Phone CTA bar (ND2): padding 16 20 30 above the safe area.
const BAR_BOTTOM = 30;
// UX §9 large text: the page title caps at 1.3, wraps by word (max 3 lines)
// and shrinks a single long word; body, labels and inputs scale to 2.0; the
// G in its fixed 32 tile caps at 1.2.
const TITLE = { numberOfLines: 3, adjustsFontSizeToFit: true, minimumFontScale: 0.7, textBreakStrategy: 'simple', maxFontSizeMultiplier: textScale.display };
const BODY = { maxFontSizeMultiplier: textScale.body };
const BADGE = { maxFontSizeMultiplier: textScale.badge };
// The board draws every field label in text-strong-2.
const LABEL = { color: colors.textStrong2 };
// ⚠P8 retired: these targets take keyboard focus; the others (Weight unit,
// Date of Birth, Sex) take accessibility focus.
const TEXT_TARGETS = ['first_name', 'last_name', 'height_value', 'height_feet', 'height_inches', 'current_weight_value', 'goal_weight_value'];

// Create profile (RN-SPEC-profile-create; v2 Phase 2 B1): one step, no back
// or logout (a 409 continues to the app, ⚠P7 retired 27 Oct 2026). Shown by
// the gate while the profile is missing. Phone: the board's sections with the big 64/32 numbers (ND6) and a sticky bottom
// bar holding "Create profile" and Delete account (ND2). Tablet (≥ 768): the
// two cards in a 640 column, the CTA inline and Delete account 40 below it.
export default function CreateProfileScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const { width, fontScale } = useWindowDimensions();
  // §9 reflow (live): the 2-column pairs become one column and the weight
  // unit switch drops below its label.
  const reflow = fontScale > textScale.reflowAbove;
  // The layout is fixed at mount: the phone bar's fade is a gradient, and a
  // gradient is never added on a later change (Android render rule).
  const [tablet] = useState(() => width >= breakpoints.md);
  const reducedMotion = useReducedMotion();
  const enter = useRef(new Animated.Value(0)).current;
  const [form, setForm] = useState(INITIAL_PROFILE_FORM);
  // What each number input shows; state keeps only valid numbers (§3.4).
  const [display, setDisplay] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [barHeight, setBarHeight] = useState(0);
  // ⚠P9 retired: the synchronous lock (state alone lets a second tap in
  // before the re-render); `submitting` drives the look.
  const locked = useRef(false);
  // ⚠P8 retired: one request per failed submit, run after the errors render.
  const [focusRequest, setFocusRequest] = useState(null);
  const targets = useRef({});
  const scrollRef = useRef(null);
  const formRef = useRef(null);
  const bindTarget = (key) => (node) => {
    targets.current[key] = node;
  };
  const contentTop = insets.top + (tablet ? 64 : spacing[6]);

  useEffect(() => {
    if (reducedMotion) {
      enter.setValue(1);
      return undefined;
    }
    const animation = Animated.timing(enter, { toValue: 1, duration: motion.fadeMs, easing: EASE_OUT, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [enter, reducedMotion]);

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

  // §5.3: store the profile and replace into the app (the gate passes).
  function enterApp(profile) {
    setCreatedProfile(profile);
    const { user, workspace } = useAuthStore.getState();
    const landing = resolveLanding({ roles: user?.roles ?? [], workspace });
    navigation.reset({
      index: 0,
      routes: [{ name: routes.AppShell, params: { screen: getScreenTab(landing.name), params: { screen: landing.name } } }],
    });
  }

  // ⚠P8 retired 27 Oct 2026: focus the first field in error, once per submit.
  function focusFirstError(errors) {
    const target = firstErrorTarget(errors, form.height_unit);
    if (target) {
      setFocusRequest({ target });
    }
  }

  async function submit() {
    if (locked.current) {
      return;
    }
    setErrorMessage('');
    setSuccessMessage('');
    const errors = validateCreateProfile(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      focusFirstError(errors);
      return;
    }
    // ⚠P9 retired 27 Oct 2026: everything locks until the request settles.
    locked.current = true;
    setSubmitting(true);
    try {
      const created = await createProfile(buildCreateProfilePayload(form));
      // ⚠P6: set the message and leave in the same tick.
      setSuccessMessage('Profile created successfully. Redirecting you to the app.');
      enterApp(created);
    } catch (error) {
      const status = getStatus(error);
      if (status === 409) {
        // ⚠P7 retired 27 Oct 2026: a 409 counts as success. Reload the
        // profile (the store's GET /profile) and go in like a create; only
        // a failed reload shows the message. Still locked meanwhile.
        await fetchProfile();
        const existing = useProfileStore.getState().profile;
        if (existing) {
          enterApp(existing);
          return;
        }
        setErrorMessage('A profile already exists for this account.');
      } else {
        setErrorMessage(getServerMessage(error));
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

  const input = (key, props) => (
    <FormField
      ref={bindTarget(key)}
      testID={`profile-${key}`}
      value={shown(key)}
      error={fieldErrors[key]}
      onChangeText={(text) => setText(key, text)}
      returnKeyType="go"
      onSubmitEditing={submit}
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

  const ftIn = form.height_unit === 'ft_in';
  const firstName = input('first_name', { label: 'First Name', placeholder: PROFILE_PLACEHOLDERS.first_name });
  const lastName = input('last_name', { label: 'Last Name', placeholder: PROFILE_PLACEHOLDERS.last_name });
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
  // §9: past 1.3 every 2-column pair is one column.
  const pair = reflow ? styles.pairStacked : tablet ? styles.pairTablet : styles.pair;
  const cell = reflow ? styles.cellStacked : styles.cell;
  const heightFields = ftIn ? (
    <View testID="profile-height-pair" style={reflow ? styles.pairStacked : styles.pair}>
      <View style={cell}>
        {number('height_feet', {
          label: 'Feet',
          placeholder: PROFILE_PLACEHOLDERS.height_feet,
          unit: 'ft',
          helperText: 'Whole feet only.',
          error: fieldErrors.height_value ?? fieldErrors.height_feet,
        })}
      </View>
      <View style={cell}>
        {number('height_inches', {
          label: 'Inches',
          placeholder: PROFILE_PLACEHOLDERS.height_inches,
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
  const weightUnitRow = (
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
  );
  // ND1: "In lb." / "In kg." under the weights.
  const weightHelper = `In ${form.weight_unit}.`;
  const currentWeight = number('current_weight_value', {
    label: 'Current Weight',
    placeholder: PROFILE_PLACEHOLDERS.current_weight_value,
    unit: form.weight_unit,
    helperText: weightHelper,
  });
  const goalWeight = number('goal_weight_value', { label: 'Goal Weight', placeholder: PROFILE_PLACEHOLDERS.goal_weight_value, unit: form.weight_unit, helperText: weightHelper });
  // ⚠P4 narrowed 27 Oct 2026: date_of_birth and sex server errors show under
  // their fields (the unit errors still have none: the banner + focus only).
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
  const sex = (
    <SexPills
      testID="profile-sex"
      label="Sex"
      labelStyle={LABEL}
      value={form.sex}
      options={SEX_OPTIONS}
      error={fieldErrors.sex}
      disabled={submitting}
      focusRef={bindTarget('sex')}
      onChange={(value) => edit('sex', () => setForm((current) => ({ ...current, sex: value })))}
    />
  );
  const submitButton = <PillButton testID="profile-submit" title="Create profile" size="cta" fullWidth loading={submitting} onPress={submit} />;
  const feedback = (
    <>
      {successMessage ? <SuccessState message={successMessage} /> : null}
      {errorMessage ? <InlineError testID="profile-error" message={errorMessage} /> : null}
    </>
  );
  const enterStyle = { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [motion.cardOffsetY, 0] }) }] };
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
          // Phone: room for the pinned bar so the last field never hides behind it.
          paddingBottom: androidKeyboard || (tablet ? insets.bottom + 64 : barHeight + spacing[4]),
          paddingLeft: insets.left + (tablet ? 72 : spacing[4]),
          paddingRight: insets.right + (tablet ? 72 : spacing[4]),
        }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Animated.View ref={formRef} testID="create-profile-form" style={[tablet ? styles.formTablet : styles.formPhone, enterStyle]}>
          {tablet ? (
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
          <View>
            {/* Copy is the code's "Create Profile"; the phone board breaks it
                over two lines with the second word in gold. */}
            <Text
              accessibilityRole="header"
              accessibilityLabel="Create Profile"
              {...TITLE}
              style={tablet ? styles.titleTablet : styles.titlePhone}
            >
              {tablet ? 'Create Profile' : 'Create\n'}
              {tablet ? null : <Text style={styles.titleGold}>Profile</Text>}
            </Text>
            <Text {...BODY} style={tablet ? styles.subtitleTablet : styles.subtitlePhone}>
              A quick setup so we can tailor your workout plan.
            </Text>
          </View>
          {feedback}
          {tablet ? (
            <>
              <CardSurface hero testID="profile-card-body" style={styles.tabletCard}>
                <View testID="profile-names-pair" style={pair}>
                  <View style={cell}>{firstName}</View>
                  <View style={cell}>{lastName}</View>
                </View>
                {heightSwitch}
                {heightFields}
              </CardSurface>
              <CardSurface hero testID="profile-card-weight" style={styles.tabletCard}>
                {weightUnitRow}
                <View testID="profile-weights-pair" style={pair}>
                  <View style={cell}>{currentWeight}</View>
                  <View style={cell}>{goalWeight}</View>
                </View>
                <View style={pair}>
                  <View style={cell}>{dateOfBirth}</View>
                  <View style={cell}>{sex}</View>
                </View>
              </CardSurface>
              <View>
                {submitButton}
                {/* T-43 (P1b.4): below the CTA, 40 apart, centred. */}
                <DeleteAccountAction profileLess disabled={submitting} style={styles.deleteTablet} />
              </View>
            </>
          ) : (
            <>
              <View testID="profile-section-names" style={[styles.section, pair]}>
                <View style={cell}>{firstName}</View>
                <View style={cell}>{lastName}</View>
              </View>
              <View testID="profile-section-height-unit" style={styles.section}>
                {heightSwitch}
              </View>
              {heightFields}
              {weightUnitRow}
              <View testID="profile-weights-pair" style={pair}>
                <View style={cell}>{currentWeight}</View>
                <View style={cell}>{goalWeight}</View>
              </View>
              <View style={pair}>
                <View style={cell}>{dateOfBirth}</View>
                <View style={cell}>{sex}</View>
              </View>
            </>
          )}
        </Animated.View>
      </ScrollView>
      {tablet ? null : (
        <View
          testID="profile-cta-bar"
          style={[styles.bar, { paddingBottom: insets.bottom + BAR_BOTTOM, paddingLeft: insets.left + spacing[5], paddingRight: insets.right + spacing[5] }]}
          onLayout={(event) => setBarHeight(event.nativeEvent.layout.height)}
        >
          <GradientFill angle={gradients.ctaBarFade.angle} colors={gradients.ctaBarFade.colors} stops={gradients.ctaBarFade.stops} />
          {submitButton}
          {/* T-43 (P1b.4) in the bar under the CTA (ND2). */}
          <DeleteAccountAction profileLess disabled={submitting} style={styles.deletePhone} />
        </View>
      )}
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
  formTablet: {
    width: '100%',
    maxWidth: 640,
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
  // Boards (UX B): phone 48/46, tablet 60/60, both 700 −0.055em. No type
  // step has these (display-md 44/44, display-xl 56/58).
  titlePhone: {
    ...font(700),
    fontSize: 48,
    lineHeight: 46,
    letterSpacing: -2.64,
    color: colors.textPrimary,
  },
  titleGold: {
    color: colors.gold,
  },
  titleTablet: {
    ...font(700),
    fontSize: 60,
    lineHeight: 60,
    letterSpacing: -3.3,
    color: colors.textPrimary,
  },
  subtitlePhone: {
    ...typography.body,
    marginTop: spacing['1_5'],
    color: colors.textSecondary,
  },
  subtitleTablet: {
    ...font(400),
    marginTop: spacing[2],
    fontSize: 17,
    lineHeight: 26,
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
  tabletCard: {
    padding: spacing[6],
    gap: spacing['4_5'],
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
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: spacing[4],
  },
  deletePhone: {
    marginTop: spacing['1_5'],
  },
  deleteTablet: {
    marginTop: 40,
  },
  // The kit's disabled look (FormField boxDisabled 0.5).
  locked: {
    opacity: 0.5,
  },
});
