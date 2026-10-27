import { useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { builderMessage, getServerMessage, getStatus } from '../../../../shared/api/apiError';
import EmptyState from '../../../../shared/components/EmptyState';
import { CardSurface } from '../../../../shared/components/Card';
import ErrorAlert from '../../../../shared/components/ErrorAlert';
import GradientFill from '../../../../shared/components/GradientFill';
import IconButton from '../../../../shared/components/IconButton';
import { CAP_BODY, DISPLAY_TITLE_TEXT } from '../../../../shared/components/largeText';
import Loader from '../../../../shared/components/Loader';
import PillButton from '../../../../shared/components/PillButton';
import StateSlot from '../../../../shared/components/StateSlot';
import { ToastTone, addToast } from '../../../../shared/components/toastStore';
import { useFocusRemountKey } from '../../../../shared/hooks/useFocusRemountKey';
import { colors, font, gradients, layout, radii, spacing } from '../../../../shared/theme/tokens';
import TrainerOnly from '../../TrainerOnly';
import {
  listDayExercises,
  listDifficultyLevels,
  listEquipmentTypes,
  listExerciseSets,
  listMuscleGroups,
  listPlanCategories,
  listPlanDays,
} from '../api/plansApi';
import AddDayModal from '../components/AddDayModal';
import AddSetModal from '../components/AddSetModal';
import { ClientsBanner, InactiveBanner } from '../components/AffectedClients';
import { BackLink, DangerTintButton, EyebrowChip, StatusBox, builderStyles, useBuilderLayout } from '../components/builderParts';
import DayListCard from '../components/DayListCard';
import DayTabs, { DayTabPanel, SelectedDayStrip } from '../components/DayTabs';
import EditPlanDetailsModal from '../components/EditPlanDetailsModal';
import ExercisePickerSheet from '../components/ExercisePickerSheet';
import PlanActionDialog, { PlanAction } from '../components/PlanActionDialog';
import { PlanPage } from '../components/PlanPage';
import PlanOverflowSheet, { overflowLabel } from '../components/PlanOverflowSheet';
import { MoreIcon, PlusIcon } from '../components/pickerIcons';
import SortableExerciseList from '../components/SortableExerciseList';
import StaticExerciseList from '../components/StaticExerciseList';
import { wait } from '../loadExerciseCatalog';
import { getAddDayContext, getAddedExerciseIds, getNextSetNumber, getOrderIndexBase, moveItem } from '../planFormat';
import { createTrainerPlanAdapter } from '../trainerPlanAdapter';
import { useExerciseCatalog } from '../useExerciseCatalog';
import { canEditPlan } from '../trainerPlanBuilder';

const EDIT_PLAN_FIELDS = ['name', 'category_id', 'days_per_week', 'difficulty_level_id', 'description'];

// T3 for trainers: the shared plan screen with the trainer adapter (C6).
export default function PlanScreen() {
  const { planId } = useRoute().params ?? {};
  const adapter = useMemo(() => createTrainerPlanAdapter(planId), [planId]);
  return (
    <TrainerOnly>
      <SharedPlanScreen planId={planId} adapter={adapter} />
    </TrainerOnly>
  );
}

// The shared plan screen (spec §A5–§A8 + Part B), driven by an adapter
// (loaders, ownership, capabilities, mutations, text, links). Remounts on
// every focus, as the web page does.
export function SharedPlanScreen({ planId, adapter }) {
  const remountKey = useFocusRemountKey();
  return <PlanBuilder key={`${planId}-${remountKey}`} planId={planId} adapter={adapter} />;
}

// Adapters without extra header actions, banners or overlays.
const NO_EXTENSION = Object.freeze({ headerActions: null, banners: null, overlays: null });
function useNoExtension() {
  return NO_EXTENSION;
}

function PlanBuilder({ planId, adapter }) {
  const { text } = adapter;
  // C6: an adapter may add its own pieces (the member's "Start this plan",
  // §M3.4) through a hook. The adapter is fixed for a mount, so the hook
  // order never changes.
  const useExtension = adapter.useExtension ?? useNoExtension;
  // C9: set only by a copy landing; consumed on the first load.
  const nameTheCopy = Boolean(useRoute().params?.nameTheCopy);
  const navigation = useNavigation();
  const { tablet, reflow } = useBuilderLayout();
  const mounted = useRef(true);
  const confirming = useRef(false);

  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [plan, setPlan] = useState(null);
  const [days, setDays] = useState([]);
  const [isOwnPlan, setIsOwnPlan] = useState(false);
  const [selectedDayId, setSelectedDayId] = useState(null);
  const selectedDayRef = useRef(null);

  const [dayLoading, setDayLoading] = useState(false);
  const [exercises, setExercises] = useState([]);
  const [setsByExercise, setSetsByExercise] = useState({});

  const [muscleGroups, setMuscleGroups] = useState([]);
  const [equipmentTypes, setEquipmentTypes] = useState([]);
  // §D4: a failed catalog load shows the picker's alert + Retry.
  const catalogState = useExerciseCatalog();
  const addExerciseRef = useRef(null);

  // Part B
  const [affectedCount, setAffectedCount] = useState(null);
  const [categories, setCategories] = useState([]);
  const [levels, setLevels] = useState([]);
  const lookupsLoaded = useRef(false);
  const [editPlanOpen, setEditPlanOpen] = useState(false);
  const [activating, setActivating] = useState(false);
  const [action, setAction] = useState(null);
  const [copying, setCopying] = useState(false);
  // One copy request at a time: a second tap while one runs does nothing.
  const copyingRef = useRef(false);
  const [overflowOpen, setOverflowOpen] = useState(false);

  // One day modal and one set modal each serve create and edit (⚠B-8).
  const [dayModal, setDayModal] = useState({ open: false, day: null });
  const [setModal, setSetModal] = useState({ open: false, exercise: null, set: null });
  const [pickerOpen, setPickerOpen] = useState(false);

  const capabilities = useMemo(() => adapter.getCapabilities({ isOwnPlan }), [adapter, isOwnPlan]);
  const canEdit = canEditPlan(capabilities);
  const { mutations } = adapter;
  const extension = useExtension({ planId, plan, days, tablet });

  const selectDay = useCallback((dayId) => {
    selectedDayRef.current = dayId;
    setSelectedDayId(dayId);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // §B1: fire-and-forget; responses apply in resolve order (⚠B-1) and any
  // failure hides every count UI.
  const refreshCount = useCallback(() => {
    if (!adapter.countsClients) {
      return;
    }
    mutations
      .affectedClientCount()
      .then((count) => mounted.current && setAffectedCount(count))
      .catch(() => mounted.current && setAffectedCount(null));
  }, [adapter, mutations]);

  // §A5.3: every reload shows the whole-screen loader (⚠T3-2).
  const loadPlan = useCallback(async () => {
    setStatus('loading');
    try {
      const [planData, dayItems, own] = await Promise.all([
        adapter.loadHeader(),
        listPlanDays(planId),
        adapter.probeOwnership(),
      ]);
      if (!mounted.current) {
        return;
      }
      setPlan(planData);
      setDays(dayItems);
      setIsOwnPlan(own);
      selectDay(selectedDayRef.current ?? dayItems[0]?.id ?? null);
      setStatus('loaded');
    } catch (error) {
      if (!mounted.current) {
        return;
      }
      if (getStatus(error) === 404) {
        setStatus('notFound');
      } else if (adapter.renderOnHold && getStatus(error) === 403) {
        // Member §M3.3: a 403 on load shows the on-hold screen.
        setLoadError(getServerMessage(error));
        setStatus('onHold');
      } else {
        setLoadError(getServerMessage(error));
        setStatus('error');
      }
    }
  }, [adapter, planId, selectDay]);

  const loadDay = useCallback(async () => {
    const dayId = selectedDayRef.current;
    if (!dayId) {
      setExercises([]);
      setSetsByExercise({});
      return;
    }
    setDayLoading(true);
    try {
      const items = await listDayExercises(planId, dayId);
      const setLists = await Promise.all(
        items.map((exercise) => listExerciseSets(planId, dayId, exercise.id).catch(() => []))
      );
      if (!mounted.current) {
        return;
      }
      const nextSets = {};
      items.forEach((exercise, index) => {
        nextSets[exercise.id] = setLists[index];
      });
      setExercises(items);
      setSetsByExercise(nextSets);
    } catch (error) {
      if (mounted.current) {
        addToast(ToastTone.error, 'Could not load this day', getServerMessage(error));
      }
    }
    if (mounted.current) {
      setDayLoading(false);
    }
  }, [planId]);

  // C8: re-read the days quietly after an exercise add or delete, so each
  // card's "{n} exercises" follows; no loader, no toast, a failure keeps the list.
  const refreshDaysQuietly = useCallback(() => {
    listPlanDays(planId)
      .then((items) => mounted.current && setDays(items))
      .catch(() => {});
  }, [planId]);

  useEffect(() => {
    loadPlan();
    // Loaded for catalog plans too (spec §A12).
    listMuscleGroups()
      .catch(() => [])
      .then((items) => mounted.current && setMuscleGroups(items));
    listEquipmentTypes()
      .catch(() => [])
      .then((items) => mounted.current && setEquipmentTypes(items));
  }, [loadPlan]);

  useEffect(() => {
    loadDay();
  }, [selectedDayId, loadDay]);

  // §B1: once when editing becomes possible. A catalog plan never asks.
  useEffect(() => {
    if (canEdit) {
      refreshCount();
    }
  }, [canEdit, refreshCount]);

  // C9: once the copy's plan has loaded, open Edit details by itself, then
  // clear the flag so Back, a revisit or a reload never reopens it.
  const flagConsumed = useRef(false);
  useEffect(() => {
    if (status !== 'loaded' || !nameTheCopy || flagConsumed.current) {
      return;
    }
    flagConsumed.current = true;
    navigation.setParams({ nameTheCopy: undefined });
    if (capabilities.editPlan) {
      openEditPlan();
    }
    // openEditPlan is recreated each render; the ref keeps this to one run.
  }, [status, nameTheCopy, capabilities.editPlan]);

  // Part C §CP2: one flow for both copy buttons (and the member's own-plan
  // "Make a copy", RN-SPEC-v2-phase4 §2). Lifecycle pairing: `copying` is
  // set on press and cleared when the request settles while mounted.
  // T-16 (4.0.4): a 201 without a plan id is still a success → the list.
  async function copyPlan() {
    if (copyingRef.current) {
      return;
    }
    copyingRef.current = true;
    setCopying(true);
    try {
      const copy = await mutations.copyPlan();
      if (copy?.id !== undefined && copy?.id !== null) {
        addToast(ToastTone.success, 'Plan copied', text.copiedMessage);
        adapter.openCopy(navigation, copy.id);
      } else {
        addToast(ToastTone.success, 'Plan copied', text.copiedFallbackMessage);
        adapter.openCopyFallback(navigation);
      }
    } catch (error) {
      addToast(ToastTone.error, 'Could not copy the plan', builderMessage(error, undefined, text.copyNotYoursCopy));
    }
    copyingRef.current = false;
    if (mounted.current) {
      setCopying(false);
    }
  }

  // ---- Part A adds ----

  async function saveDay(payload) {
    const editingDay = dayModal.day;
    try {
      if (editingDay) {
        await mutations.updateDay(editingDay.id, payload);
        addToast(ToastTone.success, 'Day updated');
        closeDayModal();
      } else {
        const planDay = await mutations.addDay(payload);
        addToast(ToastTone.success, 'Day added');
        closeDayModal();
        selectDay(planDay?.id ?? null);
      }
      loadPlan();
    } catch (error) {
      if (editingDay) {
        addToast(ToastTone.error, 'Could not update the day', builderMessage(error));
      } else {
        addToast(ToastTone.error, 'Could not add the day', builderMessage(error, undefined, text.notYoursCopy));
      }
    }
  }

  // §A7.4: one POST per exercise, 300 ms apart, continuing past failures.
  async function addExercises(selected) {
    const dayId = selectedDayRef.current;
    const base = getOrderIndexBase(exercises);
    for (let i = 0; i < selected.length; i += 1) {
      try {
        await mutations.addExercise(dayId, {
          exercise_id: selected[i].id,
          order_index: base + i + 1,
          notes: '',
        });
        // ⚠T5-3: reloads after every single add, behind the sheet.
        loadDay();
        refreshDaysQuietly();
      } catch (error) {
        addToast(ToastTone.error, 'Could not add the exercise', builderMessage(error, undefined, text.notYoursCopy));
      }
      if (i < selected.length - 1) {
        await wait(300);
      }
    }
  }

  async function saveSet(payload) {
    const { exercise, set } = setModal;
    try {
      if (set) {
        await mutations.updateSet(selectedDayRef.current, exercise.id, set.id, payload);
        addToast(ToastTone.success, 'Set updated');
      } else {
        await mutations.addSet(selectedDayRef.current, exercise.id, payload);
        addToast(ToastTone.success, 'Set added');
      }
      closeSetModal();
      loadDay();
    } catch (error) {
      if (set) {
        addToast(ToastTone.error, 'Could not update the set', builderMessage(error));
      } else {
        addToast(ToastTone.error, 'Could not add the set', builderMessage(error, undefined, text.notYoursCopy));
      }
    }
  }

  // ---- Part B edits ----

  function openEditPlan() {
    setEditPlanOpen(true);
    refreshCount();
    if (!lookupsLoaded.current) {
      lookupsLoaded.current = true;
      listPlanCategories()
        .catch(() => [])
        .then((items) => mounted.current && setCategories(items));
      listDifficultyLevels()
        .catch(() => [])
        .then((items) => mounted.current && setLevels(items));
    }
  }

  // Resolves to field errors for the modal (422 with `errors`), else null.
  async function savePlanDetails(changes) {
    try {
      const updated = await mutations.updatePlan(changes);
      if (!mounted.current) {
        return null;
      }
      setPlan((current) => updated ?? { ...current, ...changes });
      addToast(ToastTone.success, 'Plan updated');
      setEditPlanOpen(false);
      return null;
    } catch (error) {
      const serverErrors = error?.response?.data?.errors;
      if (getStatus(error) === 422 && serverErrors && typeof serverErrors === 'object') {
        // ⚠B-2: keys other than the five fields show nowhere.
        const fieldErrors = {};
        for (const field of EDIT_PLAN_FIELDS) {
          const messages = serverErrors[field];
          if (Array.isArray(messages) && messages.length > 0) {
            fieldErrors[field] = messages[0];
          }
        }
        return fieldErrors;
      }
      addToast(ToastTone.error, 'Could not update the plan', getServerMessage(error));
      return null;
    }
  }

  async function activatePlan() {
    setActivating(true);
    try {
      const updated = await mutations.updatePlan({ is_active: true });
      if (mounted.current) {
        setPlan((current) => updated ?? { ...current, is_active: true });
        addToast(ToastTone.success, 'Plan activated');
      }
    } catch (error) {
      addToast(ToastTone.error, 'Could not activate the plan', getServerMessage(error));
    }
    if (mounted.current) {
      setActivating(false);
    }
  }

  function openAction(type, target = {}) {
    setAction({ type, ...target, running: false, error: null, refusedMessage: '' });
    refreshCount();
  }

  function closeAction() {
    setAction(null);
  }

  // Review LOW: a ref guard, so a double tap before the re-render runs once.
  async function confirmAction() {
    if (confirming.current) {
      return;
    }
    confirming.current = true;
    try {
      await runConfirmedAction();
    } finally {
      confirming.current = false;
    }
  }

  // One confirmed action (§B4–§B8). Failures stay inside the dialog.
  async function runConfirmedAction() {
    const current = action;
    setAction({ ...current, running: true, error: null });
    const finish = () => mounted.current && setAction(null);
    const fail = (title, message) =>
      mounted.current && setAction({ ...current, running: false, error: { title, message } });
    try {
      switch (current.type) {
        case PlanAction.deactivatePlan:
        case PlanAction.deactivateRefused: {
          const updated = await mutations.updatePlan({ is_active: false });
          setPlan((value) => updated ?? { ...value, is_active: false });
          addToast(ToastTone.success, 'Plan deactivated');
          finish();
          break;
        }
        case PlanAction.deletePlan:
          await mutations.deletePlan();
          addToast(ToastTone.success, 'Plan deleted');
          finish();
          // ⚠B-3: a push, so back returns to this (deleted) plan.
          adapter.openAfterDelete(navigation);
          break;
        case PlanAction.deleteDay:
          await mutations.deleteDay(current.day.id);
          addToast(ToastTone.success, 'Day deleted');
          if (selectedDayRef.current === current.day.id) {
            selectDay(null);
          }
          finish();
          loadPlan();
          break;
        case PlanAction.deleteExercise:
          await mutations.deleteExercise(selectedDayRef.current, current.exercise.id);
          addToast(ToastTone.success, 'Exercise removed');
          finish();
          loadDay();
          refreshDaysQuietly();
          break;
        case PlanAction.deleteSet:
          await mutations.deleteSet(selectedDayRef.current, current.exercise.id, current.set.id);
          addToast(ToastTone.success, 'Set deleted');
          finish();
          loadDay();
          break;
        default:
          finish();
      }
    } catch (error) {
      const message = getServerMessage(error);
      if (getStatus(error) === 409 && current.type === PlanAction.deletePlan) {
        if (plan?.is_active !== false) {
          // The same dialog turns into "deactivate instead".
          if (mounted.current) {
            setAction({ ...current, type: PlanAction.deactivateRefused, running: false, error: null, refusedMessage: message });
          }
        } else {
          fail(text.planDeleteConflict, message);
        }
      } else if (getStatus(error) === 409 && current.type === PlanAction.deleteDay) {
        fail(text.dayDeleteConflict, message);
      } else {
        fail('That didn’t work. Please try again.', message);
      }
    }
  }

  // §B7.2 drop: optimistic, then POST the whole order; snap back to this
  // drag's start on failure. No in-flight guard (⚠B-7).
  async function moveExercise(from, to) {
    if (from === to) {
      return;
    }
    const dayId = selectedDayRef.current;
    const snapshot = exercises;
    const next = moveItem(exercises, from, to);
    setExercises(next);
    try {
      const items = await mutations.reorderExercises(
        dayId,
        next.map((exercise) => exercise.id)
      );
      if (!mounted.current) {
        return;
      }
      const orderById = new Map(items.map((item) => [item.id, item.order_index]));
      setExercises((current) =>
        current.map((exercise) =>
          orderById.has(exercise.id) ? { ...exercise, order_index: orderById.get(exercise.id) } : exercise
        )
      );
    } catch (error) {
      if (mounted.current) {
        setExercises(snapshot);
        addToast(ToastTone.error, 'Could not reorder the exercises', getServerMessage(error));
      }
    }
  }

  function openDayEdit(day) {
    setDayModal({ open: true, day });
    refreshCount();
  }

  // Closing returns the modal to create mode for the next "Add a day".
  function closeDayModal() {
    setDayModal({ open: false, day: null });
  }

  function openSetModal(exercise, set = null) {
    setSetModal({ open: true, exercise, set });
    if (set) {
      refreshCount();
    }
  }

  function closeSetModal() {
    setSetModal((current) => ({ ...current, open: false }));
  }

  if (status === 'loading') {
    return (
      <PlanPage testID="plan-screen">
        <StateSlot>
          <Loader label="Loading plan" style={styles.loader} />
        </StateSlot>
      </PlanPage>
    );
  }
  if (status === 'notFound') {
    return (
      <PlanPage testID="plan-screen">
        <StateSlot>
          <EmptyState title="Plan not found" message={text.notFoundMessage} />
        </StateSlot>
      </PlanPage>
    );
  }
  if (status === 'onHold') {
    return <PlanPage testID="plan-screen">{adapter.renderOnHold({ message: loadError, navigation })}</PlanPage>;
  }
  if (status === 'error') {
    return (
      <PlanPage testID="plan-screen">
        <StateSlot>
          <ErrorAlert title="Could not load this plan" description={loadError} onRetry={loadPlan} />
        </StateSlot>
      </PlanPage>
    );
  }

  // v2 look (UX phase4 I §1-3, phase6 O builder): `look` picks the member
  // or trainer boards; `tablet` (≥ 768) the two-column tablet boards.
  const look = adapter.look ?? 'member';
  const trainer = look === 'trainer';
  const twoColumns = tablet && !reflow;
  const addDayContext = getAddDayContext(plan, days);
  const isInactive = plan?.is_active === false;
  const selectedDay = days.find((day) => day.id === selectedDayId) ?? null;
  let description = text.descriptionCatalog;
  if (isOwnPlan) {
    description = canEdit ? text.descriptionOwnEdit : text.descriptionOwnAddOnly;
  }

  // The plan actions: the tablet header buttons and the phone overflow.
  const planActions = [];
  if (capabilities.editPlan) {
    planActions.push({ key: 'edit-details', label: 'Edit details', onPress: openEditPlan });
  }
  if (isOwnPlan && capabilities.copyPlan) {
    planActions.push({ key: 'make-copy', label: 'Make a copy', loading: copying, onPress: copyPlan });
  }
  if (capabilities.editPlan && isInactive) {
    planActions.push({ key: 'activate', label: 'Activate', loading: activating, onPress: activatePlan });
  }
  if (capabilities.editPlan && !isInactive) {
    planActions.push({ key: 'deactivate', label: 'Deactivate', onPress: () => openAction(PlanAction.deactivatePlan) });
  }
  if (capabilities.deletePlan) {
    planActions.push({ key: 'delete', label: 'Delete plan', tone: 'danger', onPress: () => openAction(PlanAction.deletePlan) });
  }
  const findAction = (key) => planActions.find((item) => item.key === key);
  const actionButton = (item, extraStyle) =>
    item.tone === 'danger' ? (
      <DangerTintButton key={item.key} testID={`plan-${item.key}`} title={item.label} onPress={item.onPress} style={extraStyle} />
    ) : (
      <PillButton
        key={item.key}
        testID={`plan-${item.key}`}
        title={item.label}
        variant="secondary"
        size="compact"
        loading={item.loading}
        onPress={item.onPress}
        style={extraStyle}
      />
    );

  const backLink = (
    <BackLink testID="plan-all-plans" label={text.backLabel} pill={trainer} onPress={() => adapter.openBack(navigation)} />
  );
  const overflowButton =
    !tablet && planActions.length > 0 ? (
      <IconButton testID="plan-overflow" accessibilityLabel={overflowLabel(planActions)} onPress={() => setOverflowOpen(true)}>
        {({ color }) => <MoreIcon color={color} size={20} />}
      </IconButton>
    ) : null;
  const title = (
    <Text {...DISPLAY_TITLE_TEXT} accessibilityRole="header" style={[styles.title, titleStyle(trainer, tablet)]}>
      {plan?.name || 'Plan'}
    </Text>
  );
  const descriptionText = description ? (
    <Text {...CAP_BODY} style={[styles.description, tablet && styles.descriptionTablet, trainer && styles.descriptionTrainer]}>
      {description}
    </Text>
  ) : null;

  return (
    <PlanPage testID="plan-screen" nestable maxWidth={tablet ? layout.contentMax : undefined} gap={tablet ? spacing['4_5'] : spacing[3]}>
      <View style={styles.topRow}>
        {/* ⚠T3-3: pushes a fresh list rather than going back. */}
        {backLink}
        {overflowButton}
      </View>

      {trainer ? renderTrainerHeader() : renderMemberHeader()}

      {isOwnPlan ? null : (
        <StatusBox testID="plan-catalog-notice" title="This is a public plan">
          <Text {...CAP_BODY} style={builderStyles.statusBody}>
            It’s part of the shared catalog, so it can’t be changed here — but you can still assign it to a client, or
            copy it to make your own version you can change.{' '}
            <Text
              testID="plan-create-own"
              accessibilityRole="link"
              style={builderStyles.link}
              onPress={() => adapter.openCreate(navigation)}
            >
              Create your own plan
            </Text>{' '}
            if you want one you can build out from scratch.
          </Text>
          {capabilities.copyPlan ? (
            <View style={styles.noticeAction}>
              <PillButton testID="plan-copy-this" title="Copy this plan" size="compact" loading={copying} onPress={copyPlan} />
            </View>
          ) : null}
        </StatusBox>
      )}
      {canEdit && isInactive ? <InactiveBanner body={text.inactiveBannerBody} /> : null}
      {canEdit ? <ClientsBanner count={affectedCount} /> : null}
      {extension.banners}

      {tablet ? (
        <View style={twoColumns ? styles.columns : styles.stack}>
          <View style={twoColumns ? (trainer ? styles.asideTrainer : styles.aside) : null}>
            <DayListCard
              days={days}
              look={look}
              selectedDayId={selectedDayId}
              onSelect={selectDay}
              capabilities={capabilities}
              onEditDay={openDayEdit}
              onDeleteDay={(day) => openAction(PlanAction.deleteDay, { day })}
              footer={renderTabletAddDay()}
            />
          </View>
          <View style={[styles.section, twoColumns && styles.sectionFlex]}>{renderSelectedDay()}</View>
        </View>
      ) : (
        <>
          <DayTabs
            days={days}
            look={look}
            selectedDayId={selectedDayId}
            onSelect={selectDay}
            canAddDay={capabilities.addDay}
            onAddDay={openAddDay}
          />
          <DayTabPanel day={selectedDay}>
            <SelectedDayStrip
              day={selectedDay}
              capabilities={capabilities}
              onEditDay={openDayEdit}
              onDeleteDay={(day) => openAction(PlanAction.deleteDay, { day })}
            />
            <View style={styles.section}>{renderSelectedDay()}</View>
          </DayTabPanel>
        </>
      )}

      <AddDayModal
        isOpen={dayModal.open}
        onClose={closeDayModal}
        context={addDayContext}
        day={dayModal.day}
        affectedCount={affectedCount}
        onSubmit={saveDay}
      />
      <ExercisePickerSheet
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        catalog={catalogState.catalog}
        loading={catalogState.loading}
        catalogError={catalogState.error}
        onRetryCatalog={catalogState.retry}
        returnFocusRef={addExerciseRef}
        muscleGroups={muscleGroups}
        equipmentTypes={equipmentTypes}
        addedIds={getAddedExerciseIds(exercises)}
        onAddSelected={addExercises}
      />
      <AddSetModal
        isOpen={setModal.open}
        onClose={closeSetModal}
        nextSetNumber={getNextSetNumber(setsByExercise[setModal.exercise?.id] ?? [])}
        set={setModal.set}
        affectedCount={affectedCount}
        onSubmit={saveSet}
      />
      {capabilities.editPlan ? (
        <EditPlanDetailsModal
          isOpen={editPlanOpen}
          onClose={() => setEditPlanOpen(false)}
          plan={plan}
          dayCount={days.length}
          categories={categories}
          levels={levels}
          affectedCount={affectedCount}
          description={text.editDetailsDescription}
          onSubmit={savePlanDetails}
        />
      ) : null}
      <PlanActionDialog
        action={action}
        text={text}
        affectedCount={affectedCount}
        onClose={closeAction}
        onConfirm={confirmAction}
      />
      {tablet ? null : (
        <PlanOverflowSheet
          isOpen={overflowOpen}
          onClose={() => setOverflowOpen(false)}
          items={planActions.map((item) => ({ ...item, testID: `plan-overflow-${item.key}` }))}
        />
      )}
      {extension.overlays}
    </PlanPage>
  );

  function openAddDay() {
    setDayModal({ open: true, day: null });
  }

  // Member boards: eyebrow + display title + description, then the action
  // row: phone [Start this plan | Edit details] (the rest in the overflow),
  // tablet every plan action inline.
  function renderMemberHeader() {
    const edit = findAction('edit-details');
    const start = extension.headerActions;
    let actions = null;
    if (tablet) {
      actions = start || planActions.length > 0 ? (
        <View style={styles.actionsWrap}>
          {start}
          {planActions.map((item) => actionButton(item))}
        </View>
      ) : null;
    } else if (start || edit) {
      actions = (
        <View testID="plan-header-actions" style={[styles.actionRow, reflow && styles.actionRowStacked]}>
          {start ? <View style={reflow ? null : styles.startCell}>{start}</View> : null}
          {edit ? actionButton(edit) : null}
        </View>
      );
    }
    return (
      <>
        <View style={styles.header}>
          <Text {...CAP_BODY} style={[styles.eyebrow, tablet && styles.eyebrowTablet]}>
            {isOwnPlan ? text.eyebrowOwn : text.eyebrowCatalog}
          </Text>
          {title}
          {descriptionText}
        </View>
        {actions}
      </>
    );
  }

  // Trainer boards: the header card (teal chip, title, description) with
  // phone [Edit details | Make a copy] or every plan action on tablet.
  function renderTrainerHeader() {
    let actions = null;
    if (tablet) {
      actions = planActions.length > 0 ? <View style={styles.cardActions}>{planActions.map((item) => actionButton(item))}</View> : null;
    } else {
      const inline = ['edit-details', 'make-copy'].map(findAction).filter(Boolean);
      actions =
        inline.length > 0 ? (
          <View style={[styles.cardActions, reflow && styles.actionRowStacked]}>
            {inline.map((item) => actionButton(item, reflow ? null : styles.flexCell))}
          </View>
        ) : null;
    }
    return (
      <CardSurface hero testID="plan-header-card" style={[styles.headerCard, tablet && styles.headerCardTablet]}>
        <View pointerEvents="none" style={styles.glow}>
          <GradientFill radial={gradients.tealOrb.radial} colors={gradients.tealOrb.colors} stops={gradients.tealOrb.stops} />
        </View>
        <EyebrowChip label={isOwnPlan ? text.eyebrowOwn : text.eyebrowCatalog} tablet={tablet} />
        <View style={styles.cardTitle}>{title}</View>
        {descriptionText}
        {actions}
      </CardSurface>
    );
  }

  function renderTabletAddDay() {
    if (!capabilities.addDay) {
      return null;
    }
    return trainer ? (
      <PillButton
        testID="plan-add-day"
        title="Add a day"
        variant="ghost"
        size="compact"
        fullWidth
        icon={({ color }) => <PlusIcon color={color} size={16} />}
        style={styles.dashedAdd}
        onPress={openAddDay}
      />
    ) : (
      <PillButton
        testID="plan-add-day"
        title="Add a day"
        variant="secondary"
        size="compact"
        fullWidth
        icon={({ color }) => <PlusIcon color={color} size={16} />}
        onPress={openAddDay}
      />
    );
  }

  function renderSelectedDay() {
    if (!selectedDayId) {
      return (
        <View style={styles.emptyCard}>
          <EmptyState
            title="No days yet"
            message={capabilities.addDay ? 'Add a day to start building this plan.' : 'This plan has no days.'}
          />
        </View>
      );
    }
    if (dayLoading) {
      return <Loader label="Loading day" style={styles.loader} />;
    }
    const listProps = {
      exercises,
      setsByExercise,
      capabilities,
      onAddSet: (exercise) => openSetModal(exercise),
      onEditSet: (exercise, set) => openSetModal(exercise, set),
      onDeleteSet: (exercise, set) => openAction(PlanAction.deleteSet, { exercise, set }),
    };
    // One gold action per screen: the tablet trainer's Add exercise is the
    // gold one; the phone trainer's is light; the member's is glass.
    let addVariant = 'secondary';
    if (trainer) {
      addVariant = tablet ? 'primary' : 'light';
    }
    return (
      <>
        <View style={styles.sectionHead}>
          <Text {...CAP_BODY} accessibilityRole="header" style={[styles.sectionTitle, tablet && !trainer && styles.sectionTitleTablet]}>
            Exercises
          </Text>
          {capabilities.addExercise ? (
            <PillButton
              ref={addExerciseRef}
              testID="plan-add-exercise"
              title="Add exercise"
              variant={addVariant}
              size="compact"
              icon={({ color }) => <PlusIcon color={color} size={16} />}
              onPress={() => setPickerOpen(true)}
            />
          ) : null}
        </View>
        {capabilities.reorderExercises && exercises.length > 0 ? (
          <Text {...CAP_BODY} style={[styles.helper, tablet && styles.helperTablet]}>
            Drag the grip handle to reorder exercises.
          </Text>
        ) : null}
        {exercises.length === 0 ? (
          <View style={styles.emptyCard}>
            <EmptyState
              title="No exercises yet"
              message={capabilities.addExercise ? 'Add an exercise to this day.' : 'This day has no exercises.'}
            />
          </View>
        ) : capabilities.reorderExercises ? (
          <SortableExerciseList
            {...listProps}
            look={look}
            setsToggle={Boolean(adapter.setsToggle)}
            onMove={moveExercise}
            onDeleteExercise={(exercise) => openAction(PlanAction.deleteExercise, { exercise })}
          />
        ) : (
          <StaticExerciseList {...listProps} />
        )}
      </>
    );
  }
}

// Title sizes as drawn: member phone 42/42, tablet 60/60; trainer phone
// 36/38, tablet 44/46 (display cap 1.3×, word wrap, long words shrink).
function titleStyle(trainer, tablet) {
  if (trainer) {
    return tablet ? styles.titleTrainerTablet : styles.titleTrainer;
  }
  return tablet ? styles.titleTablet : null;
}

const styles = StyleSheet.create({
  loader: {
    paddingVertical: 48,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  header: {
    paddingHorizontal: spacing[1],
  },
  eyebrow: {
    ...font(600),
    fontSize: 13,
    lineHeight: 18,
    color: colors.gold,
  },
  eyebrowTablet: {
    fontSize: 14,
    lineHeight: 20,
  },
  title: {
    ...font(700),
    fontSize: 42,
    lineHeight: 42,
    letterSpacing: -2.1,
    color: colors.textPrimary,
  },
  titleTablet: {
    fontSize: 60,
    lineHeight: 60,
    letterSpacing: -3.3,
  },
  titleTrainer: {
    fontSize: 36,
    lineHeight: 38,
    letterSpacing: -1.62,
  },
  titleTrainerTablet: {
    fontSize: 44,
    lineHeight: 46,
    letterSpacing: -2.2,
  },
  description: {
    ...font(400),
    marginTop: spacing['1_5'],
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  descriptionTablet: {
    marginTop: spacing[2],
    fontSize: 15,
    lineHeight: 22,
  },
  descriptionTrainer: {
    marginTop: spacing['2_5'],
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  actionRowStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  startCell: {
    flex: 1,
  },
  actionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  headerCard: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.choiceBorder,
    padding: spacing[5],
    overflow: 'hidden',
  },
  headerCardTablet: {
    borderRadius: radii.xxxl,
    padding: spacing[6],
  },
  // The teal glow top-right of the header card (220, drawn at 26 %).
  glow: {
    position: 'absolute',
    top: -110,
    right: -110,
    width: 220,
    height: 220,
  },
  cardTitle: {
    marginTop: spacing[3],
  },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginTop: spacing[4],
  },
  flexCell: {
    flexGrow: 1,
    flexBasis: 0,
  },
  noticeAction: {
    marginTop: spacing[3],
    alignItems: 'flex-start',
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[4],
    marginTop: spacing[1],
  },
  stack: {
    gap: spacing[4],
  },
  aside: {
    width: 236,
  },
  asideTrainer: {
    width: 200,
  },
  section: {
    gap: spacing[3],
  },
  sectionFlex: {
    flex: 1,
    minWidth: 0,
  },
  sectionHead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    paddingTop: spacing[1],
    paddingHorizontal: spacing[1],
  },
  sectionTitle: {
    ...font(700),
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.66,
    color: colors.textPrimary,
  },
  sectionTitleTablet: {
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.98,
  },
  helper: {
    ...font(400),
    marginTop: -spacing[1],
    paddingHorizontal: spacing[1],
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  helperTablet: {
    fontSize: 13,
    lineHeight: 18,
  },
  emptyCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  // The trainer tablet's dashed "Add a day" (46, 1.5 px dashed white 18 %).
  dashedAdd: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.hairlineBright,
  },
});
