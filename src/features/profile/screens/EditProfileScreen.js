import { useNavigation } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { routes } from '../../../navigation/routes';
import { getServerMessage } from '../../../shared/api/apiError';
import DateInput from '../../../shared/components/DateInput';
import ErrorAlert from '../../../shared/components/ErrorAlert';
import { InlineError } from '../../../shared/components/FeedbackBox';
import FormField from '../../../shared/components/FormField';
import Loader from '../../../shared/components/Loader';
import PillButton from '../../../shared/components/PillButton';
import Select from '../../../shared/components/Select';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { breakpoints, colors, motion, radii, shadows } from '../../../shared/theme/tokens';
import ShellPage from '../../shell/ShellPage';
import { updateProfile } from '../api/profileApi';
import { numberValue } from '../createProfileForm';
import {
  buildEditProfilePayload,
  editFormFromProfile,
  editHasChanges,
  firstFieldErrors,
  isGoalWeightOptional,
  updateEditHeightUnit,
  validateEditProfile,
} from '../editProfileForm';
import { ProfileStatus, fetchProfile, setStoredProfile, useProfileStore } from '../profileStore';

const EASE_OUT = Easing.bezier(0, 0, 0.58, 1);
const HEIGHT_UNITS = [
  { value: 'cm', label: 'cm' },
  { value: 'ft_in', label: 'ft/in' },
  { value: 'in', label: 'in' },
];
const WEIGHT_UNITS = [
  { value: 'kg', label: 'kg' },
  { value: 'lb', label: 'lb' },
];
// ⚠P-8: "Prefer not to say" twice; the first sends null.
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
// Batch B: labels 14px / 600.
const LABEL = { fontSize: 14, fontWeight: '600' };

// RN-SPEC-profile P2 (Edit profile), pushed on the Profile stack.
export default function EditProfileScreen() {
  return (
    <ShellPage testID="edit-profile-screen">
      <EditProfile />
    </ShellPage>
  );
}

function EditProfile() {
  const navigation = useNavigation();
  const profile = useProfileStore((state) => state.profile);
  const profileStatus = useProfileStore((state) => state.profileStatus);
  const profileError = useProfileStore((state) => state.profileError);

  // P2.1 (T-16): a failed load is retried once, on mount only.
  useEffect(() => {
    const status = useProfileStore.getState().profileStatus;
    if (status === ProfileStatus.idle || status === ProfileStatus.error) {
      fetchProfile();
    }
  }, []);

  const missing = profileStatus === ProfileStatus.missing;
  useEffect(() => {
    if (missing) {
      // /profile/create is the root-level Onboarding screen.
      navigation.navigate(routes.Onboarding);
    }
  }, [missing, navigation]);

  if (missing) {
    return null;
  }
  if (profileStatus === ProfileStatus.loading || profileStatus === ProfileStatus.idle) {
    return <Loader label="Loading profile" />;
  }
  if (profileStatus === ProfileStatus.error || !profile) {
    return (
      <ErrorAlert
        testID="edit-profile-load-error"
        title="Something went wrong"
        description={profileError?.message || 'Failed to load profile'}
        onRetry={() => fetchProfile()}
      />
    );
  }
  return <EditProfileForm profile={profile} />;
}

