import { useNavigation } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { routes } from '../../../../navigation/routes';
import { getServerMessage, getStatus } from '../../../../shared/api/apiError';
import BackPill, { backPillLabel } from '../../../../shared/components/BackPill';
import ErrorAlert from '../../../../shared/components/ErrorAlert';
import FormField from '../../../../shared/components/FormField';
import GradientFill from '../../../../shared/components/GradientFill';
import PillButton from '../../../../shared/components/PillButton';
import PinnedDock, { dockButtonsHeight, dockStacks } from '../../../../shared/components/PinnedDock';
import Select from '../../../../shared/components/Select';
import { ToastTone, addToast } from '../../../../shared/components/toastStore';
import { useFocusRemountKey } from '../../../../shared/hooks/useFocusRemountKey';
import {
  breakpoints,
  colors,
  gradients,
  radii,
  shadows,
  spacing,
  textScale,
  titleTracking,
  typography,
} from '../../../../shared/theme/tokens';
import ShellPage from '../../../shell/ShellPage';
import { useInnerBack } from '../../../shell/useInnerBack';
import TrainerOnly from '../../TrainerOnly';
import { createTrainerPlan, listDifficultyLevels, listPlanCategories } from '../api/plansApi';
import { PageSubtitle, PageTitle, PlanPage, TextLink } from '../components/PlanPage';
import TrainerCreatePlanLayout from '../components/TrainerCreatePlanLayout';
import { slugify } from '../planFormat';
import { buildCreatePlanPayload, validateCreatePlan } from '../planValidation';
import { HeroTitleMark } from '../../../shell/heroTitle';

const DAYS_OPTIONS = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: String(n), label: String(n) }));

