import { useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View, findNodeHandle, useWindowDimensions } from 'react-native';

import { routes } from '../../../navigation/routes';
import { getServerMessage } from '../../../shared/api/apiError';
import BackPill from '../../../shared/components/BackPill';
import ConfirmDialog from '../../../shared/components/ConfirmDialog';
import ErrorAlert from '../../../shared/components/ErrorAlert';
import ExerciseImage from '../../../shared/components/ExerciseImage';
import IconButton from '../../../shared/components/IconButton';
import { CAP_BODY, DISPLAY_TITLE_TEXT, NAME_TEXT, TITLE_TEXT } from '../../../shared/components/largeText';
import Loader from '../../../shared/components/Loader';
import PillButton, { BUTTON_HEIGHTS } from '../../../shared/components/PillButton';
import PinnedDock, { dockButtonsHeight } from '../../../shared/components/PinnedDock';
import Select from '../../../shared/components/Select';
import { ToastTone, addToast } from '../../../shared/components/toastStore';
import { useFocusRemountKey } from '../../../shared/hooks/useFocusRemountKey';
import GradientFill from '../../../shared/components/GradientFill';
import { breakpoints, colors, font, gradients, radii, spacing, titleTracking, typography } from '../../../shared/theme/tokens';
import ShellPage from '../../shell/ShellPage';
import { handOffToWorkout, openOnboardingDays, openShellPath } from '../../shell/shellLinks';
import { acceptGeneratedPlan, getGeneratorProfile, previewGeneratedPlan, saveGeneratorProfile } from '../api/generatorApi';
import { Callout, MuscleLabel, WhyLine } from '../components/GeneratorControls';
import { ChevronLeftIcon } from '../components/GeneratorIcons';
import { GeneratorUnavailable } from '../components/GeneratorStates';
import { isFromOnboarding, leaveToPlans, previewBackLeaves, useLeaveOnBack } from '../generatorExit';
import {
  COPY,
  activeNotice,
  confirmDescription,
  createdMessage,
  dayMinutes,
  dayTitle,
  exerciseRowLabel,
} from '../generatorCopy';
import { FOCUS_DELAY_MS, PressOverlay, isReflow, isTabletWidth } from '../generatorLayout';
import {
  answersFromProfile,
  buildAcceptBody,
  buildProfileBody,
  classifyAcceptError,
  classifyPreviewError,
  formatPrescription,
  imageUrlOf,
  planNotice,
  previewExercise,
  refusalActions,
  stepErrorsFrom422,
  shouldConfirmAfterActive,
  weeklyVolumeRows,
} from '../generatorLogic';
// Review M4/M5: the v2 image chain (thumbnails w400 first); imageUrlOf
// already drops a non-image media_type.
import { THUMB_WIDTH, imageSourceProps } from '../../../shared/images/remoteImageSources';
import { generatorRoutes } from '../generatorRoutes';
import { keepUnitsTogether } from '../../../shared/format/counts';

const THUMB = Object.freeze({ width: THUMB_WIDTH });

// G2 (RN-SPEC-PLAN-GENERATOR §G2). Every focus remounts and previews again (§8.1).
export default function PlanGeneratorPreviewScreen() {
  const remountKey = useFocusRemountKey();
  return <PlanGeneratorPreview key={remountKey} />;
}

