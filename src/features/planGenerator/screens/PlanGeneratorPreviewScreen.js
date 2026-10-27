import { useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View, findNodeHandle, useWindowDimensions } from 'react-native';

import { routes } from '../../../navigation/routes';
import { getServerMessage } from '../../../shared/api/apiError';
import BlurLayer from '../../../shared/components/BlurLayer';
import ConfirmDialog from '../../../shared/components/ConfirmDialog';
import ErrorAlert from '../../../shared/components/ErrorAlert';
import Loader from '../../../shared/components/Loader';
import PillButton from '../../../shared/components/PillButton';
import Select from '../../../shared/components/Select';
import { ToastTone, addToast } from '../../../shared/components/toastStore';
import { useFocusRemountKey } from '../../../shared/hooks/useFocusRemountKey';
import GradientFill from '../../../shared/components/GradientFill';
import { blur, breakpoints, colors, font, gradients, radii, spacing, textScale, typography } from '../../../shared/theme/tokens';
import { Eyebrow, planStyles } from '../../plans/components/PlanBits';
import ShellPage from '../../shell/ShellPage';
import { handOffToWorkout, openShellPath } from '../../shell/shellLinks';
import { acceptGeneratedPlan, getGeneratorProfile, previewGeneratedPlan, saveGeneratorProfile } from '../api/generatorApi';
import { Callout, WhyLine } from '../components/GeneratorControls';
import { GeneratorUnavailable } from '../components/GeneratorStates';
import { isReflow } from './PlanGeneratorScreen';
import {
  COPY,
  activeNotice,
  confirmDescription,
  createdMessage,
  dayMinutes,
  dayTitle,
} from '../generatorCopy';
import {
  answersFromProfile,
  buildAcceptBody,
  buildProfileBody,
  classifyAcceptError,
  classifyPreviewError,
  formatPrescription,
  planNotice,
  previewExercise,
  refusalActions,
  stepErrorsFrom422,
  shouldConfirmAfterActive,
  weeklyVolumeRows,
} from '../generatorLogic';
import { generatorRoutes } from '../generatorRoutes';
import { useTabBarClearance } from '../useTabBarClearance';

// As the app's other focus moves: give the screen time to lay out first.
const FOCUS_DELAY_MS = 300;

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
      await acceptGeneratedPlan(buildAcceptBody(preview.preview_hash, replace));
      if (mounted.current) {
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
  // T-18 deep links: `step` is the web's 0-based `state.step`.
  const openStep = (step) => navigation.push(generatorRoutes.PlanGenerator, { step });
  const preview = view.preview;
  const notice = view.status === 'feasible' ? planNotice(preview, lockedAfter409) : null;
  const locked = notice?.kind === 'locked';
  // The sticky bar's live height (re-measured on every layout, never cached):
  // at large text its stacked buttons grow, so the list clears it.
  const [barHeight, setBarHeight] = useState(0);

  return (
    <View style={styles.screen}>
      <ShellPage testID="plan-generator-preview-screen">
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
              barHeight={barHeight}
            />
          ) : null}
        </View>
      </ShellPage>
      {view.status === 'feasible' ? (
        <StickyBar
          showStart={!locked}
          starting={accepting && !confirmOpen}
          onChange={openAnswers}
          onStart={handleStart}
          onHeight={setBarHeight}
        />
      ) : null}
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
      />
    </View>
  );
}

