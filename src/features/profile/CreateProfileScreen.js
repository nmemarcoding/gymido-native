import { useNavigation } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { routes } from '../../navigation/routes';
import { resolveLanding } from '../../navigation/resolveLanding';
import { getServerMessage, getStatus } from '../../shared/api/apiError';
import DateInput from '../../shared/components/DateInput';
import { InlineError, SuccessState } from '../../shared/components/FeedbackBox';
import FormField from '../../shared/components/FormField';
import PillButton from '../../shared/components/PillButton';
import Select from '../../shared/components/Select';
import { useKeyboardHeight } from '../../shared/hooks/useKeyboardHeight';
import { useReducedMotion } from '../../shared/hooks/useReducedMotion';
import { breakpoints, colors, motion, radii, shadows } from '../../shared/theme/tokens';
import { useAuthStore } from '../auth/authStore';
import { getScreenTab } from '../shell/shellNavigation';
import { createProfile } from './api/profileApi';
import {
  INITIAL_PROFILE_FORM,
  buildCreateProfilePayload,
  numberValue,
  updateHeightUnit,
  validateCreateProfile,
} from './createProfileForm';

const EASE_OUT = Easing.bezier(0, 0, 0.58, 1);
const HEIGHT_UNITS = [
  { value: 'cm', label: 'cm' },
  { value: 'ft_in', label: 'ft/in' },
  { value: 'in', label: 'in' },
];
const WEIGHT_UNITS = [
  { value: 'lb', label: 'lb' },
  { value: 'kg', label: 'kg' },
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
const NO_AUTOFILL = { autoComplete: 'off', textContentType: 'none', importantForAutofill: 'no' };

// Create profile (RN-SPEC-profile-create): one card, one form, no navigation
// (⚠P7). Shown by the gate while the profile is missing.
export default function CreateProfileScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const { width } = useWindowDimensions();
  const wide = width >= breakpoints.sm;
  const reducedMotion = useReducedMotion();
  const enter = useRef(new Animated.Value(0)).current;
  const [form, setForm] = useState(INITIAL_PROFILE_FORM);
  // What each number input shows; state keeps only valid numbers (§3.4).
  const [display, setDisplay] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
    if (NUMBER_FIELDS.includes(key)) {
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
      await createProfile(buildCreateProfilePayload(form));
      // ⚠P6: set the message and leave in the same tick.
      setSuccessMessage('Profile created successfully. Redirecting you to the app.');
      useAuthStore.setState({ profileMissing: false });
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
      {...(NUMBER_FIELDS.includes(key) ? { keyboardType: NUMBER_KEYBOARD } : null)}
      {...props}
    />
  );
  const pair = wide ? styles.row : styles.column;
  const cell = wide ? styles.cell : null;

  return (
    <ScrollView
      testID="create-profile-screen"
      style={styles.screen}
      contentContainerStyle={{
        paddingTop: insets.top,
        // Android edge-to-edge doesn't resize for the keyboard; iOS uses
        // automaticallyAdjustKeyboardInsets.
        paddingBottom: Platform.OS === 'android' && keyboardHeight > 0 ? keyboardHeight : insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      {/* ⚠P1: the card is full-bleed, with no page wrapper. */}
      <Animated.View
        style={[
          styles.card,
          { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [motion.cardOffsetY, 0] }) }] },
        ]}
      >
        <View style={[styles.header, wide ? styles.headerWide : styles.headerPhone]}>
          <View>
            <Text accessibilityRole="header" style={styles.title}>
              Create Profile
            </Text>
            <Text style={styles.subtitle}>A quick setup so we can tailor your workout plan.</Text>
          </View>
        </View>
        <View style={[styles.content, wide && styles.contentWide]}>
          {successMessage ? <SuccessState message={successMessage} /> : null}
          {errorMessage ? <InlineError testID="profile-error" message={errorMessage} /> : null}
          <View style={styles.form}>
            <View style={pair}>
              <View style={cell}>{input('first_name', { label: 'First Name', placeholder: 'John' })}</View>
              <View style={cell}>{input('last_name', { label: 'Last Name', placeholder: 'Doe' })}</View>
            </View>
            <View style={styles.form}>
              <Select
                testID="profile-height-unit"
                label="Height unit"
                value={form.height_unit}
                options={HEIGHT_UNITS}
                onChange={changeHeightUnit}
                error={fieldErrors.height_unit}
                helperText="Feet and inches are shown first. Switch to cm or inches if that is how you measure height."
              />
              {form.height_unit === 'ft_in' ? (
                <View style={pair}>
                  <View style={cell}>
                    {input('height_feet', {
                      label: 'Feet',
                      placeholder: '5',
                      helperText: 'Whole feet only.',
                      error: fieldErrors.height_value ?? fieldErrors.height_feet,
                    })}
                  </View>
                  <View style={cell}>
                    {input('height_inches', {
                      label: 'Inches',
                      placeholder: '9',
                      helperText: 'Use 0 to 11 inches. Leave blank if there are no extra inches.',
                    })}
                  </View>
                </View>
              ) : (
                input('height_value', {
                  label: form.height_unit === 'cm' ? 'Height' : 'Height (inches)',
                  placeholder: form.height_unit === 'cm' ? '180' : '71',
                  helperText: form.height_unit === 'cm' ? 'Enter your height in centimeters.' : 'Enter your height in inches.',
                })
              )}
            </View>
            <Select
              testID="profile-weight-unit"
              label="Weight unit"
              value={form.weight_unit}
              options={WEIGHT_UNITS}
              onChange={(value) => setForm((current) => ({ ...current, weight_unit: value }))}
            />
            {input('current_weight_value', { label: 'Current Weight', placeholder: '82.5' })}
            {input('goal_weight_value', { label: 'Goal Weight', placeholder: '78' })}
            <View style={pair}>
              <View style={cell}>
                {/* ⚠P4: date_of_birth and sex errors have nowhere to show. */}
                <DateInput
                  testID="profile-date-of-birth"
                  label="Date of Birth"
                  value={form.date_of_birth}
                  onChange={(value) => setForm((current) => ({ ...current, date_of_birth: value }))}
                />
              </View>
              <View style={cell}>
                <Select
                  testID="profile-sex"
                  label="Sex"
                  value={form.sex}
                  options={SEX_OPTIONS}
                  onChange={(value) => setForm((current) => ({ ...current, sex: value }))}
                />
              </View>
            </View>
            <PillButton testID="profile-submit" title="Create profile" fullWidth loading={submitting} onPress={submit} />
          </View>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  card: {
    borderRadius: radii.surfaceCard,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
    boxShadow: shadows.soft,
    overflow: 'hidden',
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(229, 231, 235, 0.70)',
  },
  headerPhone: {
    flexDirection: 'column',
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  headerWide: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  content: {
    padding: 20,
    gap: 20,
  },
  contentWide: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  form: {
    gap: 16,
  },
  column: {
    gap: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  cell: {
    flex: 1,
  },
});