function EditProfileForm({ profile }) {
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const wide = width >= breakpoints.sm;
  const reducedMotion = useReducedMotion();
  const enter = useRef(new Animated.Value(0)).current;
  const [form, setForm] = useState(() => editFormFromProfile(profile));
  // What each number input shows; state keeps only valid numbers.
  const [display, setDisplay] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ⚠P-6: a new store profile object resets the form, dropping edits.
  const seen = useRef(profile);
  useEffect(() => {
    if (seen.current !== profile) {
      seen.current = profile;
      setForm(editFormFromProfile(profile));
      setDisplay({});
    }
  }, [profile]);

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

  const setField = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  // A programmatic change shows String(value) again (e.g. "0", ⚠P-13).
  function changeHeightUnit(unit) {
    setForm((current) => updateEditHeightUnit(current, unit));
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
    const errors = validateEditProfile(form, { goalOptional: isGoalWeightOptional(profile) });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    setSubmitting(true);
    try {
      const saved = await updateProfile(buildEditProfilePayload(form));
      // The save succeeded; a response without `profile` must not read as "no
      // profile", so read it back instead.
      if (saved) {
        setStoredProfile(saved);
      } else {
        fetchProfile();
      }
      // ⚠P-11: replace Edit with a new Settings; no toast.
      navigation.replace(routes.Settings);
    } catch (error) {
      setErrorMessage(getServerMessage(error));
      setFieldErrors(firstFieldErrors(error));
    } finally {
      setSubmitting(false);
    }
  }

  const hasChanges = editHasChanges(profile, form);

  const input = (key, props) => (
    <FormField
      testID={`edit-profile-${key}`}
      value={shown(key)}
      error={fieldErrors[key]}
      onChangeText={(text) => setText(key, text)}
      labelStyle={LABEL}
      accessibilityState={{ invalid: Boolean(fieldErrors[key]) }}
      {...NO_AUTOFILL}
      {...(NUMBER_FIELDS.includes(key) ? { keyboardType: NUMBER_KEYBOARD } : null)}
      {...props}
    />
  );
  const weightRow = (key, label, unitKey) => (
    <View style={wide ? styles.row : styles.column}>
      <View style={wide ? styles.cellWide : null}>
        {input(key, { label, helperText: `In ${form[unitKey]}.` })}
      </View>
      <View style={wide ? styles.cell : null}>
        <Select
          testID={`edit-profile-${unitKey}`}
          label="Unit"
          labelStyle={LABEL}
          value={form[unitKey]}
          options={WEIGHT_UNITS}
          onChange={setField(unitKey)}
          error={fieldErrors[unitKey]}
        />
      </View>
    </View>
  );
  const pair = wide ? styles.row : styles.column;
  const cell = wide ? styles.cell : null;

  return (
    <Animated.View
      style={[
        styles.card,
        { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [motion.cardOffsetY, 0] }) }] },
      ]}
    >
      <View style={[styles.header, wide && styles.headerWide]}>
        <Text accessibilityRole="header" style={styles.title}>
          Edit profile
        </Text>
        <Text style={styles.subtitle}>Update your account details and measurement preferences.</Text>
      </View>
      <View style={[styles.body, wide && styles.bodyWide]}>
        {errorMessage ? <InlineError testID="edit-profile-error" message={errorMessage} /> : null}
        <View style={styles.column}>
          {/* ⚠P-7: no placeholders on names and weights. */}
          <View style={pair}>
            <View style={cell}>{input('first_name', { label: 'First Name' })}</View>
            <View style={cell}>{input('last_name', { label: 'Last Name' })}</View>
          </View>
          <View style={styles.column}>
            <Select
              testID="edit-profile-height-unit"
              label="Height unit"
              labelStyle={LABEL}
              value={form.height_unit}
              options={HEIGHT_UNITS}
              onChange={changeHeightUnit}
              error={fieldErrors.height_unit}
              helperText="Metric is shown first. Switch to feet/inches if that is how you measure height."
            />
            {form.height_unit === 'ft_in' ? (
              <View style={pair}>
                {/* Batch B: no placeholders on Feet / Inches. */}
                <View style={cell}>
                  {input('height_feet', {
                    label: 'Feet',
                    helperText: 'Whole feet only.',
                    error: fieldErrors.height_value ?? fieldErrors.height_feet,
                  })}
                </View>
                <View style={cell}>
                  {input('height_inches', {
                    label: 'Inches',
                    helperText: 'Use 0 to 11 inches. Leave blank if there are no extra inches.',
                  })}
                </View>
              </View>
            ) : (
              input('height_value', {
                label: form.height_unit === 'cm' ? 'Height' : 'Height (inches)',
                placeholder: form.height_unit === 'cm' ? '180' : '71',
                helperText:
                  form.height_unit === 'cm' ? 'Metric is shown first. Enter your height in centimeters.' : 'Enter your height in inches.',
              })
            )}
          </View>
          {weightRow('current_weight_value', 'Current Weight', 'current_weight_unit')}
          {weightRow(
            'goal_weight_value',
            isGoalWeightOptional(profile) ? 'Goal Weight (optional)' : 'Goal Weight',
            'goal_weight_unit'
          )}
          <View style={pair}>
            <View style={cell}>
              <DateInput
                testID="edit-profile-date-of-birth"
                label="Date of Birth (optional)"
                labelStyle={LABEL}
                value={form.date_of_birth}
                onChange={setField('date_of_birth')}
                error={fieldErrors.date_of_birth}
              />
            </View>
            <View style={cell}>
              <Select
                testID="edit-profile-sex"
                label="Sex (optional)"
                labelStyle={LABEL}
                value={form.sex}
                options={SEX_OPTIONS}
                onChange={setField('sex')}
                error={fieldErrors.sex}
              />
            </View>
          </View>
          <View style={wide ? styles.buttonsWide : styles.buttons}>
            {/* ⚠P-12: Cancel pushes a new Settings. */}
            <PillButton
              testID="edit-profile-cancel"
              title="Cancel"
              variant="secondary"
              fullWidth={!wide}
              onPress={() => navigation.push(routes.Settings)}
            />
            <PillButton
              testID="edit-profile-save"
              title="Save changes"
              fullWidth={!wide}
              loading={submitting}
              disabled={!hasChanges}
              onPress={submit}
            />
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.surfaceCard,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
    boxShadow: shadows.soft,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(229, 231, 235, 0.70)',
  },
  headerWide: {
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
  body: {
    padding: 20,
    gap: 20,
  },
  bodyWide: {
    paddingHorizontal: 24,
    paddingVertical: 20,
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
  cellWide: {
    flex: 2,
  },
  buttons: {
    gap: 12,
  },
  buttonsWide: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
});