function PlanGeneratorPreview() {
  const navigation = useNavigation();
  const route = useRoute();
  const [view, setView] = useState({ status: 'loading' });
  const [lockedAfter409, setLockedAfter409] = useState(false);
  const [changingSplit, setChangingSplit] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // The pinned dock's live height (re-measured on every layout, never cached;
  // null until measured).
  const [barHeight, setBarHeight] = useState(null);
  const { width, fontScale } = useWindowDimensions();
  const tablet = isTabletWidth(width);
  const reflow = isReflow(fontScale);
  const mounted = useRef(true);
  const runId = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // §G2.1. Resolves to the new preview when feasible, else null.
  const runPreview = useCallback(async () => {
    const id = ++runId.current;
    setView({ status: 'loading' });
    try {
      const preview = await previewGeneratedPlan();
      if (!mounted.current || id !== runId.current) {
        return null;
      }
      setView({ status: preview?.feasible ? 'feasible' : 'infeasible', preview });
      return preview?.feasible ? preview : null;
    } catch (error) {
      if (!mounted.current || id !== runId.current) {
        return null;
      }
      const kind = classifyPreviewError(error);
      if (kind === 'profile') {
        navigation.replace(generatorRoutes.PlanGenerator);
      } else if (kind === 'goEasy') {
        // T-18: no error screen, no Retry; the questionnaire on step 6. PM
        // parity (26 Oct): its field error goes along and gets the focus.
        navigation.replace(generatorRoutes.PlanGenerator, { step: 5, stepErrors: stepErrorsFrom422(error?.response?.data?.errors) });
      } else if (kind === 'unavailable') {
        setView({ status: 'unavailable' });
      } else {
        setView({ status: 'error', forbidden: kind === 'forbidden', message: getServerMessage(error) });
      }
      return null;
    }
  }, [navigation]);

  useEffect(() => {
    runPreview();
  }, [runPreview]);


  // ⚠G-4: save the profile with the chosen split, then preview again.
  async function handleSplitChange(code) {
    if (code === view.preview?.split?.code) {
      return;
    }
    setChangingSplit(true);
    try {
      const saved = await getGeneratorProfile();
      await saveGeneratorProfile(buildProfileBody(answersFromProfile(saved?.profile), { preferred_split: code }));
    } catch (error) {
      if (mounted.current) {
        setChangingSplit(false);
        addToast(ToastTone.error, COPY.splitError, getServerMessage(error));
      }
      return;
    }
    if (!mounted.current) {
      return;
    }
    setChangingSplit(false);
    runPreview();
  }

  // §G2.4
  async function accept(replace) {
    const preview = view.preview;
    setAccepting(true);
    try {
      const accepted = await acceptGeneratedPlan(buildAcceptBody(preview.preview_hash, replace));
      if (!mounted.current) {
        return;
      }
      // T-53 (onboarding ruling §1, D): from the onboarding bridge, Accept
      // replaces to "Pick your days" for the new enrolment; elsewhere Workout.
      const enrollment = accepted?.enrollment;
      if (isFromOnboarding(route) && enrollment?.id && enrollment?.workout_plan_id) {
        openOnboardingDays({ enrollmentId: enrollment.id, planId: enrollment.workout_plan_id, planName: enrollment.plan?.name ?? preview.plan_name });
      } else {
        handOffToWorkout(navigation, route, createdMessage(preview.plan_name));
      }
    } catch (error) {
      if (!mounted.current) {
        return;
      }
      setConfirmOpen(false);
      setAccepting(false);
      switch (classifyAcceptError(error)) {
        case 'stale':
          // The old hash is never retried; the member presses Start again.
          addToast(ToastTone.info, COPY.planChanged, getServerMessage(error));
          runPreview();
          break;
        case 'active': {
          const next = await runPreview();
          if (mounted.current && shouldConfirmAfterActive(next)) {
            setConfirmOpen(true);
          }
          break;
        }
        case 'locked':
          setLockedAfter409(true);
          break;
        case 'unavailable':
          setView({ status: 'unavailable' });
          break;
        case 'server':
          addToast(ToastTone.error, COPY.acceptError, COPY.acceptServerError);
          break;
        default:
          addToast(ToastTone.error, COPY.acceptError, getServerMessage(error));
      }
    }
  }

  function handleStart() {
    if (view.preview?.active_enrollment) {
      setConfirmOpen(true);
    } else {
      accept(false);
    }
  }

  const openAnswers = () => navigation.push(generatorRoutes.PlanGenerator);
  // G1 (UX 28 Oct): with no screen below, or a questionnaire below that sits
  // above an earlier preview, the top back (and Android back) leaves to Plans.
  const backLeaves = previewBackLeaves(navigation);
  useLeaveOnBack(navigation, backLeaves);
  const topBack = backLeaves ? () => leaveToPlans(navigation) : openAnswers;
  // T-18 deep links: `step` is the web's 0-based `state.step`.
  const openStep = (step) => navigation.push(generatorRoutes.PlanGenerator, { step });
  const preview = view.preview;
  const notice = view.status === 'feasible' ? planNotice(preview, lockedAfter409) : null;
  const locked = notice?.kind === 'locked';
  // §9 addendum: the bar is sticky only while it fits one row; at large text
  // it scrolls with the page, at the end of the content.
  const pinned = view.status === 'feasible' && !reflow;
  const bar =
    view.status === 'feasible' ? (
      <StickyBar
        showStart={!locked}
        starting={accepting && !confirmOpen}
        onChange={openAnswers}
        onStart={handleStart}
        onHeight={setBarHeight}
        tablet={tablet}
        reflow={reflow}
        narrow={width < BAR_STACK_BELOW}
        pinned={pinned}
      />
    ) : null;

  return (
    <View style={styles.screen}>
      {/* UX native final audit 27 Oct 2026, ruling 1: the scroll room = the dock's measured height. */}
      <ShellPage testID="plan-generator-preview-screen" dockHeight={pinned ? barHeight : null}>
        <View style={styles.column}>
          {view.status === 'loading' ? <Loader label={COPY.buildingPlan} style={styles.loader} /> : null}
          {view.status === 'unavailable' ? (
            <GeneratorUnavailable onBack={() => openShellPath('/plans')} />
          ) : null}
          {view.status === 'error' ? (
            // G5: Retry; 403 none.
            <ErrorAlert
              testID="generator-preview-error"
              variant="generator"
              title={COPY.previewError}
              description={view.message}
              retryTestID="generator-preview-retry"
              onRetry={view.forbidden ? undefined : () => runPreview()}
            />
          ) : null}
          {view.status === 'infeasible' ? <NotFeasible reason={preview?.reason} onChange={openAnswers} onOpenStep={openStep} /> : null}
          {view.status === 'feasible' ? (
            <Feasible
              preview={preview}
              notice={notice}
              changingSplit={changingSplit}
              onSplitChange={handleSplitChange}
              onOpenExercise={(id) => navigation.push(routes.ExerciseDetail, { exerciseId: String(id) })}
              // Review M1: as web (navigate to /plans/generate), a FRESH
              // questionnaire that refetches the profile, never goBack to the
              // stale one (its old split would be PUT again on "See my plan").
              onBack={topBack}
              backLeaves={backLeaves}
              tablet={tablet}
              reflow={reflow}
              footer={pinned ? null : bar}
            />
          ) : null}
        </View>
      </ShellPage>
      {pinned ? bar : null}
      <ConfirmDialog
        testID="generator-confirm"
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => accept(true)}
        title={COPY.confirmTitle}
        description={confirmDescription(preview?.active_enrollment?.plan_name)}
        confirmLabel={COPY.confirmAction}
        tone="brand"
        loading={accepting}
        dismissible={!accepting}
        // Dated 27 Oct 2026 (audit b2, UX R2-3): no × at any width.
        hideClose
      />
    </View>
  );
}

