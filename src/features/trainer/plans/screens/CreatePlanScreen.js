import { useNavigation } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { routes } from '../../../../navigation/routes';
import { getServerMessage, getStatus } from '../../../../shared/api/apiError';
import ErrorAlert from '../../../../shared/components/ErrorAlert';
import FormField from '../../../../shared/components/FormField';
import PillButton from '../../../../shared/components/PillButton';
import Select from '../../../../shared/components/Select';
import { ToastTone, addToast } from '../../../../shared/components/toastStore';
import { useFocusRemountKey } from '../../../../shared/hooks/useFocusRemountKey';
import { breakpoints, colors, radii, shadows } from '../../../../shared/theme/tokens';
import TrainerOnly from '../../TrainerOnly';
import { createTrainerPlan, listDifficultyLevels, listPlanCategories } from '../api/plansApi';
import { PageSubtitle, PageTitle, PlanPage, TextLink } from '../components/PlanPage';
import { slugify } from '../planFormat';
import { buildCreatePlanPayload, validateCreatePlan } from '../planValidation';

const DAYS_OPTIONS = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: String(n), label: String(n) }));

// The create form's per-audience differences (trainer T2 §A9; the member M2
// variant lives with My plans).
const TRAINER_VARIANT = {
  backLabel: '← All plans',
  backRoute: routes.TrainerPlans,
  subtitle: 'Private to you. Only clients you assign it to will see it.',
  namePlaceholder: 'Client A – Hypertrophy',
  showSlug: true,
  create: (values) => createTrainerPlan(buildCreatePlanPayload(values)),
  planRoute: routes.TrainerPlan,
};

// T2 (spec §A9). Remounts on every focus, so back from T3 shows an empty form.
export default function CreatePlanScreen() {
  const remountKey = useFocusRemountKey();
  return (
    <TrainerOnly>
      <CreatePlanForm key={remountKey} variant={TRAINER_VARIANT} />
    </TrainerOnly>
  );
}

// Shared with the member's M2 form, which passes its own variant.
export function CreatePlanForm({ variant }) {
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const wide = width >= breakpoints.sm;
  const mounted = useRef(true);
  const [categories, setCategories] = useState([]);
  const [levels, setLevels] = useState([]);
  const [values, setValues] = useState({
    name: '',
    slug: '',
    categoryId: '',
    daysPerWeek: '3',
    difficultyLevelId: '',
    description: '',
  });
  const [slugEdited, setSlugEdited] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    mounted.current = true;
    // ⚠T2-2: a failed category load leaves the form unsubmittable.
    listPlanCategories()
      .catch(() => [])
      .then((items) => mounted.current && setCategories(items));
    listDifficultyLevels()
      .catch(() => [])
      .then((items) => mounted.current && setLevels(items));
    return () => {
      mounted.current = false;
    };
  }, []);

  function update(field, errorKey, value) {
    setValues((current) => {
      const next = { ...current, [field]: value };
      if (field === 'name' && !slugEdited) {
        next.slug = slugify(value);
      }
      return next;
    });
    if (field === 'slug') {
      setSlugEdited(true);
    }
    setErrors((current) => ({ ...current, [errorKey]: undefined }));
    setFormError('');
  }

  async function submit() {
    if (saving) {
      return;
    }
    const nextErrors = validateCreatePlan(variant.showSlug ? values : { ...values, slug: 'x' });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    setSaving(true);
    try {
      const plan = await variant.create(values);
      addToast(ToastTone.success, 'Plan created', 'Add days and exercises to build it out.');
      // `saving` stays true: the web page unmounts here.
      navigation.push(variant.planRoute, { planId: plan?.id });
    } catch (error) {
      if (!mounted.current) {
        return;
      }
      const status = getStatus(error);
      if (!variant.showSlug && (status === 409 || status === 403)) {
        // M2: shown as the form error with the server message.
        setFormError(getServerMessage(error));
      } else if (status === 409) {
        const message = error?.response?.data?.message;
        setErrors((current) => ({ ...current, slug: message || 'This slug is already in use.' }));
      } else if (status === 422) {
        // ⚠T2-1: the top-level message, usually "Validation failed".
        setFormError(getServerMessage(error));
      } else {
        setFormError('We could not create the plan. Please try again.');
      }
      setSaving(false);
    }
  }

  const categoryOptions = [
    { value: '', label: 'Select a category' },
    ...categories.map((category) => ({ value: String(category.id), label: category.name })),
  ];
  const levelOptions = [
    { value: '', label: 'No difficulty set' },
    ...levels.map((level) => ({ value: String(level.id), label: level.name })),
  ];

  return (
    <PlanPage maxWidth={672} testID="create-plan-screen">
      <View>
        <TextLink testID="create-plan-all-plans" label={variant.backLabel} onPress={() => navigation.push(variant.backRoute)} />
        <PageTitle>Create a plan</PageTitle>
        <PageSubtitle>{variant.subtitle}</PageSubtitle>
      </View>
      <View style={[styles.card, { padding: wide ? 32 : 24 }]}>
        {formError ? (
          <ErrorAlert title="Could not create the plan" description={formError} style={styles.formError} />
        ) : null}
        <View style={styles.fields}>
          <FormField
            testID="create-plan-name"
            label="Name"
            placeholder={variant.namePlaceholder}
            value={values.name}
            editable={!saving}
            error={errors.name}
            onChangeText={(text) => update('name', 'name', text)}
          />
          {variant.showSlug ? (
          <FormField
            testID="create-plan-slug"
            label="Slug"
            autoCapitalize="none"
            autoCorrect={false}
            helperText="Lowercase letters, numbers, hyphens and underscores."
            value={values.slug}
            editable={!saving}
            error={errors.slug}
            onChangeText={(text) => update('slug', 'slug', text)}
          />
          ) : null}
          <Select
            testID="create-plan-category"
            label="Category"
            value={values.categoryId}
            options={categoryOptions}
            disabled={saving}
            error={errors.category_id}
            onChange={(value) => update('categoryId', 'category_id', value)}
          />
          <Select
            testID="create-plan-days"
            label="Days per week"
            value={values.daysPerWeek}
            options={DAYS_OPTIONS}
            disabled={saving}
            onChange={(value) => update('daysPerWeek', 'days_per_week', value)}
          />
          <Select
            testID="create-plan-difficulty"
            label="Difficulty (optional)"
            value={values.difficultyLevelId}
            options={levelOptions}
            disabled={saving}
            onChange={(value) => update('difficultyLevelId', 'difficulty_level_id', value)}
          />
          <FormField
            testID="create-plan-description"
            label="Description (optional)"
            multiline
            rows={4}
            value={values.description}
            editable={!saving}
            onChangeText={(text) => update('description', 'description', text)}
          />
        </View>
        <View style={styles.buttons}>
          <PillButton testID="create-plan-submit" title="Create and add days" loading={saving} onPress={submit} />
          <PillButton
            testID="create-plan-cancel"
            title="Cancel"
            variant="secondary"
            onPress={() => navigation.push(variant.backRoute)}
          />
        </View>
      </View>
    </PlanPage>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.surfaceCard,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
    boxShadow: shadows.soft,
  },
  formError: {
    marginBottom: 20,
  },
  fields: {
    gap: 20,
  },
  buttons: {
    marginTop: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
});
