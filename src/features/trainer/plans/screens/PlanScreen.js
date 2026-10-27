import { useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { builderMessage, getServerMessage, getStatus } from '../../../../shared/api/apiError';
import EmptyState from '../../../../shared/components/EmptyState';
import ErrorAlert from '../../../../shared/components/ErrorAlert';
import Loader from '../../../../shared/components/Loader';
import PillButton from '../../../../shared/components/PillButton';
import StateSlot from '../../../../shared/components/StateSlot';
import { ToastTone, addToast } from '../../../../shared/components/toastStore';
import { useFocusRemountKey } from '../../../../shared/hooks/useFocusRemountKey';
import { breakpoints, colors, radii } from '../../../../shared/theme/tokens';
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
import DayListCard from '../components/DayListCard';
import EditPlanDetailsModal from '../components/EditPlanDetailsModal';
import ExercisePickerSheet from '../components/ExercisePickerSheet';
import PlanActionDialog, { PlanAction } from '../components/PlanActionDialog';
import { PlanPage, TextLink } from '../components/PlanPage';
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
  const { width } = useWindowDimensions();
  const mounted = useRef(true);

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

  // One day modal and one set modal each serve create and edit (⚠B-8).
  const [dayModal, setDayModal] = useState({ open: false, day: null });
  const [setModal, setSetModal] = useState({ open: false, exercise: null, set: null });
  const [pickerOpen, setPickerOpen] = useState(false);

  const capabilities = useMemo(() => adapter.getCapabilities({ isOwnPlan }), [adapter, isOwnPlan]);
  const canEdit = canEditPlan(capabilities);
  const { mutations } = adapter;
  const extension = useExtension({ planId, plan, days });

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

  // Part C §CP2: one flow for both copy buttons. Lifecycle pairing: `copying`
  // is set on press and cleared when the request settles while mounted.
  async function copyPlan() {
    setCopying(true);
    try {
      const copy = await mutations.copyPlan();
      addToast(ToastTone.success, 'Plan copied', text.copiedMessage);
      adapter.openCopy(navigation, copy?.id);
    } catch (error) {
      addToast(ToastTone.error, 'Could not copy the plan', builderMessage(error, undefined, text.copyNotYoursCopy));
    }
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

  // One confirmed action (§B4–§B8). Failures stay inside the dialog.
  async function confirmAction() {
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

  const wide = width >= breakpoints.sm;
  const twoColumns = width >= breakpoints.lg;
  const addDayContext = getAddDayContext(plan, days);
  const isInactive = plan?.is_active === false;
  let description = text.descriptionCatalog;
  if (isOwnPlan) {
    description = canEdit ? text.descriptionOwnEdit : text.descriptionOwnAddOnly;
  }

  return (
    <PlanPage testID="plan-screen" nestable>
      {/* ⚠T3-3: pushes a fresh list rather than going back. */}
      <TextLink
        testID="plan-all-plans"
        label={text.backLabel}
        onPress={() => adapter.openBack(navigation)}
        style={adapter.backLinkHitArea ? styles.backLink : undefined}
      />

      <View style={[styles.pageHeader, wide ? styles.pageHeaderWide : styles.pageHeaderPhone]}>
        <View style={styles.pageHeaderText}>
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowBar} />
            <Text style={styles.eyebrow}>{isOwnPlan ? text.eyebrowOwn : text.eyebrowCatalog}</Text>
          </View>
          <Text accessibilityRole="header" style={styles.title}>
            {plan?.name || 'Plan'}
          </Text>
          <Text style={styles.description}>{description}</Text>
        </View>
        {capabilities.editPlan || capabilities.deletePlan || (isOwnPlan && capabilities.copyPlan) ? (
          <View style={[styles.headerActions, !wide && styles.headerActionsPhone]}>
            {extension.headerActions}
            {capabilities.editPlan ? (
              <PillButton testID="plan-edit-details" title="Edit details" variant="secondary" onPress={openEditPlan} />
            ) : null}
            {isOwnPlan && capabilities.copyPlan ? (
              <PillButton testID="plan-make-copy" title="Make a copy" variant="secondary" loading={copying} onPress={copyPlan} />
            ) : null}
            {capabilities.editPlan && isInactive ? (
              <PillButton
                testID="plan-activate"
                title="Activate"
                variant="secondary"
                loading={activating}
                onPress={activatePlan}
              />
            ) : null}
            {capabilities.editPlan && !isInactive ? (
              <PillButton
                testID="plan-deactivate"
                title="Deactivate"
                variant="secondary"
                onPress={() => openAction(PlanAction.deactivatePlan)}
              />
            ) : null}
            {capabilities.deletePlan ? (
              <PillButton
                testID="plan-delete"
                title="Delete plan"
                variant="danger"
                onPress={() => openAction(PlanAction.deletePlan)}
              />
            ) : null}
          </View>
        ) : null}
      </View>

      {isOwnPlan ? null : (
        <View accessibilityRole="summary" style={styles.notice}>
          <Text style={styles.noticeTitle}>This is a public plan</Text>
          <Text style={styles.noticeBody}>
            It’s part of the shared catalog, so it can’t be changed here — but you can still assign it to a client, or
            copy it to make your own version you can change.{' '}
            <Text
              testID="plan-create-own"
              accessibilityRole="link"
              style={styles.noticeLink}
              onPress={() => adapter.openCreate(navigation)}
            >
              Create your own plan
            </Text>{' '}
            if you want one you can build out from scratch.
          </Text>
          {capabilities.copyPlan ? (
            <View style={styles.noticeAction}>
              <PillButton testID="plan-copy-this" title="Copy this plan" loading={copying} onPress={copyPlan} />
            </View>
          ) : null}
        </View>
      )}
      {canEdit && isInactive ? <InactiveBanner body={text.inactiveBannerBody} /> : null}
      {canEdit ? <ClientsBanner count={affectedCount} /> : null}
      {extension.banners}

      <View style={twoColumns ? styles.bodyTwo : styles.bodyOne}>
        <View style={[styles.leftColumn, twoColumns && styles.leftColumnFixed]}>
          <DayListCard
            days={days}
            selectedDayId={selectedDayId}
            onSelect={selectDay}
            capabilities={capabilities}
            onEditDay={openDayEdit}
            onDeleteDay={(day) => openAction(PlanAction.deleteDay, { day })}
          />
          {capabilities.addDay ? (
            <PillButton
              testID="plan-add-day"
              title="Add a day"
              variant="secondary"
              fullWidth
              onPress={() => setDayModal({ open: true, day: null })}
            />
          ) : null}
        </View>
        <View style={[styles.rightColumn, twoColumns && styles.rightColumnFlex]}>{renderSelectedDay()}</View>
      </View>

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
      {extension.overlays}
    </PlanPage>
  );

  function renderSelectedDay() {
    if (!selectedDayId) {
      return (
        <EmptyState
          title="No days yet"
          message={capabilities.addDay ? 'Add a day to start building this plan.' : 'This plan has no days.'}
        />
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
    return (
      <>
        <View style={styles.exercisesHeader}>
          <Text style={styles.exercisesTitle}>Exercises</Text>
          {capabilities.addExercise ? (
            <PillButton
              ref={addExerciseRef}
              testID="plan-add-exercise"
              title="Add exercise"
              variant="secondary"
              onPress={() => setPickerOpen(true)}
            />
          ) : null}
        </View>
        {exercises.length === 0 ? (
          <EmptyState
            title="No exercises yet"
            message={capabilities.addExercise ? 'Add an exercise to this day.' : 'This day has no exercises.'}
          />
        ) : capabilities.reorderExercises ? (
          <SortableExerciseList
            {...listProps}
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

const styles = StyleSheet.create({
  // Batch A: M3's "← My plans" gets the 44 pt text-link hit area.
  backLink: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  loader: {
    paddingVertical: 48,
  },
  pageHeader: {
    marginBottom: 16,
  },
  pageHeaderPhone: {
    flexDirection: 'column',
    gap: 12,
  },
  pageHeaderWide: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  pageHeaderText: {
    flexShrink: 1,
  },
  headerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  headerActionsPhone: {
    width: '100%',
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eyebrowBar: {
    width: 4,
    height: 14,
    borderRadius: radii.full,
    backgroundColor: colors.brand400,
  },
  eyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 2.64,
    textTransform: 'uppercase',
    color: colors.brand700,
  },
  title: {
    marginTop: 6,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
    letterSpacing: -0.75,
    color: colors.textPrimary,
  },
  description: {
    marginTop: 8,
    maxWidth: 672,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  notice: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: 16,
  },
  noticeTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  noticeBody: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  noticeAction: {
    marginTop: 12,
    alignItems: 'flex-start',
  },
  noticeLink: {
    fontWeight: '700',
    color: colors.brand700,
  },
  bodyOne: {
    gap: 20,
  },
  bodyTwo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 20,
  },
  leftColumn: {
    gap: 12,
  },
  leftColumnFixed: {
    width: 280,
  },
  rightColumn: {
    gap: 16,
  },
  rightColumnFlex: {
    flex: 1,
    minWidth: 0,
  },
  exercisesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  exercisesTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    letterSpacing: 2.52,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
});