// §G2.2. Phone = GeneratorPreview (back icon button, eyebrow gold, plan name
// 44/42, the split name sub-line + "Change split" pill select, featured first
// row); tablet = TabletGeneratorPreview (plan name 60/60, the split card,
// 120 × 92 photo rows). UX N1: the plan name is ONE server string.
function Feasible({ preview, notice, changingSplit, onSplitChange, onOpenExercise, onBack, backLeaves = false, tablet, reflow, footer }) {
  const splitOptions = preview.split_options ?? [];
  const weekly = weeklyVolumeRows(preview);
  const select =
    splitOptions.length > 1 ? (
      <Select
        testID="generator-split"
        label={COPY.changeSplit}
        labelStyle={styles.selectLabel}
        variant={tablet ? 'raised' : 'pill'}
        value={preview.split?.code}
        options={splitOptions.map((option) => ({ value: option.code, label: option.name }))}
        onChange={onSplitChange}
        disabled={changingSplit}
      />
    ) : null;
  return (
    <View
      testID="generator-feasible"
      style={[styles.feasible, tablet && styles.feasibleTablet]}
    >
      {!tablet ? (
        <View testID="generator-preview-top-row" style={styles.topRow}>
          {backLeaves ? (
            // T-74 carry: when the top back LEAVES to Plans (G1: no screen
            // below, or a looping questionnaire below), an icon named "Back
            // to your answers" was wrong; it is the labelled "‹ Plans" pill.
            <BackPill testID="generator-preview-back" label={COPY.previewBackPlans} onPress={onBack} />
          ) : (
            <IconButton testID="generator-preview-back" accessibilityLabel={COPY.backToAnswers} onPress={onBack}>
              {({ color }) => <ChevronLeftIcon size={20} color={color} />}
            </IconButton>
          )}
        </View>
      ) : null}
      <View style={tablet ? null : styles.headerPhone}>
        <Text {...CAP_BODY} testID="generator-preview-eyebrow" style={[styles.eyebrow, tablet && styles.eyebrowTablet]}>
          {COPY.yourPlan}
        </Text>
        <Text {...DISPLAY_TITLE_TEXT} accessibilityRole="header" testID="generator-plan-name" style={[styles.planName, tablet && styles.planNameTablet]}>
          {keepUnitsTogether(preview.plan_name)}
        </Text>
        {!tablet && preview.split?.name ? (
          <Text {...NAME_TEXT} style={styles.splitName}>
            {preview.split.name}
          </Text>
        ) : null}
      </View>
      {tablet ? (
        <View testID="generator-split-card" style={[styles.splitCard, reflow && styles.splitCardStacked]}>
          <GradientFill angle={gradients.card.angle} colors={gradients.card.colors} />
          <View style={reflow ? null : styles.flex}>
            <Text {...CAP_BODY} style={styles.splitCardLabel}>
              {COPY.split}
            </Text>
            <Text {...NAME_TEXT} style={styles.splitCardName}>
              {preview.split?.name}
            </Text>
          </View>
          {select ? <View style={reflow ? null : styles.splitSelect}>{select}</View> : null}
        </View>
      ) : (
        select
      )}
      {(preview.notes ?? []).map((note, index) => (
        <Callout
          key={`note-${index}`}
          tone="info"
          testID={`generator-note-${index}`}
          role={note?.code === 'GO_EASY_AREAS' ? 'note' : undefined}
        >
          {note.text}
        </Callout>
      ))}
      {(preview.warnings ?? []).map((warning, index) => (
        <Callout key={`warning-${index}`} tone="warning" testID={`generator-warning-${index}`}>
          {warning.text}
        </Callout>
      ))}
      {notice?.kind === 'locked' ? (
        <Callout tone="warning" testID="generator-locked">
          {COPY.lockedNotice}
        </Callout>
      ) : null}
      {notice?.kind === 'active' ? (
        <Callout tone="info" role="note" testID="generator-active">
          {activeNotice(notice.planName)}
        </Callout>
      ) : null}
      {(preview.days ?? []).map((day, index) => (
        <DayCard key={day.day_number ?? index} day={day} tablet={tablet} reflow={reflow} onOpenExercise={onOpenExercise} />
      ))}
      {weekly.length ? <WeeklySets rows={weekly} /> : null}
      {footer}
    </View>
  );
}

