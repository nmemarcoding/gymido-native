import { useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { routes } from '../../../../navigation/routes';
import { getServerMessage, getStatus } from '../../../../shared/api/apiError';
import ConfirmDialog from '../../../../shared/components/ConfirmDialog';
import EmptyState from '../../../../shared/components/EmptyState';
import ErrorAlert from '../../../../shared/components/ErrorAlert';
import Loader from '../../../../shared/components/Loader';
import PillButton from '../../../../shared/components/PillButton';
import { ToastTone, addToast } from '../../../../shared/components/toastStore';
import { useFocusRemountKey } from '../../../../shared/hooks/useFocusRemountKey';
import { breakpoints, colors, radii, shadows } from '../../../../shared/theme/tokens';
import ShellPage from '../../../shell/ShellPage';
import TrainerOnly from '../../TrainerOnly';
import {
  endCoaching,
  getClientPlan,
  getClientProfile,
  getClientProgress,
  getClientWorkoutHistory,
  listClientAssignments,
} from '../api/clientsApi';
import {
  clientDisplayName,
  formatSessionDetail,
  formatHeight,
  formatSex,
  formatTrainerDate,
  formatVolume,
  formatWeight,
} from '../clientFormat';
import { openAssignPlan } from '../clientLinks';
import { BrandLink, ListCard, ListRow, SectionHeading, TrainerStatCard, TrainerStatusBadge, clientStyles } from '../components/ClientsUi';
import WeightHistoryModal from '../components/WeightHistoryModal';
import WorkoutDetailModal from '../components/WorkoutDetailModal';

// C2 (trainer clients spec §C4). Every focus is a fresh mount, so coming
// back after assigning a plan refetches.
export default function ClientDetailScreen() {
  const remountKey = useFocusRemountKey();
  const { clientUserId } = useRoute().params ?? {};
  return (
    <TrainerOnly>
      <ClientDetail key={`${clientUserId}-${remountKey}`} clientUserId={clientUserId} />
    </TrainerOnly>
  );
}

function ClientDetail({ clientUserId }) {
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const mounted = useRef(true);
  const [state, setState] = useState({ status: 'loading', data: null, error: '' });
  const [hadProfile, setHadProfile] = useState(null);
  const [workoutId, setWorkoutId] = useState(null);
  const [weightOpen, setWeightOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [ending, setEnding] = useState(false);

  // §C4.1: five loads in parallel; any 404 → not your client.
  const load = useCallback(async () => {
    setState((current) => ({ ...current, status: 'loading', error: '' }));
    try {
      const [plan, profile, progress, history, assignments] = await Promise.all([
        getClientPlan(clientUserId),
        getClientProfile(clientUserId),
        getClientProgress(clientUserId),
        getClientWorkoutHistory(clientUserId),
        listClientAssignments(clientUserId),
      ]);
      if (!mounted.current) {
        return;
      }
      if (profile) {
        setHadProfile(profile);
      }
      setState({ status: 'loaded', data: { plan, profile, progress, history, assignments }, error: '' });
    } catch (failure) {
      if (!mounted.current) {
        return;
      }
      if (getStatus(failure) === 404) {
        setState({ status: 'notFound', data: null, error: '' });
      } else {
        setState({ status: 'error', data: null, error: getServerMessage(failure) });
      }
    }
  }, [clientUserId]);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  async function confirmEnd() {
    setEnding(true);
    try {
      await endCoaching(clientUserId);
      addToast(ToastTone.success, 'Coaching ended', 'They keep their plan, schedule and history — it just isn’t managed by you now.');
      setEndOpen(false);
      // ⚠C-5: a push; back returns here, which then shows "Not your client".
      navigation.push(routes.TrainerClients);
    } catch (failure) {
      addToast(ToastTone.error, 'Could not end coaching', getServerMessage(failure));
      setEndOpen(false);
    }
    if (mounted.current) {
      setEnding(false);
    }
  }

  // §C4.2 heading rule.
  const loaded = state.status === 'loaded';
  const profile = loaded ? state.data.profile : hadProfile;
  const heading = profile || loaded ? clientDisplayName(profile) : 'Client';
  const columns = width >= breakpoints.lg ? 3 : width >= breakpoints.sm ? 2 : 1;
  const statColumns = width >= breakpoints.lg ? 4 : width >= breakpoints.sm ? 2 : 1;

  return (
    <ShellPage>
      <View style={styles.column}>
        <View>
          {/* ⚠C-5: pushes C1 rather than going back. */}
          <BrandLink testID="client-all-clients" label="← All clients" onPress={() => navigation.push(routes.TrainerClients)} />
          <Text accessibilityRole="header" style={styles.title}>
            {heading}
          </Text>
        </View>
        {renderBody()}
      </View>
      <WorkoutDetailModal clientUserId={clientUserId} workoutId={workoutId} onClose={() => setWorkoutId(null)} />
      <WeightHistoryModal
        isOpen={weightOpen}
        clientUserId={clientUserId}
        profile={loaded ? state.data.profile : null}
        onClose={() => setWeightOpen(false)}
      />
      <ConfirmDialog
        testID="end-coaching-dialog"
        isOpen={endOpen}
        onClose={() => setEndOpen(false)}
        onConfirm={confirmEnd}
        title="End coaching with this client?"
        description="They keep their plan, schedule and history. Your assignment is released so they control their own plan again."
        confirmLabel="End coaching"
        tone="danger"
        loading={ending}
      />
    </ShellPage>
  );

  function renderBody() {
    if (state.status === 'loading') {
      return <Loader label="Loading client" style={styles.loader} />;
    }
    if (state.status === 'notFound') {
      return (
        <EmptyState
          title="Not your client"
          message="This person isn’t one of your active clients. The relationship may have ended."
          actionLabel="Back to clients"
          actionTestID="client-back-to-clients"
          onAction={() => navigation.push(routes.TrainerClients)}
        />
      );
    }
    if (state.status === 'error') {
      return <ErrorAlert title="Could not load this client" description={state.error} onRetry={load} />;
    }
    const { plan, progress, history, assignments } = state.data;
    const stats = progress?.stats;
    const sessions = (history?.items ?? []).slice(0, 10);
    const cell = (count) => ({ width: `${100 / count - (count > 1 ? 3 : 0)}%`, flexGrow: 1 });

    return (
      <>
        <View>
          <SectionHeading>Client details</SectionHeading>
          {profile ? (
            <View style={[styles.detailsCard, styles.sectionBody]}>
              <Detail style={cell(columns)} label="Name" value={clientDisplayName(profile)} />
              <Detail style={cell(columns)} label="Age" value={profile.age != null ? String(profile.age) : '—'} />
              <Detail style={cell(columns)} label="Sex" value={formatSex(profile.sex)} />
              <Detail style={cell(columns)} label="Height" value={formatHeight(profile.height_value, profile.height_unit)} />
              <Detail
                style={cell(columns)}
                label="Current weight"
                value={formatWeight(profile.current_weight_value, profile.current_weight_unit)}
                onPress={profile.current_weight_value != null ? () => setWeightOpen(true) : undefined}
              />
              <Detail style={cell(columns)} label="Goal weight" value={formatWeight(profile.goal_weight_value, profile.goal_weight_unit)} />
            </View>
          ) : (
            <EmptyState
              style={styles.sectionBody}
              title="No profile yet"
              message="This client hasn’t completed their profile, so there are no body details to show."
            />
          )}
        </View>

        {stats ? (
          <View style={styles.stats}>
            <TrainerStatCard style={cell(statColumns)} label="Workouts" value={stats.total_workouts_completed ?? 0} tone="brand" subtitle="completed" />
            <TrainerStatCard style={cell(statColumns)} label="This week" value={stats.workouts_this_week ?? 0} tone="emerald" subtitle="workouts" />
            <TrainerStatCard style={cell(statColumns)} label="Streak" value={stats.current_streak ?? 0} tone="amber" subtitle="days" />
            <TrainerStatCard
              style={cell(statColumns)}
              label="Volume"
              value={formatVolume(stats.total_volume_last_30_days ?? 0)}
              tone="slate"
              subtitle="last 30 days"
            />
          </View>
        ) : null}

        <View>
          <View style={styles.headingRow}>
            <SectionHeading>Assigned plan</SectionHeading>
            <PillButton
              testID="client-assign-plan"
              title={plan ? 'Change plan' : 'Assign a plan'}
              variant="secondary"
              onPress={() => openAssignPlan(clientUserId)}
            />
          </View>
          {plan ? (
            <View style={[styles.planCard, styles.sectionBody]}>
              <View style={styles.planBar} />
              <View style={styles.planBody}>
                <Text numberOfLines={1} style={styles.planName}>
                  {plan.enrollment?.plan?.name || 'Current plan'}
                </Text>
                <Text style={styles.planMeta}>
                  {formatTrainerDate(plan.enrollment?.started_on)
                    ? `Started ${formatTrainerDate(plan.enrollment.started_on)}`
                    : 'Active enrollment'}
                </Text>
              </View>
            </View>
          ) : (
            <EmptyState
              style={styles.sectionBody}
              title="No active plan"
              message="This client isn’t enrolled in a plan. Assign one to get them started."
            />
          )}
        </View>

        <View>
          <SectionHeading>Recent workouts</SectionHeading>
          {sessions.length === 0 ? (
            <EmptyState style={styles.sectionBody} title="No workouts yet" message="Their sessions will appear here once they train." />
          ) : (
            // ⚠C-3: the first 10 sessions only.
            <ListCard style={styles.sectionBody}>
              {sessions.map((session) => (
                <ListRow
                  key={session.id}
                  testID={`client-session-${session.id}`}
                  style={styles.sessionRow}
                  onPress={() => setWorkoutId(session.id)}
                >
                  <View style={styles.sessionText}>
                    <Text numberOfLines={1} style={clientStyles.rowLabel}>
                      {formatTrainerDate(session.completed_at || session.started_at) || 'Workout'}
                    </Text>
                    <Text style={clientStyles.rowMeta}>{formatSessionDetail(session)}</Text>
                  </View>
                  <View style={styles.sessionRight}>
                    <TrainerStatusBadge status={session.status === 'completed' ? 'active' : 'pending'} label={session.status} />
                    <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.chevron}>
                      ›
                    </Text>
                  </View>
                </ListRow>
              ))}
            </ListCard>
          )}
        </View>

        <View>
          <SectionHeading>Assignment history</SectionHeading>
          {assignments.length === 0 ? (
            <EmptyState style={styles.sectionBody} title="Nothing assigned yet" message="Plans you assign to this client show up here." />
          ) : (
            <ListCard style={styles.sectionBody}>
              {assignments.map((assignment) => (
                <ListRow key={assignment.id} style={styles.sessionRow}>
                  <View style={styles.sessionText}>
                    {/* ⚠C-4: the id, not the plan name. */}
                    <Text style={clientStyles.rowLabel}>Plan #{assignment.workout_plan_id}</Text>
                    <Text style={clientStyles.rowMeta}>{formatTrainerDate(assignment.created_at) ?? ''}</Text>
                  </View>
                  <TrainerStatusBadge status={assignment.status} />
                </ListRow>
              ))}
            </ListCard>
          )}
        </View>

        <View>
          <SectionHeading>Coaching</SectionHeading>
          <View style={[styles.coachingCard, styles.sectionBody]}>
            <Text style={styles.coachingText}>
              Ending coaching is not destructive: they keep their enrollment, schedule and history, and any active assignment is
              released so they can manage their own plan again.
            </Text>
            <View style={styles.coachingAction}>
              <PillButton testID="client-end-coaching" title="End coaching" variant="secondary" onPress={() => setEndOpen(true)} />
            </View>
          </View>
        </View>
      </>
    );
  }
}

function Detail({ label, value, onPress, style }) {
  return (
    <View style={style}>
      <Text style={styles.detailLabel}>{label}</Text>
      {onPress ? (
        <Pressable testID="client-current-weight" accessibilityRole="button" onPress={onPress}>
          {({ pressed }) => <Text style={[styles.detailValue, styles.detailLink, pressed && styles.detailLinkPressed]}>{value}</Text>}
        </Pressable>
      ) : (
        <Text style={styles.detailValue}>{value}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    width: '100%',
    maxWidth: 896,
    alignSelf: 'center',
    gap: 20,
    paddingBottom: 24,
  },
  title: {
    marginTop: 4,
    fontSize: 30,
    lineHeight: 37.5,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  loader: {
    paddingVertical: 48,
  },
  sectionBody: {
    marginTop: 12,
  },
  detailsCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    borderRadius: radii.xxxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 20,
    boxShadow: shadows.soft,
  },
  detailLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.68,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  detailValue: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  detailLink: {
    alignSelf: 'flex-start',
    color: colors.brand700,
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
  },
  detailLinkPressed: {
    color: '#5c4400',
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  planCard: {
    flexDirection: 'row',
    borderRadius: radii.xxxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    boxShadow: shadows.soft,
    overflow: 'hidden',
  },
  planBar: {
    width: 6,
    backgroundColor: colors.brand400,
  },
  planBody: {
    flex: 1,
    padding: 20,
  },
  planName: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  planMeta: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  sessionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sessionText: {
    flexShrink: 1,
    minWidth: 0,
  },
  sessionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chevron: {
    fontSize: 20,
    lineHeight: 24,
    color: colors.textMuted,
  },
  coachingCard: {
    borderRadius: radii.surfaceCard,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
    boxShadow: shadows.soft,
    padding: 20,
  },
  coachingText: {
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  coachingAction: {
    marginTop: 16,
    alignItems: 'flex-start',
  },
});