// The create form's per-audience differences (trainer T2 §A9; the member M2
// variant lives with My plans).
const TRAINER_VARIANT = {
  backLabel: '← All plans',
  // T-65 (PHONE-NAV spec §3): the back pill's parent when there is no history.
  backPath: '/trainer/plans',
  subtitle: 'Private to you. Only clients you assign it to will see it.',
  namePlaceholder: 'Client A – Hypertrophy',
  showSlug: true,
  create: (values) => createTrainerPlan(buildCreatePlanPayload(values)),
  planRoute: routes.TrainerPlan,
  // v2 Phase 6 O: the trainer boards' look (TrainerCreatePlanLayout); the
  // fields take the kit "well" box (surface-well, radius 16, hairline-strong).
  look: 'trainerV2',
  fieldVariant: 'well',
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
  const { width, fontScale } = useWindowDimensions();
  const wide = width >= breakpoints.sm;
  // The kit field box per variant (FormField FIELD_VARIANTS); default for M2.
  const fieldVariant = variant.fieldVariant ?? 'default';
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
      // `saving` stays true: this screen unmounts here. REPLACE, not push, so
      // no create form is left in the history (T-74 review M1; T-65 carry):
      // the builder's back / delete never lands on a stale, saving form.
      navigation.replace(variant.planRoute, { planId: plan?.id });
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

  const nameField = (
    <FormField
      testID="create-plan-name"
      variant={fieldVariant}
      label="Name"
      placeholder={variant.namePlaceholder}
      value={values.name}
      editable={!saving}
      error={errors.name}
      onChangeText={(text) => update('name', 'name', text)}
    />
  );
  const slugField = variant.showSlug ? (
    <FormField
      testID="create-plan-slug"
      variant={fieldVariant}
      label="Slug"
      autoCapitalize="none"
      autoCorrect={false}
      helperText="Lowercase letters, numbers, hyphens and underscores."
      value={values.slug}
      editable={!saving}
      error={errors.slug}
      onChangeText={(text) => update('slug', 'slug', text)}
    />
  ) : null;
  const categoryField = (
    <Select
      testID="create-plan-category"
      variant={fieldVariant}
      label="Category"
      value={values.categoryId}
      options={categoryOptions}
      disabled={saving}
      error={errors.category_id}
      onChange={(value) => update('categoryId', 'category_id', value)}
    />
  );
  const daysField = (
    <Select
      testID="create-plan-days"
      variant={fieldVariant}
      label="Days per week"
      value={values.daysPerWeek}
      options={DAYS_OPTIONS}
      disabled={saving}
      onChange={(value) => update('daysPerWeek', 'days_per_week', value)}
    />
  );
  const difficultyField = (
    <Select
      testID="create-plan-difficulty"
      variant={fieldVariant}
      label="Difficulty (optional)"
      value={values.difficultyLevelId}
      options={levelOptions}
      disabled={saving}
      onChange={(value) => update('difficultyLevelId', 'difficulty_level_id', value)}
    />
  );
  const descriptionField = (rows) => (
    <FormField
      testID="create-plan-description"
      variant={fieldVariant}
      label="Description (optional)"
      multiline
      rows={rows}
      value={values.description}
      editable={!saving}
      onChangeText={(text) => update('description', 'description', text)}
    />
  );
  const formErrorAlert = formError ? (
    <ErrorAlert title="Could not create the plan" description={formError} style={styles.formError} />
  ) : null;
  // T-65 (PHONE-NAV spec §3 / §5): back (the pill and Cancel) goes back in
  // history, else replaces to the variant's parent; Android back the same.
  const goBack = useInnerBack(navigation, variant.backPath);

  // UX native final audit 27 Oct 2026, ruling 1 (B218, D365): on phones at
  // ≤ 1.3× the Cancel / Create pair sits in the shared PinnedDock above the tab
  // bar (below 21rem it stacks, Create on top); tablets and large text keep
  // it at the end of the card.
  const docked = width < breakpoints.md && fontScale <= textScale.reflowAbove;
  const narrow = dockStacks(width);

  if (variant.look === 'trainerV2') {
    return (
      <TrainerCreatePlanLayout
        tablet={width >= breakpoints.md}
        stacked={fontScale > textScale.reflowAbove}
        docked={docked}
        narrow={narrow}
        variant={variant}
        saving={saving}
        onSubmit={submit}
        onBack={goBack}
        formErrorAlert={formErrorAlert}
        fields={{ nameField, slugField, categoryField, daysField, difficultyField, descriptionField }}
      />
    );
  }

  if (variant.look === 'v2') {
    return (
      <CreatePlanV2
        tablet={width >= breakpoints.md}
        stacked={fontScale > textScale.reflowAbove}
        docked={docked}
        narrow={narrow}
        variant={variant}
        saving={saving}
        onSubmit={submit}
        onBack={goBack}
        formErrorAlert={formErrorAlert}
        fields={{ nameField, categoryField, daysField, difficultyField, descriptionField }}
      />
    );
  }

  return (
    <PlanPage maxWidth={672} testID="create-plan-screen">
      <View>
        <TextLink testID="create-plan-all-plans" label={variant.backLabel} onPress={goBack} />
        <PageTitle>Create a plan</PageTitle>
        <PageSubtitle>{variant.subtitle}</PageSubtitle>
      </View>
      <View style={[styles.card, { padding: wide ? 32 : 24 }]}>
        {formErrorAlert}
        <View style={styles.fields}>
          {nameField}
          {slugField}
          {categoryField}
          {daysField}
          {difficultyField}
          {descriptionField(4)}
        </View>
        <View style={styles.buttons}>
          <PillButton testID="create-plan-submit" title="Create and add days" loading={saving} onPress={submit} />
          <PillButton testID="create-plan-cancel" title="Cancel" variant="secondary" onPress={goBack} />
        </View>
      </View>
    </PlanPage>
  );
}