// §G2.2
function Feasible({ preview, notice, changingSplit, onSplitChange, onOpenExercise, barHeight = 0 }) {
  const splitOptions = preview.split_options ?? [];
  const weekly = weeklyVolumeRows(preview);
  return (
    <View testID="generator-feasible" style={[styles.feasible, { paddingBottom: Math.max(FEASIBLE_PAD, barHeight + spacing[4]) }]}>
      <View>
        <Eyebrow>{COPY.yourPlan}</Eyebrow>
        <Text {...PAGE_TITLE_TEXT} accessibilityRole="header" style={styles.planName}>
          {preview.plan_name}
        </Text>
        {preview.split?.name ? (
          <Text {...BODY_TEXT} style={styles.splitName}>
            {preview.split.name}
          </Text>
        ) : null}
      </View>
      {splitOptions.length > 1 ? (
        <Select
          testID="generator-split"
          label={COPY.changeSplit}
          value={preview.split?.code}
          options={splitOptions.map((option) => ({ value: option.code, label: option.name }))}
          onChange={onSplitChange}
          disabled={changingSplit}
        />
      ) : null}
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
        <Callout tone="info" testID="generator-active">
          {activeNotice(notice.planName)}
        </Callout>
      ) : null}
      {(preview.days ?? []).map((day, index) => (
        <DayCard key={day.day_number ?? index} day={day} onOpenExercise={onOpenExercise} />
      ))}
      {weekly.length ? (
        <View testID="generator-weekly" style={[planStyles.card, styles.dayCard]}>
          <GradientFill angle={gradients.card.angle} colors={gradients.card.colors} />
          <Text {...BODY_TEXT} style={styles.weeklyTitle}>
            {COPY.weeklySets}
          </Text>
          <View style={styles.weeklyRows}>
            {weekly.map((row) => (
              <View key={row.key} style={styles.weeklyRow}>
                <Text {...BODY_TEXT} style={styles.weeklyName}>
                  {row.name}
                </Text>
                <Text {...BODY_TEXT} style={styles.weeklySets}>
                  {row.sets}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

// ⚠G-3: slot types, fallbacks, skipped reasons/patterns aren't shown.
function DayCard({ day, onOpenExercise }) {
  const exercises = day.exercises ?? [];
  const skipped = day.skipped ?? [];
  const rows = [
    ...exercises.map((item, index) => ({ kind: 'exercise', item, key: `e-${index}` })),
    ...skipped.map((item, index) => ({ kind: 'skipped', item, key: `s-${index}` })),
  ];
  const { fontScale } = useWindowDimensions();
  return (
    <View testID={`generator-day-${day.day_number}`} style={[planStyles.card, styles.dayCard]}>
      {/* GeneratorPreview board: gradient-card (mounted with the card). */}
      <GradientFill angle={gradients.card.angle} colors={gradients.card.colors} />
      <View testID="generator-day-header" style={[styles.dayHeader, isReflow(fontScale) && styles.dayHeaderStacked]}>
        <Text {...CARD_TITLE_TEXT} style={[styles.dayTitle, styles.flexShrink]}>
          {dayTitle(day)}
        </Text>
        {day.estimated_minutes ? (
          <Text {...BODY_TEXT} style={styles.dayMinutes}>
            {dayMinutes(day.estimated_minutes)}
          </Text>
        ) : null}
      </View>
      <View style={styles.dayList}>
        {rows.map((row, index) =>
          row.kind === 'exercise' ? (
            <ExerciseLine key={row.key} item={row.item} first={index === 0} onOpenExercise={onOpenExercise} />
          ) : (
            <Text key={row.key} {...BODY_TEXT} style={[styles.skipped, index > 0 && styles.divider]}>
              {row.item.text}
            </Text>
          )
        )}
      </View>
    </View>
  );
}

function ExerciseLine({ item, first, onOpenExercise }) {
  const exercise = previewExercise(item);
  const id = exercise.id ?? item.exercise_id;
  const muscle = exercise.primary_muscle_group?.name;
  return (
    <View style={[styles.exerciseRow, !first && styles.divider]}>
      <Text {...BODY_TEXT} style={styles.nameLine}>
        <Text
          testID={`generator-exercise-${id}`}
          accessibilityRole="link"
          onPress={() => onOpenExercise(id)}
          style={styles.exerciseName}
        >
          {exercise.name}
        </Text>
        {muscle ? <Text style={styles.muscle}>{`  ${muscle}`}</Text> : null}
      </Text>
      <Text {...BODY_TEXT} style={styles.prescription}>
        {formatPrescription(item)}
      </Text>
      {item.effort ? (
        <Text {...BODY_TEXT} style={styles.effort}>
          {item.effort}
        </Text>
      ) : null}
      {item.why ? <WhyLine text={item.why} style={styles.mt4} /> : null}
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
      <Text ref={titleRef} testID="generator-not-feasible-title" {...CARD_TITLE_TEXT} style={styles.refusalTitle}>
        {COPY.notFeasibleTitle}
      </Text>
      {reason?.message ? (
        <Text {...BODY_TEXT} style={[styles.refusalReason, styles.mt8]}>
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

// §G2.2 item 7 + the dated fix: pinned above the tab bar and the safe area.
// <640: stacked full-width buttons ("Change my answers" first), gap 12;
// ≥640: a right-aligned row.
// UX §9: above 1.3× text the pair stacks at every width with the primary
// ("Start this plan") on top.
function StickyBar({ showStart, starting, onChange, onStart, onHeight }) {
  const bottom = useTabBarClearance();
  const { width, fontScale } = useWindowDimensions();
  const reflow = isReflow(fontScale);
  const wide = width >= breakpoints.sm && !reflow;
  const change = (
    <PillButton key="change" testID="generator-bar-change" title={COPY.changeAnswers} variant="secondary" fullWidth={!wide} onPress={onChange} />
  );
  const start = showStart ? (
    <PillButton key="start" testID="generator-start" title={COPY.startPlan} fullWidth={!wide} loading={starting} onPress={onStart} />
  ) : null;
  return (
    <View testID="generator-sticky-bar" style={[styles.bar, { bottom }]} onLayout={(event) => onHeight?.(event.nativeEvent.layout.height)}>
      {/* UX §8.6: a sticky bar on the ground = ground-bar 0.88 + blur 24. */}
      <BlurLayer blurPx={blur.groundBar} />
      <View style={styles.barVeil} />
      <View testID="generator-sticky-row" style={[styles.barRow, wide ? styles.barRowWide : styles.barStack]}>
        {reflow ? [start, change] : [change, start]}
      </View>
    </View>
  );
}

// UX §9 large text: the plan name is the page title (1.3×), card titles are
// title-* (1.6×); both wrap by word (max 3 lines) and shrink a single
// over-long word (to 0.7×). Body text scales to 2× and is never truncated.
const titleText = (cap) =>
  Object.freeze({ textBreakStrategy: 'simple', maxFontSizeMultiplier: cap, numberOfLines: 3, adjustsFontSizeToFit: true, minimumFontScale: 0.7 });
const PAGE_TITLE_TEXT = titleText(textScale.display);
const CARD_TITLE_TEXT = titleText(textScale.title);
const BODY_TEXT = Object.freeze({ maxFontSizeMultiplier: textScale.body });
// The list's bottom room under the sticky bar (its 1× height + 16).
const FEASIBLE_PAD = 112;

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
  feasible: {
    gap: 20,
  },
  flexShrink: {
    flexShrink: 1,
  },
  planName: {
    ...font(700),
    marginTop: 4,
    fontSize: 30,
    lineHeight: 36,
    color: colors.textPrimary,
  },
  splitName: {
    ...font(400),
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  // GeneratorPreview board: gradient-card, white 0.08 edge, radius 28.
  dayCard: {
    padding: 20,
    borderColor: colors.choiceBorder,
    overflow: 'hidden',
  },
  // The board's 22/700 day title (title-sm).
  dayTitle: {
    ...typography.titleSm,
    color: colors.textPrimary,
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
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  // §9 reflow: the minutes drop below the title.
  dayHeaderStacked: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
  },
  dayMinutes: {
    ...font(600),
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  dayList: {
    marginTop: 4,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  exerciseRow: {
    paddingVertical: 12,
  },
  nameLine: {
    ...font(400),
    fontSize: 14,
    lineHeight: 20,
  },
  exerciseName: {
    ...font(700),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  muscle: {
    ...font(400),
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  prescription: {
    ...font(600),
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  effort: {
    ...font(400),
    marginTop: 4,
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  skipped: {
    ...font(400),
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
    color: colors.textMuted,
  },
  weeklyTitle: {
    ...font(700),
    fontSize: 14,
    lineHeight: 20,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  weeklyRows: {
    marginTop: 12,
    gap: 6,
  },
  weeklyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  weeklyName: {
    ...font(700),
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  weeklySets: {
    ...font(400),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  notFeasibleAction: {
    marginTop: 18,
    alignItems: 'flex-start',
  },
  refusalActions: {
    marginTop: 18,
    gap: 12,
  },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  barVeil: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.groundBar,
  },
  barRow: {
    width: '100%',
    maxWidth: 672,
    alignSelf: 'center',
    gap: 12,
    paddingHorizontal: 4,
    paddingVertical: 12,
  },
  barStack: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  barRowWide: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  mt4: {
    marginTop: 4,
  },
  mt8: {
    marginTop: 8,
  },
  mt16: {
    marginTop: 16,
  },
});
