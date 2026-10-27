import { useNavigation } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
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
import Select from '../../shared/components/Select';
import { useKeyboardHeight } from '../../shared/hooks/useKeyboardHeight';
import { useReducedMotion } from '../../shared/hooks/useReducedMotion';
import { breakpoints, colors, font, gradients, motion, radii, spacing, typography } from '../../shared/theme/tokens';
import { useAuthStore } from '../auth/authStore';
import { getScreenTab } from '../shell/shellNavigation';
import { createProfile } from './api/profileApi';
import DeleteAccountAction from './DeleteAccountAction';
import { setCreatedProfile } from './profileStore';
import {
  INITIAL_PROFILE_FORM,
  buildCreateProfilePayload,
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
// ⚠P5: "Prefer not to say" twice; the first sends null.
const SEX_OPTIONS = [
  { value: '', label: 'Prefer not to say' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];
const NUMBER_FIELDS = ['height_value', 'height_feet', 'height_inches', 'current_weight_value', 'goal_weight_value'];
const NUMBER_KEYBOARD = Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric';
// T-16: the weights are text with a decimal keypad, kept exactly as typed.
const WEIGHT_FIELDS = ['current_weight_value', 'goal_weight_value'];
const NO_AUTOFILL = { autoComplete: 'off', textContentType: 'none', importantForAutofill: 'no' };
// UX ruling: the caret and the selection are gold.
const GOLD_CARET = { selectionColor: colors.gold, cursorColor: colors.gold };
const HEIGHT_HELPER = 'Feet and inches are shown first. Switch to cm or inches if that is how you measure height.';
// Phone CTA bar (ND2): padding 16 20 30 above the safe area.
const BAR_BOTTOM = 30;

// Create profile (RN-SPEC-profile-create; v2 Phase 2 B1): one step, no
// navigation (⚠P7). Shown by the gate while the profile is missing. Phone:
// the board's sections with the big 64/32 numbers (ND6) and a sticky bottom
// bar holding "Create profile" and Delete account (ND2). Tablet (≥ 768): the
// two cards in a 640 column, the CTA inline and Delete account 40 below it.
export default function CreateProfileScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const { width } = useWindowDimensions();
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

  useEffect(() => {
    if (reducedMotion) {
      enter.setValue(1);
      return undefined;
    }
    const animation = Animated.timing(enter, { toValue: 1, duration: motion.fadeMs, easing: EASE_OUT, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [enter, reducedMotion]);

  const shown = (key) => (key in display ? display[key] : String(form[key] ?? ''));

  function setText(key, text) {
    if (NUMBER_FIELDS.includes(key) && !WEIGHT_FIELDS.includes(key)) {
      setDisplay((current) => ({ ...current, [key]: text }));
      setForm((current) => ({ ...current, [key]: numberValue(text) }));
    } else {
      setForm((current) => ({ ...current, [key]: text }));
    }
  }

  // A programmatic change shows String(value) again.
  function changeHeightUnit(unit) {
    setForm((current) => updateHeightUnit(current, unit));
    setDisplay((current) => {
      const next = { ...current };
      delete next.height_value;
      delete next.height_feet;
      delete next.height_inches;
      return next;
    });
  }

  async function submit() {
    if (submitting) {
      return;
    }
    setErrorMessage('');
    setSuccessMessage('');
    const errors = validateCreateProfile(form);
    // ⚠P8: no scroll or focus; ⚠P12: errors stay until the next submit.
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    setSubmitting(true);
    try {
      const created = await createProfile(buildCreateProfilePayload(form));
      // ⚠P6: set the message and leave in the same tick.
      setSuccessMessage('Profile created successfully. Redirecting you to the app.');
      setCreatedProfile(created);
      const { user, workspace } = useAuthStore.getState();
      const landing = resolveLanding({ roles: user?.roles ?? [], workspace });
      navigation.reset({
        index: 0,
        routes: [{ name: routes.AppShell, params: { screen: getScreenTab(landing.name), params: { screen: landing.name } } }],
      });
    } catch (error) {
      const status = getStatus(error);
      if (status === 409) {
        // ⚠P7: a dead end until a cold start.
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
      setSubmitting(false);
    }
  }

  const input = (key, props) => (
    <FormField
      testID={`profile-${key}`}
      value={shown(key)}
      error={fieldErrors[key]}
      onChangeText={(text) => setText(key, text)}
      returnKeyType="go"
      onSubmitEditing={submit}
      accessibilityState={{ invalid: Boolean(fieldErrors[key]) }}
      {...NO_AUTOFILL}
      {...GOLD_CARET}
      {...(NUMBER_FIELDS.includes(key) ? { keyboardType: WEIGHT_FIELDS.includes(key) ? 'decimal-pad' : NUMBER_KEYBOARD } : null)}
      {...props}
    />
  );
  // ND6: the phone's numbers are 64 tall at 32/700; tablet keeps the kit 52.
  const number = (key, props) => input(key, tablet ? props : { ...props, style: styles.bigInput });

  const ftIn = form.height_unit === 'ft_in';
  const firstName = input('first_name', { label: 'First Name', placeholder: 'John' });
  const lastName = input('last_name', { label: 'Last Name', placeholder: 'Doe' });
  const heightSwitch = (
    <FieldFrame label="Height unit" helperText={HEIGHT_HELPER} error={fieldErrors.height_unit}>
      <SegmentedSwitch
        testID="profile-height-unit"
        accessibilityLabel="Height unit"
        segments={HEIGHT_UNITS}
        value={form.height_unit}
        onChange={changeHeightUnit}
        segmentWidth={tablet ? 96 : undefined}
        style={tablet ? null : styles.switchStretch}
      />
    </FieldFrame>
  );
  const heightFields = ftIn ? (
    <View style={styles.pair}>
      <View style={styles.cell}>
        {number('height_feet', {
          label: 'Feet',
          placeholder: '5',
          unit: 'ft',
          helperText: 'Whole feet only.',
          error: fieldErrors.height_value ?? fieldErrors.height_feet,
        })}
      </View>
      <View style={styles.cell}>
        {number('height_inches', {
          label: 'Inches',
          placeholder: '9',
          unit: 'in',
          helperText: 'Use 0 to 11 inches. Leave blank if there are no extra inches.',
        })}
      </View>
    </View>
  ) : (
    number('height_value', {
      label: form.height_unit === 'cm' ? 'Height' : 'Height (inches)',
      placeholder: form.height_unit === 'cm' ? '180' : '71',
      unit: form.height_unit,
      helperText: form.height_unit === 'cm' ? 'Enter your height in centimeters.' : 'Enter your height in inches.',
    })
  );
  const weightUnitRow = (
    <View style={styles.unitRow}>
      <Text style={styles.rowLabel}>Weight unit</Text>
      <SegmentedSwitch
        testID="profile-weight-unit"
        accessibilityLabel="Weight unit"
        segments={WEIGHT_UNITS}
        value={form.weight_unit}
        onChange={(value) => setForm((current) => ({ ...current, weight_unit: value }))}
        compact={!tablet}
        segmentWidth={tablet ? 72 : 64}
      />
    </View>
  );
  // ND1: "In lb." / "In kg." under the weights.
  const weightHelper = `In ${form.weight_unit}.`;
  const currentWeight = number('current_weight_value', {
    label: 'Current Weight',
    placeholder: '82.5',
    unit: form.weight_unit,
    helperText: weightHelper,
  });
  const goalWeight = number('goal_weight_value', { label: 'Goal Weight', placeholder: '78', unit: form.weight_unit, helperText: weightHelper });
  // ⚠P4: date_of_birth and sex errors have nowhere to show.
  const dateOfBirth = (
    <DateInput
      testID="profile-date-of-birth"
      label="Date of Birth"
      value={form.date_of_birth}
      onChange={(value) => setForm((current) => ({ ...current, date_of_birth: value }))}
    />
  );
  const sex = (
    <Select testID="profile-sex" label="Sex" value={form.sex} options={SEX_OPTIONS} onChange={(value) => setForm((current) => ({ ...current, sex: value }))} />
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
        testID="create-profile-screen"
        contentContainerStyle={{
          paddingTop: insets.top + (tablet ? 64 : spacing[6]),
          // Phone: room for the pinned bar so the last field never hides behind it.
          paddingBottom: androidKeyboard || (tablet ? insets.bottom + 64 : barHeight + spacing[4]),
          paddingLeft: insets.left + (tablet ? 72 : spacing[4]),
          paddingRight: insets.right + (tablet ? 72 : spacing[4]),
        }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Animated.View testID="create-profile-form" style={[tablet ? styles.formTablet : styles.formPhone, enterStyle]}>
          {tablet ? (
            <View style={styles.brandRow}>
              <View style={styles.brandTile} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Text style={styles.brandLetter}>G</Text>
              </View>
              <Text style={styles.brandName}>Gymido</Text>
            </View>
          ) : null}
          <View>
            {/* Copy is the code's "Create Profile"; the phone board breaks it
                over two lines with the second word in gold. */}
            <Text
              accessibilityRole="header"
              accessibilityLabel="Create Profile"
              textBreakStrategy="simple"
              style={tablet ? styles.titleTablet : styles.titlePhone}
            >
              {tablet ? 'Create Profile' : 'Create\n'}
              {tablet ? null : <Text style={styles.titleGold}>Profile</Text>}
            </Text>
            <Text style={tablet ? styles.subtitleTablet : styles.subtitlePhone}>A quick setup so we can tailor your workout plan.</Text>
          </View>
          {feedback}
          {tablet ? (
            <>
              <CardSurface hero testID="profile-card-body" style={styles.tabletCard}>
                <View style={styles.pairTablet}>
                  <View style={styles.cell}>{firstName}</View>
                  <View style={styles.cell}>{lastName}</View>
                </View>
                {heightSwitch}
                {heightFields}
              </CardSurface>
              <CardSurface hero testID="profile-card-weight" style={styles.tabletCard}>
                {weightUnitRow}
                <View style={styles.pairTablet}>
                  <View style={styles.cell}>{currentWeight}</View>
                  <View style={styles.cell}>{goalWeight}</View>
                </View>
                <View style={styles.pairTablet}>
                  <View style={styles.cell}>{dateOfBirth}</View>
                  <View style={styles.cell}>{sex}</View>
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
              <View testID="profile-section-names" style={[styles.section, styles.pair]}>
                <View style={styles.cell}>{firstName}</View>
                <View style={styles.cell}>{lastName}</View>
              </View>
              <View testID="profile-section-height-unit" style={styles.section}>
                {heightSwitch}
              </View>
              {heightFields}
              {weightUnitRow}
              <View style={styles.pair}>
                <View style={styles.cell}>{currentWeight}</View>
                <View style={styles.cell}>{goalWeight}</View>
              </View>
              <View style={styles.pair}>
                <View style={styles.cell}>{dateOfBirth}</View>
                <View style={styles.cell}>{sex}</View>
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
  titlePhone: {
    ...typography.displayMd,
    color: colors.textPrimary,
  },
  titleGold: {
    color: colors.gold,
  },
  titleTablet: {
    ...typography.displayXl,
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
  switchStretch: {
    alignSelf: 'stretch',
  },
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  rowLabel: {
    ...typography.label,
    color: colors.textSecondary,
  },
  // ND6: the input inside the kit box (1 px border) → 64 tall, 32/700
  // tabular, room for the unit suffix at the right.
  bigInput: {
    ...font(700),
    height: 62,
    paddingVertical: 0,
    paddingLeft: spacing[4],
    paddingRight: 40,
    fontSize: 32,
    letterSpacing: -0.96,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
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
});