// v2 Phase 2 C3 (UX C §My plan create / §Tablet), the member variant's look
// (`look: 'v2'`): the ambient gold glow, a display title, the gradient form
// card, Category + Days paired on phones (Days + Difficulty on tablets), and
// Cancel before the gold "Create and add days". Fields keep the kit 1 inputs
// (UX ruling: only search fields take the pill variant). Behaviour: the same
// form state, validation and messages as above.
// The glow keeps each board's geometry; its colour is the §8.5 glow-gold-
// ambient (0.18, the shared ladder constant).
export const CREATE_GLOW = Object.freeze({
  radial: Object.freeze({ cx: 0.85, cy: -0.06, rx: 1.1, ry: 0.4 }),
  colors: gradients.accountGlow.colors,
  stops: Object.freeze([0, 0.6]),
});
export const TABLET_CREATE_GLOW = Object.freeze({
  ...CREATE_GLOW,
  radial: Object.freeze({ cx: 0.9, cy: -0.06, rx: 0.7, ry: 0.4 }),
});
// The tablet form card's drawn 160° gradient folds onto surface-input →
// surface-sunk (UX §8.4); phones keep gradient-card.
export const TABLET_CARD_FILL = Object.freeze({ angle: 160, colors: Object.freeze([colors.surfaceInput, colors.surfaceSunk]) });

// Large text (UX §9): the page title is capped at 1.3×, wraps by word (max 3
// lines) and shrinks a single long word; body text is capped at 2×.
const TITLE_TEXT = Object.freeze({
  textBreakStrategy: 'simple',
  maxFontSizeMultiplier: textScale.display,
  numberOfLines: 3,
  adjustsFontSizeToFit: true,
  minimumFontScale: 0.7,
});
const BODY_TEXT = Object.freeze({ maxFontSizeMultiplier: textScale.body });

