import { useNavigation } from '@react-navigation/native';
import { Children, useEffect, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { routes } from '../../navigation/routes';
import { useLayoutMetrics } from '../../navigation/shell/layoutMetrics';
import { getWebApiErrorMessage } from '../../shared/api/apiError';
import { InlineError, SuccessState } from '../../shared/components/feedback';
import DateInput from '../../shared/components/form/DateInput';
import Input from '../../shared/components/form/Input';
import Select from '../../shared/components/form/Select';
import WebButton from '../../shared/components/ui/WebButton';
import { useReducedMotion } from '../../shared/hooks/useReducedMotion';
import { colors, radii, shadows } from '../../shared/theme/tokens';
import { useAuthStore } from '../auth/authStore';
import { createProfile } from './api/profileApi';
import {
  applyHeightUnit,
  buildPayload,
  HEIGHT_UNIT_OPTIONS,
  INITIAL_FORM,
  SEX_OPTIONS,
  validate,
  WEIGHT_UNIT_OPTIONS,
} from './profileCreateRules';
import { setProfile } from './profileStore';

const EASE_OUT = Easing.bezier(0, 0, 0.58, 1);

// Responsive row: 1 column below 640, otherwise columns by flex weight.
function Row({ wide, weights, children }) {
  const items = Children.toArray(children);
  return (
    <View style={[styles.row, wide && styles.rowWide]}>
      {items.map((child, index) => (
        <View key={index} style={wide ? { flex: weights[index], minWidth: 0 } : null}>
          {child}
        </View>
      ))}
    </View>
  );
}

// Surface card with the web fadeUp entrance (240ms ease-out, 8px).
function EnterCard({ children }) {
  const reducedMotion = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(1);
      return undefined;
    }
    const animation = Animated.timing(progress, { toValue: 1, duration: 240, easing: EASE_OUT, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [progress, reducedMotion]);
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });
  return (
    <Animated.View style={[styles.card, { opacity: progress, transform: [{ translateY }] }]}>{children}</Animated.View>
  );
}

