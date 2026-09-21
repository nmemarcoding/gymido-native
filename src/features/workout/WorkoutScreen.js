import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LargeTitleHeader } from '../../navigation/shell/PageHeaders';
import PageLayout from '../../navigation/shell/PageLayout';
import { useFocusGeneration } from '../../navigation/shell/useFocusGeneration';
import { Toast } from '../../shared/components/feedback';
import { Body } from '../../shared/components/Typography';
import { useAuthStore } from '../auth/authStore';
import { getCurrentPlan, getWorkoutPlanDays } from '../plans/api/plansApi';
import ScheduleSetupCard from './ScheduleSetupCard';

// RN-SPEC-plans §4.8: the "Saved" toast clears after 3500ms.
export const SAVED_TOAST_MS = 3500;

// STUB Workout tab. Only what the Plans spec needs: the "Saved" toast from an
// activation hand-off and the ScheduleSetupCard (S3). The rest of the page
// comes with the Workout spec.
function WorkoutContent({ generation, isCurrent, onSaved }) {
  const user = useAuthStore((state) => state.user);
  const [current, setCurrent] = useState(null);
  const [planDays, setPlanDays] = useState([]);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const alive = () => isMounted && isCurrent(generation);

    const load = async () => {
      let nextCurrent = null;
      try {
        nextCurrent = await getCurrentPlan();
      } catch {
        nextCurrent = null;
      }
      let nextDays = [];
      const planId = nextCurrent?.enrollment?.workout_plan_id;
      if (planId) {
        try {
          nextDays = await getWorkoutPlanDays(planId);
        } catch {
          nextDays = [];
        }
      }
      if (!alive()) {
        return;
      }
      setCurrent(nextCurrent);
      setPlanDays(nextDays);
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [generation, isCurrent, reloadCount]);

  const needsSchedule =
    Boolean(current?.enrollment?.id) && planDays.length > 0 && (current?.schedule || []).length === 0;

  return (
    <View style={styles.content}>
      {needsSchedule ? (
        <ScheduleSetupCard
          key={current.enrollment.id}
          planName={current?.enrollment?.plan?.name}
          planDays={planDays}
          enrollmentId={current.enrollment.id}
          onScheduled={() => {
            onSaved('Training days saved.');
            setReloadCount((count) => count + 1);
          }}
        />
      ) : null}
      <Body>Workout page placeholder until the Workout spec arrives.</Body>
      {/* Session details the Maestro landing flows assert on (was the Home placeholder). */}
      <Body>Signed in as {user?.email ?? 'unknown'}</Body>
      <Body>Roles: {user?.roles?.length ? user.roles.join(', ') : 'none'}</Body>
    </View>
  );
}

export default function WorkoutScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { generation, isCurrent } = useFocusGeneration();
  const [toast, setToast] = useState(null);

  // Shown once from the route param, then the param is cleared so it doesn't
  // reappear on the next focus.
  const message = route.params?.message;
  useEffect(() => {
    if (message) {
      setToast({ message, id: Date.now() });
    }
  }, [message]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }
    const timer = setTimeout(() => {
      setToast(null);
      if (route.params?.message) {
        navigation.setParams({ message: undefined });
      }
    }, SAVED_TOAST_MS);
    return () => clearTimeout(timer);
    // Restart only for a new toast.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  return (
    <PageLayout testID="workout-screen">
      <LargeTitleHeader title="Workout" />
      <View style={styles.content}>
        {toast ? <Toast key={toast.id} tone="success" title="Saved" message={toast.message} /> : null}
        {generation === 0 ? null : (
          <WorkoutContent
            key={generation}
            generation={generation}
            isCurrent={isCurrent}
            onSaved={(text) => setToast({ message: text, id: Date.now() })}
          />
        )}
      </View>
    </PageLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 20,
  },
});