// `stacked` (font scale > 1.3, UX §9 reflow): the paired fields become one
// column and the button pair stacks with the primary on top, full width.
// `docked` (phone, ≤ 1.3×): the pair sits in the shared PinnedDock (ruling 1,
// B218); `narrow` (< 21rem): there it stacks, Create (52) over Cancel (52).
function CreatePlanV2({ tablet, stacked = false, docked = false, narrow = false, variant, saving, onSubmit, onBack, formErrorAlert, fields }) {
  const { nameField, categoryField, daysField, difficultyField, descriptionField } = fields;
  // The dock's live height (null until measured): the page's scroll room.
  const [dockHeight, setDockHeight] = useState(null);
  const dockStacked = docked && narrow;
  const buttonsStacked = stacked || dockStacked;
  const pairStyle = [v2.pair, tablet && v2.pairTablet, stacked && v2.pairStacked];
  const cellStyle = stacked ? null : v2.pairCell;
  const cancel = (
    <PillButton
      key="cancel"
      testID="create-plan-cancel"
      title="Cancel"
      variant="secondary"
      onPress={onBack}
      style={stacked ? v2.buttonStacked : dockStacked ? v2.buttonDockStacked : tablet ? null : v2.buttonPhone}
    />
  );
  const submit = (
    <PillButton
      key="submit"
      testID="create-plan-submit"
      title="Create and add days"
      loading={saving}
      onPress={onSubmit}
      style={stacked ? v2.buttonStacked : dockStacked ? v2.buttonDockStacked : tablet ? null : [v2.buttonPhone, v2.submitPhone]}
    />
  );
  const buttons = (
    <View testID="create-plan-buttons" style={[v2.buttons, tablet && v2.buttonsTablet, buttonsStacked && v2.buttonsStacked, docked && v2.buttonsDocked]}>
      {buttonsStacked ? [submit, cancel] : [cancel, submit]}
    </View>
  );
  return (
    <View style={v2.screen}>
      <ShellPage testID="create-plan-screen" glow={tablet ? TABLET_CREATE_GLOW : CREATE_GLOW} dockHeight={docked ? dockHeight : null}>
        <View testID="create-plan-column" style={[v2.column, tablet && v2.columnTablet]}>
          <View>
            {/* T-65 (PHONE-NAV spec §3): the kit glass back pill "‹ My plans" (was the gold text link). */}
            <BackPill testID="create-plan-all-plans" label={backPillLabel(variant.backLabel)} onPress={onBack} />
            <HeroTitleMark />
            <Text {...TITLE_TEXT} accessibilityRole="header" style={tablet ? v2.titleTablet : v2.title}>
              Create a plan
            </Text>
            <Text {...BODY_TEXT} style={[v2.subtitle, tablet && v2.subtitleTablet]}>
              {variant.subtitle}
            </Text>
          </View>
          <View testID="create-plan-card" style={[v2.card, tablet && v2.cardTablet]}>
            <GradientFill
              angle={tablet ? TABLET_CARD_FILL.angle : gradients.card.angle}
              colors={tablet ? TABLET_CARD_FILL.colors : gradients.card.colors}
            />
            {formErrorAlert}
            <View style={[v2.fields, tablet && v2.fieldsTablet]}>
              {nameField}
              {tablet ? (
                <>
                  {categoryField}
                  <View testID="create-plan-pair" style={pairStyle}>
                    <View style={cellStyle}>{daysField}</View>
                    <View style={cellStyle}>{difficultyField}</View>
                  </View>
                </>
              ) : (
                <>
                  <View testID="create-plan-pair" style={pairStyle}>
                    <View style={cellStyle}>{categoryField}</View>
                    <View style={cellStyle}>{daysField}</View>
                  </View>
                  {difficultyField}
                </>
              )}
              {descriptionField(tablet ? 4 : 2)}
            </View>
            {docked ? null : buttons}
          </View>
        </View>
      </ShellPage>
      {docked ? (
        <PinnedDock
          testID="create-plan-dock"
          onHeight={setDockHeight}
          // T-74 (QA L1): Cancel / Create stay visible above the keyboard.
          liftWithKeyboard
          contentStyle={v2.dockContent}
          // Until measured: Create (52) over Cancel (52) below 21rem, else the 56 phone pair.
          estimate={dockStacked ? dockButtonsHeight({ rows: 2 }) : dockButtonsHeight({ buttonHeight: v2.buttonPhone.minHeight })}
        >
          {buttons}
        </PinnedDock>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
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

const v2 = StyleSheet.create({
  screen: {
    flex: 1,
  },
  // The docked pair keeps the phone's 16 sides (the dock is edge to edge).
  dockContent: {
    paddingHorizontal: spacing[4],
  },
  column: {
    width: '100%',
    maxWidth: 672,
    alignSelf: 'center',
    gap: spacing[3],
    paddingBottom: spacing[6],
  },
  columnTablet: {
    maxWidth: 600,
    gap: spacing[4],
  },

  // 46/44 is between title-xl and display-md: display-md (UX).
  title: {
    ...typography.displayMd,
    color: colors.textPrimary,
  },
  // 60/60 is above display-xl ([no token], built as drawn).
  titleTablet: {
    ...typography.displayXl,
    fontSize: 60,
    lineHeight: 60,
    letterSpacing: titleTracking(60, -0.055),
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    marginTop: spacing['1_5'],
    color: colors.textSecondary,
  },
  subtitleTablet: {
    ...typography.bodyLg,
    marginTop: spacing[2],
  },
  card: {
    marginTop: spacing[1],
    overflow: 'hidden',
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.choiceBorder,
    padding: spacing['4_5'],
  },
  cardTablet: {
    marginTop: spacing[2],
    padding: spacing[7],
  },
  fields: {
    gap: spacing[3],
  },
  fieldsTablet: {
    gap: spacing[5],
  },
  pair: {
    flexDirection: 'row',
    gap: spacing['2_5'],
  },
  pairTablet: {
    gap: spacing[4],
  },
  pairStacked: {
    flexDirection: 'column',
  },
  pairCell: {
    flex: 1,
    minWidth: 0,
  },
  buttons: {
    marginTop: spacing[4],
    flexDirection: 'row',
    gap: spacing['2_5'],
  },
  buttonsTablet: {
    marginTop: spacing[5],
    justifyContent: 'flex-end',
    gap: spacing[3],
  },
  buttonsStacked: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
  },
  buttonStacked: {
    width: '100%',
    minHeight: 56,
  },
  // In the dock below 21rem: full width at the kit's 52.
  buttonDockStacked: {
    width: '100%',
  },
  buttonsDocked: {
    marginTop: 0,
  },
  buttonPhone: {
    minHeight: 56,
    paddingHorizontal: spacing['5_5'],
  },
  submitPhone: {
    flex: 1,
  },
});
