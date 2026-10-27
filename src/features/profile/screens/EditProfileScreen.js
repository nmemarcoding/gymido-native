import { useNavigation } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { routes } from '../../../navigation/routes';
import { getServerMessage } from '../../../shared/api/apiError';
import DateInput from '../../../shared/components/DateInput';
import ErrorAlert from '../../../shared/components/ErrorAlert';
import FormField from '../../../shared/components/FormField';
import Loader from '../../../shared/components/Loader';
import PillButton from '../../../shared/components/PillButton';
import { isTabletWidth } from '../../../shared/components/AppModal';
import GradientFill from '../../../shared/components/GradientFill';
import SegmentedSwitch from '../../../shared/components/SegmentedSwitch';
import Select from '../../../shared/components/Select';
import { CAP_BODY, TITLE_TEXT, useLargeTextReflow } from '../../../shared/components/largeText';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { colors, font, gradients, motion, radii, spacing, typography } from '../../../shared/theme/tokens';
import { useAuthStore } from '../../auth/authStore';
import ShellPage from '../../shell/ShellPage';
import { updateProfile } from '../api/profileApi';
import { numberValue } from '../createProfileForm';
import {
  buildEditProfilePayload,
  editFormFromProfile,
  editHasChanges,
  firstFieldErrors,
  isGoalWeightOptional,
  profileDisplayName,
  profileInitials,
  updateEditHeightUnit,
  validateEditProfile,
} from '../editProfileForm';
import ProfileAvatar from '../ProfileAvatar';
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
// Owner D2 (23 Oct, retires ⚠P-8; UX K): "Not set" (sends null) first,
// "Prefer not to say" once, last.
export const SEX_OPTIONS = [
  { value: '', label: 'Not set' },
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
const HEIGHT_HELPER = 'Metric is shown first. Switch to feet/inches if that is how you measure height.';
// The Tablet: Edit profile glow, radial(70% 35% at 85% −5%) in the §8.5
// gold-ambient step; the phone board draws none.
export const EDIT_PROFILE_GLOW_TABLET = Object.freeze({
  radial: Object.freeze({ cx: 0.85, cy: -0.05, rx: 0.7, ry: 0.35 }),
  colors: gradients.accountGlow.colors,
  stops: Object.freeze([0, 0.7]),
});

// Dated change (27 Oct 2026, RN-SPEC-profile P2, UX round 2): a refused save
// focuses the FIRST field in error in form order: first name, last name,
// height (the unit's errors focus its height input), current weight, goal
// weight (a unit error belongs to its weight), date of birth, sex.
const TEXT_TARGETS = ['first_name', 'last_name', 'height_value', 'height_feet', 'height_inches', 'current_weight_value', 'goal_weight_value'];

function firstEditErrorTarget(errors, heightUnit) {
  const has = (...keys) => keys.some((key) => Boolean(errors[key]));
  const ftIn = heightUnit === 'ft_in';
  if (has('first_name')) return 'first_name';
  if (has('last_name')) return 'last_name';
  if (has('height_value', 'height_unit', 'height_feet')) return ftIn ? 'height_feet' : 'height_value';
  if (has('height_inches')) return ftIn ? 'height_inches' : 'height_value';
  if (has('current_weight_value', 'current_weight_unit')) return 'current_weight_value';
  if (has('goal_weight_value', 'goal_weight_unit')) return 'goal_weight_value';
  if (has('date_of_birth')) return 'date_of_birth';
  if (has('sex')) return 'sex';
  return null;
}

// The scroll offset that puts the field's centre in the middle of the
// screen, so the phone's Save bar never covers it.
export function fieldScrollY({ y, height }, screenHeight) {
  return Math.max(0, y + height / 2 - screenHeight / 2);
}

// RN-SPEC-profile P2 (Edit profile), pushed on the Profile stack.
export default function EditProfileScreen() {
  const { width } = useWindowDimensions();
  const scrollRef = useRef(null);
  return (
    <ShellPage testID="edit-profile-screen" glow={isTabletWidth(width) ? EDIT_PROFILE_GLOW_TABLET : false} scrollRef={scrollRef}>
      <EditProfile scrollRef={scrollRef} />
    </ShellPage>
  );
}

function EditProfile({ scrollRef }) {
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
  return <EditProfileForm profile={profile} scrollRef={scrollRef} />;
}

function EditProfileForm({ profile, scrollRef }) {
  const navigation = useNavigation();
  const { width, height: screenHeight } = useWindowDimensions();
  const tablet = isTabletWidth(width);
  const reflow = useLargeTextReflow();
  const email = useAuthStore((state) => state.user?.email);
  const reducedMotion = useReducedMotion();
  const enter = useRef(new Animated.Value(0)).current;
  const [form, setForm] = useState(() => editFormFromProfile(profile));
  // What each number input shows; state keeps only valid numbers.
  const [display, setDisplay] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // One request per refused save, run after the errors render.
  const [focusRequest, setFocusRequest] = useState(null);
  const targets = useRef({});
  const bindTarget = (key) => (node) => {
    targets.current[key] = node;
  };

  // Brings the field to the middle of the screen, then focuses it.
  useEffect(() => {
    const node = focusRequest ? targets.current[focusRequest.target] : null;
    if (!node) {
      return;
    }
    const content = scrollRef?.current?.getInnerViewRef?.();
    if (content) {
      node.measureLayout?.(
        content,
        (_x, y, _w, h) => scrollRef.current?.scrollTo?.({ y: fieldScrollY({ y, height: h }, screenHeight), animated: !reducedMotion }),
        () => {}
      );
    }
    if (TEXT_TARGETS.includes(focusRequest.target)) {
      node.focus?.();
    } else {
      AccessibilityInfo.sendAccessibilityEvent(node, 'focus');
    }
    // screenHeight and reducedMotion are read at the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest]);

  function focusFirstError(errors) {
    const target = firstEditErrorTarget(errors, form.height_unit);
    if (target) {
      setFocusRequest({ target });
    }
  }

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
    if (NUMBER_FIELDS.includes(key) && !WEIGHT_FIELDS.includes(key)) {
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
      focusFirstError(errors);
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
      const serverErrors = firstFieldErrors(error);
      setFieldErrors(serverErrors);
      focusFirstError(serverErrors);
    } finally {
      setSubmitting(false);
    }
  }

  const hasChanges = editHasChanges(profile, form);

  const label = tablet ? styles.labelTablet : styles.label;
  const fieldVariant = tablet ? 'well' : 'default';
  const input = (key, props) => (
    <FormField
      ref={bindTarget(key)}
      testID={`edit-profile-${key}`}
      value={shown(key)}
      error={fieldErrors[key]}
      onChangeText={(text) => setText(key, text)}
      labelStyle={label}
      variant={fieldVariant}
      accessibilityState={{ invalid: Boolean(fieldErrors[key]) }}
      {...NO_AUTOFILL}
      {...(NUMBER_FIELDS.includes(key) ? { keyboardType: WEIGHT_FIELDS.includes(key) ? 'decimal-pad' : NUMBER_KEYBOARD } : null)}
      {...props}
    />
  );
  // Phone numbers: 56 tall, 24/28/700 tabular on surface-well (the board's
  // surface-well); tablet keeps the kit's 52 well field.
  const number = (key, props) => input(key, tablet ? props : { variant: 'well', ...props, style: [styles.bigInput, props.style] });
  // §9: past 1.3× every 2-column pair is one column.
  const pair = reflow ? styles.stacked : tablet ? styles.pairTablet : styles.pair;
  const cell = reflow ? null : styles.cell;
  const unitSelect = (unitKey, name) => (
    <Select
      testID={`edit-profile-${unitKey}`}
      accessibilityLabel={name}
      value={form[unitKey]}
      options={WEIGHT_UNITS}
      onChange={setField(unitKey)}
      boxStyle={styles.unitChip}
      textStyle={styles.unitChipText}
      trailing={null}
    />
  );

  // The code's heading and line (Q2: "Edit profile"; the tablet board's h1 +
  // line are the same two strings).
  const heading = (
    <View style={[styles.header, tablet && styles.headerTablet]}>
      {tablet ? null : <ProfileAvatar initials={profileInitials(profileDisplayName(profile, email))} size={88} testID="edit-profile-avatar" />}
      <Text {...TITLE_TEXT} accessibilityRole="header" style={[styles.title, tablet && styles.titleTablet]}>
        Edit profile
      </Text>
      <Text {...CAP_BODY} style={[styles.subtitle, tablet && styles.subtitleTablet]}>
        Update your account details and measurement preferences.
      </Text>
    </View>
  );

  const names = (
    // ⚠P-7: no placeholders on names and weights.
    <View style={pair}>
      <View style={cell}>{input('first_name', { label: 'First Name' })}</View>
      <View style={cell}>{input('last_name', { label: 'Last Name' })}</View>
    </View>
  );

  const ftIn = form.height_unit === 'ft_in';
  const heightLabel = form.height_unit === 'in' ? 'Height (inches)' : 'Height';
  const heightHelper = form.height_unit === 'cm' ? 'Metric is shown first. Enter your height in centimeters.' : 'Enter your height in inches.';
  const feetInches = (
    <>
      {/* Batch B: no placeholders on Feet / Inches. */}
      <View style={cell}>
        {number('height_feet', {
          label: 'Feet',
          helperText: 'Whole feet only.',
          error: fieldErrors.height_value ?? fieldErrors.height_feet,
        })}
      </View>
      <View style={cell}>
        {number('height_inches', {
          label: 'Inches',
          helperText: 'Use 0 to 11 inches. Leave blank if there are no extra inches.',
        })}
      </View>
    </>
  );

  // Phone: a Height card, its label beside the segmented cm · ft/in · in
  // control (the same three values as the code's Select), then the input.
  const phoneHeight = (
    <View testID="edit-profile-height-card" style={styles.fieldCard}>
      <View style={[styles.heightHead, reflow && styles.stacked]}>
        <Text {...CAP_BODY} style={[styles.label, styles.heightHeadLabel]}>
          {ftIn ? 'Height' : heightLabel}
        </Text>
        <SegmentedSwitch
          testID="edit-profile-height-unit"
          accessibilityLabel="Height unit"
          segments={HEIGHT_UNITS}
          value={form.height_unit}
          onChange={changeHeightUnit}
          compact
        />
      </View>
      <Text {...CAP_BODY} style={styles.helper}>
        {HEIGHT_HELPER}
      </Text>
      {fieldErrors.height_unit ? (
        <Text {...CAP_BODY} accessibilityRole="alert" style={styles.errorText}>
          {fieldErrors.height_unit}
        </Text>
      ) : null}
      {ftIn ? (
        <View testID="edit-profile-height-pair" style={reflow ? styles.stacked : styles.pair}>
          {feetInches}
        </View>
      ) : (
        number('height_value', {
          label: undefined,
          accessibilityLabel: heightLabel,
          placeholder: form.height_unit === 'cm' ? '180' : '71',
          helperText: heightHelper,
        })
      )}
    </View>
  );

  // Tablet: the code's Height unit Select (140) beside the input; ft/in =
  // Select + Feet + Inches in three columns.
  const heightSelect = (
    <View style={reflow ? null : styles.heightSelectCell}>
      <Select
        testID="edit-profile-height-unit"
        label="Height unit"
        labelStyle={label}
        variant="raised"
        value={form.height_unit}
        options={HEIGHT_UNITS}
        onChange={changeHeightUnit}
        error={fieldErrors.height_unit}
      />
    </View>
  );
  const tabletHeight = (
    <View>
      <View testID="edit-profile-height-pair" style={pair}>
        {ftIn ? (
          <>
            {heightSelect}
            {feetInches}
          </>
        ) : (
          <>
            <View style={cell}>
              {number('height_value', {
                label: heightLabel,
                placeholder: form.height_unit === 'cm' ? '180' : '71',
                helperText: heightHelper,
              })}
            </View>
            {heightSelect}
          </>
        )}
      </View>
      <Text {...CAP_BODY} style={[styles.helper, styles.helperTablet]}>
        {HEIGHT_HELPER}
      </Text>
    </View>
  );

  const weightLabel = (key) => (key === 'current_weight_value' ? 'Current Weight' : isGoalWeightOptional(profile) ? 'Goal Weight (optional)' : 'Goal Weight');
  const unitName = (unitKey) => (unitKey === 'current_weight_unit' ? 'Current weight unit' : 'Goal weight unit');
  // Phone: each weight is a card; the unit select sits INSIDE the input at
  // the right (36 tall, 44 hit). Tablet: input 1fr | unit Select 92.
  const weightField = (key, unitKey) =>
    tablet ? (
      <View style={cell}>
        <View style={reflow ? styles.stacked : styles.weightRowTablet}>
          <View style={cell}>{input(key, { label: weightLabel(key), helperText: `In ${form[unitKey]}.` })}</View>
          <View style={reflow ? null : styles.weightSelectCell}>
            <Select
              testID={`edit-profile-${unitKey}`}
              label="Unit"
              accessibilityLabel={unitName(unitKey)}
              labelStyle={label}
              variant="raised"
              value={form[unitKey]}
              options={WEIGHT_UNITS}
              onChange={setField(unitKey)}
              error={fieldErrors[unitKey]}
            />
          </View>
        </View>
      </View>
    ) : (
      <View testID={`edit-profile-${key}-card`} style={[styles.fieldCard, cell]}>
        {number(key, {
          label: weightLabel(key),
          helperText: `In ${form[unitKey]}.`,
          error: fieldErrors[key] ?? fieldErrors[unitKey],
          trailing: unitSelect(unitKey, unitName(unitKey)),
          style: styles.bigInputWithUnit,
        })}
      </View>
    );

  const extras = (
    <View style={pair}>
      <View ref={bindTarget('date_of_birth')} collapsable={false} testID="edit-profile-date-of-birth-field" style={cell}>
        <DateInput
          testID="edit-profile-date-of-birth"
          label="Date of Birth (optional)"
          labelStyle={label}
          value={form.date_of_birth}
          onChange={setField('date_of_birth')}
          error={fieldErrors.date_of_birth}
        />
      </View>
      <View ref={bindTarget('sex')} collapsable={false} testID="edit-profile-sex-field" style={cell}>
        <Select
          testID="edit-profile-sex"
          label="Sex (optional)"
          labelStyle={label}
          variant={fieldVariant}
          value={form.sex}
          options={SEX_OPTIONS}
          onChange={setField('sex')}
          error={fieldErrors.sex}
        />
      </View>
    </View>
  );

  // Phone: Cancel (glass, 60) + Save changes (flex 1, 60, gold); tablet: a
  // right-aligned 52 pair. Past 1.3× both stack, primary on top (§9 rule 4).
  const actions = (
    <View testID="edit-profile-actions" style={reflow ? styles.actionsStacked : tablet ? styles.actionsTablet : styles.actionsPhone}>
      {/* ⚠P-12: Cancel pushes a new Settings. */}
      <PillButton
        testID="edit-profile-cancel"
        title="Cancel"
        variant="secondary"
        size={tablet ? 'default' : 'cta'}
        fullWidth={reflow}
        onPress={() => navigation.push(routes.Settings)}
      />
      <View style={reflow || tablet ? null : styles.saveCell}>
        <PillButton
          testID="edit-profile-save"
          title="Save changes"
          size={tablet ? 'default' : 'cta'}
          fullWidth={!tablet || reflow}
          loading={submitting}
          disabled={!hasChanges}
          onPress={submit}
        />
      </View>
    </View>
  );

  const fields = (
    <>
      {/* The refusal box is the shared ErrorAlert (RN-SPEC-profile P2, dated 27 Oct). */}
      {errorMessage ? <ErrorAlert testID="edit-profile-error" title="Something went wrong" description={errorMessage} /> : null}
      {names}
      {tablet ? tabletHeight : phoneHeight}
      <View style={pair}>
        {weightField('current_weight_value', 'current_weight_unit')}
        {weightField('goal_weight_value', 'goal_weight_unit')}
      </View>
      {extras}
      {actions}
    </>
  );

  const enterStyle = { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [motion.cardOffsetY, 0] }) }] };

  if (tablet) {
    return (
      <Animated.View testID="edit-profile-tablet" style={[styles.tabletColumn, enterStyle]}>
        {heading}
        <View testID="edit-profile-card" style={styles.card}>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <GradientFill angle={gradients.card.angle} colors={gradients.card.colors} />
          </View>
          {fields}
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View testID="edit-profile-phone" style={[styles.phoneColumn, enterStyle]}>
      {heading}
      {fields}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Phone: the form sits on the ground, gap 14.
  phoneColumn: {
    gap: spacing['3_5'],
    paddingBottom: spacing[6],
  },
  // Tablet: content centred at max 640 (the board's ≈ 650 column), gap 18.
  tabletColumn: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    gap: spacing['4_5'],
    paddingBottom: spacing[6],
  },
  header: {
    alignItems: 'center',
    gap: spacing['2_5'],
    paddingBottom: spacing[1],
  },
  headerTablet: {
    alignItems: 'flex-start',
    gap: spacing[2],
    paddingBottom: 0,
  },
  title: {
    ...typography.titleSm,
    textAlign: 'center',
    color: colors.textPrimary,
  },
  titleTablet: {
    ...typography.titleLg,
    textAlign: 'left',
  },
  // Caption 14/20 secondary centred (tablet line 15 secondary).
  subtitle: {
    ...typography.bodySm,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  subtitleTablet: {
    ...typography.body,
    textAlign: 'left',
  },
  // Form card: radius 28, padding 28, gradient-card (the drawn
  // 1B1D24 → 13151A folds into it), hairline, gap 20.
  card: {
    gap: spacing[5],
    padding: spacing[7],
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
  },
  // Labels: phone 13/500 text-secondary (pad-left 4); tablet 14/500 text-strong-2.
  label: {
    ...typography.label,
    paddingLeft: spacing[1],
    color: colors.textSecondary,
  },
  labelTablet: {
    ...typography.bodySm,
    ...font(500),
    color: colors.textStrong2,
  },
  pair: {
    flexDirection: 'row',
    gap: spacing['2_5'],
  },
  pairTablet: {
    flexDirection: 'row',
    gap: spacing[4],
  },
  stacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: spacing[3],
  },
  cell: {
    flex: 1,
    minWidth: 0,
  },
  // Height / weight cards: radius 24, padding 14, surface + hairline, gap 10.
  fieldCard: {
    gap: spacing['2_5'],
    padding: spacing['3_5'],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  heightHead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  heightHeadLabel: {
    flexShrink: 1,
  },
  helper: {
    ...typography.caption,
    color: colors.textMuted,
  },
  helperTablet: {
    ...typography.label,
    ...font(400),
    marginTop: spacing[2],
  },
  errorText: {
    ...typography.caption,
    color: colors.dangerText,
  },
  // 56 tall (inside the 1 px edge), 24/28/700 tabular.
  bigInput: {
    ...font(700),
    minHeight: 54,
    paddingVertical: 0,
    paddingLeft: spacing['3_5'],
    paddingRight: spacing['3_5'],
    fontSize: typography.titleMd.fontSize,
    letterSpacing: typography.titleMd.letterSpacing,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  // Clear of the in-field unit select (padding 0 48 0 14 as drawn, + the
  // 44 hit of the select).
  bigInputWithUnit: {
    paddingRight: 64,
  },
  // The in-field unit select: fill-glass, 13/600. (Drawn radius 10: no
  // token, sm 12.) Review M5: 44 tall (drawn 36) so the target is 44 x 44;
  // the kit Select has no hitSlop, and it still fits the 56 field.
  unitChip: {
    minHeight: 44,
    minWidth: 44,
    paddingVertical: 0,
    paddingHorizontal: spacing['2_5'],
    borderRadius: radii.sm,
    borderWidth: 0,
    backgroundColor: colors.fillGlass,
    justifyContent: 'center',
  },
  unitChipText: {
    ...typography.label,
    ...font(600),
    color: colors.textPrimary,
  },
  heightSelectCell: {
    width: 140,
  },
  weightRowTablet: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  weightSelectCell: {
    width: 92,
  },
  actionsPhone: {
    flexDirection: 'row',
    gap: spacing['2_5'],
    marginTop: spacing[1],
  },
  saveCell: {
    flex: 1,
  },
  actionsTablet: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing['2_5'],
  },
  // Primary on top, both full width.
  actionsStacked: {
    flexDirection: 'column-reverse',
    gap: spacing['2_5'],
  },
});