// Create profile (RN-SPEC-profile-create). One screen, one form: no wizard,
// skip, back or logout (⚠P7). Full-bleed card, no gutters (⚠P1).
export default function CreateProfileScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { gutter } = useLayoutMetrics();
  const wide = gutter === 20;
  const [form, setForm] = useState(INITIAL_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef(form);
  formRef.current = form;

  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    const current = formRef.current;
    setErrorMessage('');
    setSuccessMessage('');

    const errors = validate(current);
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await createProfile(buildPayload(current));
      setProfile(data?.profile ?? data ?? null);
      useAuthStore.setState({ profileMissing: false });
      // ⚠P6: set, then leave in the same tick.
      setSuccessMessage('Profile created successfully. Redirecting you to the app.');
      navigation.replace(routes.Home);
    } catch (error) {
      // ⚠P7: a 409 leaves the user here with no way out until a cold start.
      setErrorMessage(
        error?.response?.status === 409 ? 'A profile already exists for this account.' : getWebApiErrorMessage(error)
      );
      const serverErrors = error?.response?.data?.errors ?? {};
      setFieldErrors(
        Object.fromEntries(Object.keys(serverErrors).map((key) => [key, serverErrors[key]?.[0] || '']))
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const heightUnit = form.height_unit;

  return (
    <ScrollView
      testID="create-profile-screen"
      style={styles.screen}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={{
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }}
    >
      <EnterCard>
        <View style={[styles.header, wide ? styles.headerWide : styles.headerNarrow]}>
          <View>
            <Text accessibilityRole="header" style={styles.title}>
              Create Profile
            </Text>
            <Text style={styles.subtitle}>A quick setup so we can tailor your workout plan.</Text>
          </View>
        </View>

        <View style={[styles.content, wide && styles.contentWide]}>
          {successMessage ? <SuccessState message={successMessage} /> : null}
          {errorMessage ? <InlineError message={errorMessage} /> : null}

          <View style={styles.form}>
            <Row wide={wide} weights={[1, 1]}>
              <Input
                label="First Name"
                placeholder="John"
                value={form.first_name}
                onChangeValue={set('first_name')}
                error={fieldErrors.first_name}
                onSubmit={submit}
              />
              <Input
                label="Last Name"
                placeholder="Doe"
                value={form.last_name}
                onChangeValue={set('last_name')}
                error={fieldErrors.last_name}
                onSubmit={submit}
              />
            </Row>

            {/* HeightField (§3.3) */}
            <View style={styles.form}>
              <Select
                label="Height unit"
                testID="height-unit"
                value={heightUnit}
                options={HEIGHT_UNIT_OPTIONS}
                onChangeValue={(unit) => setForm((current) => applyHeightUnit(current, unit))}
                // [O6] native copy.
                helperText="Feet and inches are shown first. Switch to cm or inches if that is how you measure height."
                error={fieldErrors.height_unit}
              />
              {heightUnit === 'ft_in' ? (
                <Row wide={wide} weights={[1, 1]}>
                  <Input
                    type="number"
                    label="Feet"
                    placeholder="5"
                    value={form.height_feet}
                    onChangeValue={set('height_feet')}
                    helperText="Whole feet only."
                    error={fieldErrors.height_value || fieldErrors.height_feet}
                    onSubmit={submit}
                  />
                  <Input
                    type="number"
                    label="Inches"
                    placeholder="9"
                    value={form.height_inches}
                    onChangeValue={set('height_inches')}
                    helperText="Use 0 to 11 inches. Leave blank if there are no extra inches."
                    error={fieldErrors.height_inches}
                    onSubmit={submit}
                  />
                </Row>
              ) : (
                <Input
                  type="number"
                  label={heightUnit === 'in' ? 'Height (inches)' : 'Height'}
                  placeholder={heightUnit === 'in' ? '71' : '180'}
                  value={form.height_value}
                  onChangeValue={set('height_value')}
                  helperText={
                    heightUnit === 'in'
                      ? 'Enter your height in inches.'
                      : 'Enter your height in centimeters.' // [O6] native copy
                  }
                  error={fieldErrors.height_value}
                  onSubmit={submit}
                />
              )}
            </View>

            {/* [O5] One full-width shared "Weight unit" (lb, kg; default lb) right after
                height, then both weights as full-width rows. No helper, no error. */}
            <Select
              label="Weight unit"
              testID="weight-unit"
              value={form.weight_unit}
              options={WEIGHT_UNIT_OPTIONS}
              onChangeValue={set('weight_unit')}
            />
            <Input
              type="number"
              label="Current Weight"
              placeholder="82.5"
              value={form.current_weight_value}
              onChangeValue={set('current_weight_value')}
              error={fieldErrors.current_weight_value}
              onSubmit={submit}
            />
            <Input
              type="number"
              label="Goal Weight"
              placeholder="78"
              value={form.goal_weight_value}
              onChangeValue={set('goal_weight_value')}
              error={fieldErrors.goal_weight_value}
              onSubmit={submit}
            />

            <Row wide={wide} weights={[1, 1]}>
              {/* ⚠P4: server errors for these two have nowhere to render. */}
              <DateInput label="Date of Birth" value={form.date_of_birth} onChangeValue={set('date_of_birth')} />
              <Select label="Sex" value={form.sex} options={SEX_OPTIONS} onChangeValue={set('sex')} />
            </Row>

            <WebButton title="Create profile" fullWidth loading={isSubmitting} onPress={submit} testID="create-profile-submit" />
          </View>
        </View>
      </EnterCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  card: {
    width: '100%',
    borderRadius: radii.surfaceCard,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
    boxShadow: shadows.plansSoft,
    overflow: 'hidden',
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(229,231,235,0.70)',
    paddingVertical: 16,
  },
  headerNarrow: {
    flexDirection: 'column',
    gap: 16,
    paddingHorizontal: 20,
  },
  headerWide: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  row: {
    gap: 16,
  },
  rowWide: {
    flexDirection: 'row',
  },
});