// The drawn "Weekly sets" card (web card style, after the last day):
// surface, radius-xl 24, padding 20, title 20/700; rows 15/600 + the sets
// tabular; an 8-high decorative bar under each row (share of the most sets).
function WeeklySets({ rows }) {
  const most = Math.max(1, ...rows.map((row) => parseInt(row.sets, 10) || 0));
  return (
    <View testID="generator-weekly" style={styles.weeklyCard}>
      <Text {...TITLE_TEXT} accessibilityRole="header" style={styles.weeklyTitle}>
        {COPY.weeklySets}
      </Text>
      <View style={styles.weeklyRows}>
        {rows.map((row) => (
          <View key={row.key} accessible accessibilityLabel={`${row.name}, ${row.sets}`}>
            <View style={styles.weeklyRow}>
              <Text {...NAME_TEXT} style={styles.weeklyName}>
                {row.name}
              </Text>
              <Text {...CAP_BODY} style={styles.weeklySets}>
                {row.sets}
              </Text>
            </View>
            <View style={styles.weeklyTrack}>
              <View testID="generator-weekly-bar" style={[styles.weeklyBar, { width: `${Math.round(((parseInt(row.sets, 10) || 0) / most) * 100)}%` }]} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ⚠G-3: slot types, fallbacks, skipped reasons/patterns aren't shown.
// Day card: radius 28, gradient-card, 0.08 edge. Phone: the first exercise is
// the featured photo row, the rest compact rows; tablet: every row 120 × 92.
function DayCard({ day, tablet, reflow, onOpenExercise }) {
  const exercises = day.exercises ?? [];
  const skipped = day.skipped ?? [];
  return (
    <View testID={`generator-day-${day.day_number}`} accessibilityLabel={dayTitle(day)} style={styles.dayCard}>
      {/* Mounted with the card (Android render rule). */}
      <GradientFill angle={gradients.card.angle} colors={gradients.card.colors} />
      <View testID="generator-day-header" style={[styles.dayHeader, tablet && styles.dayHeaderTablet, reflow && styles.dayHeaderStacked]}>
        <Text {...TITLE_TEXT} accessibilityRole="header" style={[styles.dayTitle, tablet && styles.dayTitleTablet, styles.flexShrink]}>
          {dayTitle(day)}
        </Text>
        {day.estimated_minutes ? (
          tablet ? (
            <Text {...CAP_BODY} testID="generator-day-minutes" style={styles.dayMinutesTablet}>
              {dayMinutes(day.estimated_minutes)}
            </Text>
          ) : (
            <View testID="generator-day-minutes-chip" style={styles.minutesChip}>
              <Text {...CAP_BODY} testID="generator-day-minutes" style={styles.dayMinutes}>
                {dayMinutes(day.estimated_minutes)}
              </Text>
            </View>
          )
        ) : null}
      </View>
      <View style={tablet ? null : styles.dayListPhone}>
        {exercises.map((item, index) =>
          tablet ? (
            <TabletRow key={`e-${index}`} item={item} onOpenExercise={onOpenExercise} />
          ) : index === 0 ? (
            <FeaturedRow key={`e-${index}`} item={item} onOpenExercise={onOpenExercise} />
          ) : (
            <CompactRow key={`e-${index}`} item={item} onOpenExercise={onOpenExercise} />
          )
        )}
        {skipped.map((item, index) => (
          <Text key={`s-${index}`} {...CAP_BODY} style={[styles.skipped, tablet && styles.skippedTablet, styles.divider]}>
            {item.text}
          </Text>
        ))}
      </View>
    </View>
  );
}

// Dated change 27 Oct: each row is a link announcing "{name}, {muscle}, {prescription}".
function rowData(item) {
  const exercise = previewExercise(item);
  const id = exercise.id ?? item.exercise_id;
  const muscleName = exercise.primary_muscle_group?.name;
  const muscleCode = exercise.primary_muscle_group?.code ?? null;
  const prescription = formatPrescription(item);
  return { exercise, id, muscleName, muscleCode, prescription, label: exerciseRowLabel(exercise.name, muscleName, prescription) };
}

function RowLink({ data, onOpenExercise, style, children }) {
  return (
    <Pressable
      testID={`generator-exercise-${data.id}`}
      accessibilityRole="link"
      accessibilityLabel={data.label}
      onPress={() => onOpenExercise(data.id)}
      style={style}
    >
      {({ pressed }) => (
        <>
          <PressOverlay pressed={pressed} />
          {children}
        </>
      )}
    </Pressable>
  );
}

// The effort line and the Why line follow every row (code: on EVERY row).
function RowExtras({ item, tablet = false, style }) {
  return (
    <>
      {item.effort ? (
        <Text {...CAP_BODY} style={[styles.effort, style]}>
          {item.effort}
        </Text>
      ) : null}
      {item.why ? <WhyLine tablet={tablet} text={item.why} style={[tablet ? styles.mt6 : styles.mt10, style]} /> : null}
    </>
  );
}

// Phone featured row: a 150 tall photo (radius-lg 20, margin 0 12) with the
// photo fade; over it the muscle label, the name 20/24/700 and the
// prescription 13 text-strong-2. Effort + Why sit UNDER the photo.
function FeaturedRow({ item, onOpenExercise }) {
  const data = rowData(item);
  return (
    <View testID="generator-featured-row">
      <RowLink data={data} onOpenExercise={onOpenExercise} style={styles.featuredLink}>
        <ExerciseImage
          testID={`generator-exercise-photo-${data.id}`}
          {...imageSourceProps(imageUrlOf(data.exercise))}
          name={data.exercise.name}
          muscleCode={data.muscleCode}
          hero
          style={styles.featuredPhoto}
        >
          <View style={styles.featuredOverlay}>
            <MuscleLabel name={data.muscleName} code={data.muscleCode} />
            <Text {...NAME_TEXT} style={styles.featuredName}>
              {data.exercise.name}
            </Text>
            <Text {...CAP_BODY} style={styles.featuredPrescription}>
              {data.prescription}
            </Text>
          </View>
        </ExerciseImage>
      </RowLink>
      <RowExtras item={item} style={styles.featuredExtras} />
    </View>
  );
}

// Phone compact row: margin 12, padding 10, radius-lg 20, fill-subtle 0.04;
// photo 72 × 60 (radius 14 drawn → radius-sm 12); name 16/700, the muscle
// label, the prescription 13 text-strong-2.
function CompactRow({ item, onOpenExercise }) {
  const data = rowData(item);
  return (
    <View testID="generator-compact-row" style={styles.compactWrap}>
      <RowLink data={data} onOpenExercise={onOpenExercise} style={styles.compactRow}>
        <ExerciseImage
          testID={`generator-exercise-photo-${data.id}`}
          {...imageSourceProps(imageUrlOf(data.exercise), THUMB)}
          name={data.exercise.name}
          muscleCode={data.muscleCode}
          size={72}
          style={styles.compactPhoto}
        />
        <View style={styles.flex}>
          <Text {...NAME_TEXT} style={styles.rowName}>
            {data.exercise.name}
          </Text>
          <MuscleLabel name={data.muscleName} code={data.muscleCode} />
          <Text {...CAP_BODY} style={styles.rowPrescription}>
            {data.prescription}
          </Text>
        </View>
      </RowLink>
      <RowExtras item={item} />
    </View>
  );
}

// Tablet row: top hairline, padding 16 22, photo 120 × 92 (radius 18 drawn →
// radius-lg 20), name 16/600, muscle label 13, prescription 14 secondary, the
// tablet Why line.
function TabletRow({ item, onOpenExercise }) {
  const data = rowData(item);
  return (
    <View testID="generator-tablet-row" style={styles.divider}>
      <RowLink data={data} onOpenExercise={onOpenExercise} style={styles.tabletRow}>
        <ExerciseImage
          testID={`generator-exercise-photo-${data.id}`}
          {...imageSourceProps(imageUrlOf(data.exercise), THUMB)}
          name={data.exercise.name}
          muscleCode={data.muscleCode}
          size={120}
          style={styles.tabletPhoto}
        />
        <View style={styles.flex}>
          <Text {...NAME_TEXT} style={styles.tabletName}>
            {data.exercise.name}
          </Text>
          <MuscleLabel name={data.muscleName} code={data.muscleCode} style={styles.tabletMuscle} />
          <Text {...CAP_BODY} style={styles.tabletPrescription}>
            {data.prescription}
          </Text>
        </View>
      </RowLink>
      {/* Outside the link so the Why line reads as its own sentence; indented
          under the text column (22 + 120 + 16). */}
      <View style={styles.tabletExtras}>
        <RowExtras item={item} tablet />
      </View>
    </View>
  );
}

// §G2.3
function NotFeasible({ reason, onChange, onOpenStep }) {
  const goEasy = refusalActions(reason);
  const titleRef = useRef(null);
  const { width, fontScale } = useWindowDimensions();
  // §9: at large text the actions stack (primary on top) at every width.
  const wide = width >= breakpoints.sm && !isReflow(fontScale);

  // T-18: when the go-easy refusal renders, focus moves to its title.
  const isGoEasy = goEasy !== null;
  useEffect(() => {
    if (!isGoEasy) {
      return undefined;
    }
    const timer = setTimeout(() => {
      const node = findNodeHandle(titleRef.current);
      if (node) {
        AccessibilityInfo.setAccessibilityFocus(node);
      }
    }, FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isGoEasy]);

  return (
    <View testID="generator-not-feasible" style={styles.notFeasibleCard}>
      <Text ref={titleRef} testID="generator-not-feasible-title" {...TITLE_TEXT} style={styles.refusalTitle}>
        {COPY.notFeasibleTitle}
      </Text>
      {reason?.message ? (
        <Text {...CAP_BODY} style={[styles.refusalReason, styles.mt8]}>
          {reason.message}
        </Text>
      ) : null}
      {reason?.what_to_change ? (
        <Callout testID="generator-refusal-callout" tone="teal" role="note" style={styles.refusalCallout}>
          {reason.what_to_change}
        </Callout>
      ) : null}
      {goEasy ? (
        <GoEasyRefusalActions equipmentFix={goEasy.equipmentFix} wide={wide} onOpenStep={onOpenStep} />
      ) : (
        <View style={styles.notFeasibleAction}>
          <PillButton testID="generator-change-answers" title={COPY.changeAnswers} onPress={onChange} />
        </View>
      )}
    </View>
  );
}

// T-18 GO_EASY_TOO_RESTRICTIVE: "Edit go-easy areas" → step 6 and, only with
// `equipment_fix`, "Change my equipment" → step 5. <640: stacked full
// width, primary first; ≥640: a right-aligned row, primary on the right.
function GoEasyRefusalActions({ equipmentFix, wide, onOpenStep }) {
  const primary = (
    <PillButton
      key="primary"
      testID="generator-edit-go-easy"
      title={COPY.editGoEasyAreas}
      fullWidth={!wide}
      onPress={() => onOpenStep(5)}
    />
  );
  const secondary = equipmentFix ? (
    <PillButton
      key="secondary"
      testID="generator-change-equipment"
      title={COPY.changeMyEquipment}
      variant="secondary"
      fullWidth={!wide}
      onPress={() => onOpenStep(4)}
    />
  ) : null;
  return (
    <View testID="generator-go-easy-actions" style={[styles.refusalActions, wide ? styles.barRowWide : styles.barStack]}>
      {wide ? [secondary, primary] : [primary, secondary]}
    </View>
  );
}

// §G2.2 item 7 + the dated fix. Phone (UX M2-1, web parity): below 432 the
// pair stacks, "Start this plan" (gold) over "Change my answers" (glass), both
// full width at 52, gap 10, pinned above the tab bar. From 432 to tablet: a
// row of the 60 CTA (Start takes the rest).
// Tablet: a right-aligned row of 52 buttons, sticky at the bottom. §9: past
// 1.3× the pair stacks (primary on top) and scrolls with the page (§9 addendum).
// UX native final audit 27 Oct 2026, ruling 1 (GENERATOR-FADE): pinned, the
// pair sits in the shared PinnedDock: the 32 fade above the gold button, solid
// ground from there to the screen edge (behind the tab bar too), 12 above the
// tab bar on phones; tablets keep their 16 above the safe area.
function StickyBar({ showStart, starting, onChange, onStart, onHeight, tablet, reflow, narrow, pinned }) {
  const stacked = reflow || (narrow && !tablet);
  const size = tablet || stacked ? 'default' : 'cta';
  const change = (
    <PillButton key="change" testID="generator-bar-change" title={COPY.changeAnswers} variant="secondary" size={size} fullWidth={stacked} onPress={onChange} />
  );
  const start = showStart ? (
    <PillButton
      key="start"
      testID="generator-start"
      title={COPY.startPlan}
      size={size}
      fullWidth={stacked}
      style={!tablet && !stacked ? styles.flex : null}
      loading={starting}
      onPress={onStart}
    />
  ) : null;
  const row = (
    <View testID="generator-sticky-row" style={[styles.barRow, tablet ? styles.barRowTablet : styles.barRowPhone, pinned && styles.barRowDocked, stacked && styles.barStack, stacked && !reflow && styles.barStackPhone]}>
      {stacked ? [start, change] : [change, start]}
    </View>
  );
  if (!pinned) {
    return (
      <View testID="generator-sticky-bar" style={styles.barInFlow}>
        {row}
      </View>
    );
  }
  return (
    <PinnedDock
      testID="generator-sticky-bar"
      onHeight={onHeight}
      bottomGap={TABLET_BAR_BOTTOM}
      // Until measured: the stacked pair, else one row of cta 60 (phone) / 52 (tablet).
      estimate={stacked ? dockButtonsHeight({ rows: 2 }) : dockButtonsHeight({ buttonHeight: BUTTON_HEIGHTS[size] })}
    >
      {row}
    </PinnedDock>
  );
}

// Web stacks the bar's pair below 27rem.
const BAR_STACK_BELOW = 432;
// Tablet (no tab bar): the pinned row's 16 above the safe area (unchanged).
const TABLET_BAR_BOTTOM = spacing[4];

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  column: {
    width: '100%',
    maxWidth: 672,
    alignSelf: 'center',
  },
  loader: {
    paddingVertical: 48,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  flexShrink: {
    flexShrink: 1,
  },
  // GeneratorPreview: column gap 12; TabletGeneratorPreview: gap 16.
  feasible: {
    gap: spacing[3],
  },
  feasibleTablet: {
    gap: spacing[4],
  },
  topRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing[1],
  },
  headerPhone: {
    paddingHorizontal: spacing[1],
    paddingTop: spacing[1],
  },
  eyebrow: {
    ...font(600),
    fontSize: 14,
    lineHeight: 20,
    color: colors.gold,
  },
  eyebrowTablet: {
    ...font(400),
    color: colors.textMuted,
  },
  // GeneratorPreview: 44/42/700 −0.05em (UX N1: one string, text-primary).
  planName: {
    ...font(700),
    marginTop: 6,
    fontSize: 44,
    lineHeight: 42,
    letterSpacing: titleTracking(44, -0.05),
    color: colors.textPrimary,
  },
  // TabletGeneratorPreview: 60/60/700 −0.055em.
  planNameTablet: {
    marginTop: spacing[1],
    fontSize: 60,
    lineHeight: 60,
    letterSpacing: titleTracking(60, -0.055),
  },
  splitName: {
    ...font(400),
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  selectLabel: {
    ...font(500),
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  // The tablet split card: radius-xl 24, padding 20 22, gradient-card, 0.08 edge.
  splitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.choiceBorder,
    paddingVertical: spacing[5],
    paddingHorizontal: spacing['5_5'],
    overflow: 'hidden',
  },
  splitCardStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  splitCardLabel: {
    ...font(400),
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  splitCardName: {
    ...font(600),
    marginTop: 2,
    fontSize: 18,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  splitSelect: {
    minWidth: 200,
  },
  // Day card: radius-2xl 28, gradient-card, white 0.08 edge.
  dayCard: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.choiceBorder,
    overflow: 'hidden',
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: spacing[4],
    paddingHorizontal: spacing['4_5'],
    paddingBottom: spacing[3],
  },
  dayHeaderTablet: {
    paddingVertical: spacing['4_5'],
    paddingHorizontal: spacing['5_5'],
  },
  // §9 reflow: the minutes drop below the title.
  dayHeaderStacked: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
  },
  // The board's 22/28/700 day title (title-sm); tablet 26/700 drawn.
  dayTitle: {
    ...typography.titleSm,
    color: colors.textPrimary,
  },
  dayTitleTablet: {
    fontSize: 26,
    lineHeight: 30,
  },
  // "~55 min" chip: 26 tall, padding 0 10, white 0.07 drawn → fill-glass.
  minutesChip: {
    minHeight: 26,
    justifyContent: 'center',
    paddingHorizontal: spacing['2_5'],
    borderRadius: radii.full,
    backgroundColor: colors.fillGlass,
  },
  dayMinutes: {
    ...font(400),
    fontSize: 12,
    lineHeight: 16,
    color: colors.textStrong2,
  },
  dayMinutesTablet: {
    ...font(400),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  dayListPhone: {
    paddingBottom: spacing[3],
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  featuredLink: {
    marginHorizontal: spacing[3],
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  featuredPhoto: {
    aspectRatio: undefined,
    height: 150,
    borderRadius: radii.lg,
  },
  featuredOverlay: {
    position: 'absolute',
    left: spacing['3_5'],
    right: spacing['3_5'],
    bottom: spacing[3],
  },
  featuredName: {
    ...font(700),
    marginTop: 2,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.4,
    color: colors.textPrimary,
  },
  featuredPrescription: {
    ...font(400),
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textStrong2,
  },
  featuredExtras: {
    marginHorizontal: spacing['4_5'],
  },
  compactWrap: {
    marginTop: spacing[3],
    marginHorizontal: spacing[3],
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing['2_5'],
    borderRadius: radii.lg,
    backgroundColor: colors.fillWell,
    overflow: 'hidden',
  },
  compactPhoto: {
    width: 72,
    height: 60,
    borderRadius: radii.sm,
  },
  rowName: {
    ...font(700),
    fontSize: 16,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  rowPrescription: {
    ...font(400),
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textStrong2,
  },
  tabletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    paddingVertical: spacing[4],
    paddingHorizontal: spacing['5_5'],
  },
  tabletPhoto: {
    width: 120,
    height: 92,
    borderRadius: radii.lg,
  },
  tabletName: {
    ...font(600),
    fontSize: 16,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  tabletMuscle: {
    fontSize: 13,
    lineHeight: 18,
  },
  tabletPrescription: {
    ...font(400),
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  tabletExtras: {
    paddingLeft: 158,
    paddingRight: spacing['5_5'],
    paddingBottom: spacing[4],
  },
  // Effort: body-sm 14/20 text-secondary.
  effort: {
    ...typography.bodySm,
    marginTop: 4,
    color: colors.textSecondary,
  },
  skipped: {
    ...font(400),
    marginTop: spacing[3],
    marginHorizontal: spacing['4_5'],
    paddingTop: spacing[3],
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
    color: colors.textMuted,
  },
  skippedTablet: {
    marginTop: 0,
    marginHorizontal: 0,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing['5_5'],
  },
  weeklyCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    padding: spacing[5],
  },
  weeklyTitle: {
    ...font(700),
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.4,
    color: colors.textPrimary,
  },
  weeklyRows: {
    marginTop: spacing['2_5'],
    gap: spacing['2_5'],
  },
  weeklyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  weeklyName: {
    ...font(600),
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  weeklySets: {
    ...font(400),
    fontSize: 15,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
    color: colors.textSecondary,
  },
  weeklyTrack: {
    marginTop: 6,
    height: 8,
    borderRadius: radii.full,
    backgroundColor: colors.track,
    overflow: 'hidden',
  },
  weeklyBar: {
    height: 8,
    borderRadius: radii.full,
    backgroundColor: colors.gold,
  },
  // G6 (UX D): radius 26 drawn (→ radius-2xl 28), padding 22 20, surface,
  // hairline; title-sm, reason 14/22 secondary, teal callout, action mt 18.
  notFeasibleCard: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    paddingVertical: 22,
    paddingHorizontal: 20,
  },
  refusalTitle: {
    ...typography.titleSm,
    color: colors.textPrimary,
  },
  refusalReason: {
    ...font(400),
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  refusalCallout: {
    marginTop: 14,
  },
  notFeasibleAction: {
    marginTop: 18,
    alignItems: 'flex-start',
  },
  refusalActions: {
    marginTop: 20,
    gap: 10,
  },
  // Ruling 1: in the dock the buttons start right under the fade; the dock
  // gives the room below them (and draws the solid ground).
  barRowDocked: {
    paddingVertical: 0,
  },
  barInFlow: {
    marginTop: spacing[2],
  },
  barRow: {
    width: '100%',
    maxWidth: 672,
    alignSelf: 'center',
    gap: spacing['2_5'],
  },
  // GeneratorPreview: padding 12 16, row gap 10.
  barRowPhone: {
    flexDirection: 'row',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  barRowTablet: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    // UX R2-6 (web round 2): gap 10 at every width.
    gap: spacing['2_5'],
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[4],
  },
  barStack: {
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingHorizontal: 0,
  },
  // M2-1 (pinned, 1×): keeps the phone's 16 side padding; gap 10 (web).
  barStackPhone: {
    paddingHorizontal: spacing[4],
  },
  barRowWide: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  mt6: {
    marginTop: 6,
  },
  mt8: {
    marginTop: 8,
  },
  mt10: {
    marginTop: 10,
  },
});
