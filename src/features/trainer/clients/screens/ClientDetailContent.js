import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { routes } from '../../../../navigation/routes';
import { getServerMessage, getStatus } from '../../../../shared/api/apiError';
import { CardHeroFill } from '../../../../shared/components/Card';
import EmptyState from '../../../../shared/components/EmptyState';
import ErrorAlert from '../../../../shared/components/ErrorAlert';
import GradientFill from '../../../../shared/components/GradientFill';
import { CAP_BODY, CAP_PILL, DISPLAY_TITLE_TEXT, TITLE_TEXT, useLargeTextReflow } from '../../../../shared/components/largeText';
import Loader from '../../../../shared/components/Loader';
import PillButton from '../../../../shared/components/PillButton';
import StateSlot from '../../../../shared/components/StateSlot';
import StatusPill from '../../../../shared/components/StatusPill';
import { ToastTone, addToast } from '../../../../shared/components/toastStore';
import { colors, font, gradients, layout, radii, spacing, typography } from '../../../../shared/theme/tokens';
import GymIcon from '../../../shell/GymIcon';
import EndCoachingDialog from '../../../trainers/components/EndCoachingDialog';
import {
  endCoaching,
  getClientPlan,
  getClientProgress,
  getClientWorkoutHistory,
  listClientAssignments,
} from '../api/clientsApi';
import { activityOf, clientUnit, initialsOf, isOnTrack, trainingDays, volumeInUnit, weekdayLabel } from '../clientActivity';
import { getClientProfileAndEmail } from '../clientDetailApi';
import {
  clientDisplayName,
  formatHeight,
  formatSessionDetail,
  formatSex,
  formatTrainerDate,
  formatVolume,
  formatWeight,
  sentenceCase,
  statusTone,
} from '../clientFormat';
import { openAssignPlan } from '../clientLinks';
import ClientAvatar from '../components/ClientAvatar';
import { ListCard, ListRow, SectionHeading, StatTile, StatusLine, clientStyles } from '../components/ClientsUi';
import { ChevronGlyph } from '../components/clientIcons';
import WeightHistoryModal from '../components/WeightHistoryModal';
import WorkoutDetailModal from '../components/WorkoutDetailModal';

// C2 content (trainer clients spec §C4; v2 phase 6 §2, UX N Client detail),
// shared by the Client detail page and the tablet Clients pane.
// `layout`: 'phone' (one column), 'tablet' (the full tablet page: hero card,
// 4 tiles, two columns) or 'pane' (the master/detail pane: one column).
// `clientActivity` is the list row's BE activity when known (else hidden).
export default function ClientDetailContent({ clientUserId, clientActivity, layout = 'phone', header, onEnded, onBackToClients }) {
  const navigation = useNavigation();
  const reflow = useLargeTextReflow();
  const mounted = useRef(true);
  const [state, setState] = useState({ status: 'loading', data: null, error: '' });
  const [hadProfile, setHadProfile] = useState(null);
  const [workoutId, setWorkoutId] = useState(null);
  const [weightOpen, setWeightOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [ending, setEnding] = useState(false);
  const tablet = layout === 'tablet';

  // §C4.1: five loads in parallel; any 404 → not your client.
  const load = useCallback(async () => {
    setState((current) => ({ ...current, status: 'loading', error: '' }));
    try {
      const [plan, profileResult, progress, history, assignments] = await Promise.all([
        getClientPlan(clientUserId),
        getClientProfileAndEmail(clientUserId),
        getClientProgress(clientUserId),
        getClientWorkoutHistory(clientUserId),
        listClientAssignments(clientUserId),
      ]);
      if (!mounted.current) {
        return;
      }
      const profile = profileResult?.profile ?? null;
      if (profile) {
        setHadProfile(profile);
      }
      setState({
        status: 'loaded',
        data: { plan, profile, clientEmail: profileResult?.clientEmail ?? null, progress, history, assignments },
        error: '',
      });
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
      if (onEnded) {
        onEnded();
      } else {
        // ⚠C-5: a push; back returns here, which then shows "Not your client".
        navigation.push(routes.TrainerClients);
      }
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
  const row = clientActivity ? { client_activity: clientActivity } : null;
  const activity = activityOf(row);

  return (
    <View testID={`client-detail-${layout}`} style={styles.column}>
      {header}
      {renderBody()}
      {/* P5 review M1/M2 (moved here from the old ClientDetailScreen in the p56
          merge): the client's profile (the VOLUME RULE unit: current → goal → kg)
          and the name the page shows (the tablet eyebrow). */}
      <WorkoutDetailModal
        clientUserId={clientUserId}
        workoutId={workoutId}
        onClose={() => setWorkoutId(null)}
        profile={profile}
        clientName={heading}
      />
      <WeightHistoryModal
        isOpen={weightOpen}
        clientUserId={clientUserId}
        clientName={heading}
        profile={loaded ? state.data.profile : null}
        onClose={() => setWeightOpen(false)}
      />
      {/* P5 review M6: the End coaching dialog, client variant. */}
      <EndCoachingDialog
        testID="end-coaching-dialog"
        variant="client"
        isOpen={endOpen}
        onClose={() => setEndOpen(false)}
        onConfirm={confirmEnd}
        title="End coaching with this client?"
        description="They keep their plan, schedule and history. Your assignment is released so they control their own plan again."
        confirmLabel="End coaching"
        loading={ending}
      />
    </View>
  );

  function renderBody() {
    if (state.status === 'loading') {
      return (
        <>
          <TitleOnly heading={heading} tablet={tablet} />
          <StateSlot>
            <Loader label="Loading client" style={styles.loader} />
          </StateSlot>
        </>
      );
    }
    if (state.status === 'notFound') {
      return (
        <>
          <TitleOnly heading={heading} tablet={tablet} />
          <StateSlot>
            <EmptyState
              title="Not your client"
              message="This person isn’t one of your active clients. The relationship may have ended."
              actionLabel="Back to clients"
              actionTestID="client-back-to-clients"
              onAction={() => (onBackToClients ? onBackToClients() : navigation.push(routes.TrainerClients))}
            />
          </StateSlot>
        </>
      );
    }
    if (state.status === 'error') {
      return (
        <>
          <TitleOnly heading={heading} tablet={tablet} />
          <StateSlot>
            <ErrorAlert title="Could not load this client" description={state.error} onRetry={load} />
          </StateSlot>
        </>
      );
    }

    const { plan, clientEmail, progress, history, assignments } = state.data;
    const unit = clientUnit(profile);
    const planLabel = plan ? 'Change plan' : 'Assign a plan';
    const statusLine = activity ? renderStatusLine() : null;
    const emailButton = clientEmail ? (
      <PillButton
        testID="client-email"
        title="Email"
        variant="secondary"
        accessibilityLabel={`Email ${heading}`}
        icon={({ color }) => <GymIcon name="mail" size={18} color={color} />}
        // No mail handler (e.g. no mail app) rejects: silent, as v1 TrainerHub's Email.
        onPress={() => Linking.openURL(`mailto:${clientEmail}`).catch(() => {})}
        fullWidth={reflow}
        style={reflow ? null : styles.flexButton}
      />
    ) : null;

    if (tablet) {
      return (
        <>
          {renderHero(statusLine, emailButton)}
          {renderStats(progress?.stats, unit, 4)}
          {renderPlan(plan, planLabel, true)}
          <View style={[styles.twoColumns, reflow && styles.stack]}>
            <View style={styles.columnHalf}>{renderWorkouts(history, unit)}</View>
            <View style={styles.columnHalf}>{renderAssignments(assignments)}</View>
          </View>
          {renderCoaching(true)}
        </>
      );
    }

    return (
      <>
        <View style={styles.identity}>
          <ClientAvatar userId={clientUserId} initials={initialsOf(profile)} size={layout === 'pane' ? 60 : 64} />
          <View style={styles.identityText}>
            <Text {...TITLE_TEXT} accessibilityRole="header" style={styles.name}>
              {heading}
            </Text>
            {statusLine}
          </View>
        </View>
        <View style={[styles.actions, reflow && styles.stack]}>
          {/* §9 rule 4: stacked past 1.3×, primary on top. */}
          {reflow ? renderPlanButton(planLabel) : emailButton}
          {reflow ? emailButton : renderPlanButton(planLabel)}
        </View>
        {renderStats(progress?.stats, unit, 2)}
        {renderDetails()}
        {renderPlan(plan, planLabel, false)}
        {renderWorkouts(history, unit)}
        {renderAssignments(assignments)}
        {renderCoaching(false)}
      </>
    );
  }

  // ND-2 / approved missed line: amber "Missed n this week", else green
  // "On track" (active plan and no missed); neither without the data.
  function renderStatusLine() {
    if (activity.missed > 0) {
      return <StatusLine testID="client-status-line" tone="warning" text={`Missed ${activity.missed} this week`} />;
    }
    if (isOnTrack(row)) {
      return <StatusLine testID="client-status-line" tone="success" text="On track" />;
    }
    return null;
  }

  function renderPlanButton(planLabel) {
    return (
      <PillButton
        testID="client-assign-plan"
        title={planLabel}
        onPress={() => openAssignPlan(clientUserId)}
        fullWidth={reflow}
        style={reflow ? null : styles.flexButton}
      />
    );
  }

  function renderHero(statusLine, emailButton) {
    return (
      <View testID="client-hero" style={styles.hero}>
        <CardHeroFill />
        <View style={[styles.heroRow, reflow && styles.stack]}>
          <ClientAvatar userId={clientUserId} initials={initialsOf(profile)} size={80} />
          <View style={styles.identityText}>
            <Text {...CAP_BODY} style={styles.heroEyebrow}>
              Client details
            </Text>
            <Text {...DISPLAY_TITLE_TEXT} accessibilityRole="header" style={styles.heroName}>
              {heading}
            </Text>
            {statusLine}
          </View>
          {emailButton ? <View style={styles.heroAction}>{emailButton}</View> : null}
        </View>
        {renderDetails(true)}
      </View>
    );
  }

  function renderStats(stats, unit, columns) {
    if (!stats) {
      return null;
    }
    // Volume: only total_volume_last_30_days_kg in the client's unit; absent
    // → the tile is hidden (never total_volume_last_30_days).
    const volume = volumeInUnit(stats.total_volume_last_30_days_kg, unit);
    const tiles = [
      { key: 'workouts', label: 'Workouts', value: stats.total_workouts_completed ?? 0, sub: 'completed', color: tablet ? colors.gold : colors.textPrimary },
      volume !== null
        ? { key: 'volume', label: 'Volume', value: formatVolume(volume), sub: `${unit} · last 30 days`, color: colors.textPrimary }
        : null,
      { key: 'week', label: 'This week', value: stats.workouts_this_week ?? 0, sub: 'workouts', color: tablet ? colors.success : colors.textPrimary },
      { key: 'streak', label: 'Streak', value: stats.current_streak ?? 0, sub: 'days', color: tablet ? colors.warning : colors.teal },
    ].filter(Boolean);
    const perRow = reflow ? 1 : Math.min(columns, tiles.length);
    return (
      <View testID="client-stats" style={styles.stats}>
        {tiles.map((tile) => (
          <StatTile
            key={tile.key}
            testID={`client-stat-${tile.key}`}
            label={tile.label}
            value={tile.value}
            sub={tile.sub}
            valueColor={tile.color}
            row={reflow}
            accessibilityLabel={`${tile.label}, ${tile.value}, ${tile.sub}`}
            style={{ width: perRow === 1 ? '100%' : `${100 / perRow - 2}%`, flexGrow: 1 }}
          />
        ))}
      </View>
    );
  }

  function renderDetails(inHero = false) {
    if (!profile) {
      return (
        <View style={inHero ? styles.heroDetails : null}>
          {inHero ? null : <SectionHeading>Client details</SectionHeading>}
          <EmptyState
            style={styles.sectionBody}
            title="No profile yet"
            message="This client hasn’t completed their profile, so there are no body details to show."
          />
        </View>
      );
    }
    const hasWeight = profile.current_weight_value != null;
    const cells = [
      { key: 'age', label: 'Age', value: profile.age != null ? String(profile.age) : '—' },
      { key: 'sex', label: 'Sex', value: formatSex(profile.sex) },
      { key: 'height', label: 'Height', value: formatHeight(profile.height_value, profile.height_unit) },
      {
        key: 'weight',
        label: 'Current weight',
        value: formatWeight(profile.current_weight_value, profile.current_weight_unit),
        onPress: hasWeight ? () => setWeightOpen(true) : undefined,
      },
      { key: 'goal', label: 'Goal weight', value: formatWeight(profile.goal_weight_value, profile.goal_weight_unit) },
    ];
    const perRow = reflow ? 1 : inHero ? 5 : 2;
    const width = perRow === 1 ? '100%' : `${100 / perRow - (inHero ? 2 : 4)}%`;
    if (inHero) {
      return (
        <View testID="client-details" style={[styles.heroDetails, styles.detailGrid]}>
          {cells.map((cell) => (
            <Detail key={cell.key} {...cell} cellStyle={[styles.heroCell, cell.onPress && styles.heroCellLink, { width }]} />
          ))}
        </View>
      );
    }
    return (
      <View testID="client-details" style={styles.card}>
        <SectionHeading>Client details</SectionHeading>
        <View style={[styles.detailGrid, styles.sectionBody]}>
          {cells.map((cell) => (
            <Detail key={cell.key} {...cell} cellStyle={{ width }} />
          ))}
        </View>
      </View>
    );
  }

  function renderPlan(plan, planLabel, withButton) {
    if (!plan) {
      return (
        <View>
          <View style={styles.headRow}>
            <SectionHeading>Assigned plan</SectionHeading>
            {withButton ? renderInkButton(planLabel, true) : null}
          </View>
          <EmptyState
            style={styles.sectionBody}
            title="No active plan"
            message="This client isn’t enrolled in a plan. Assign one to get them started."
          />
        </View>
      );
    }
    const planInfo = plan.enrollment?.plan;
    const started = formatTrainerDate(plan.enrollment?.started_on);
    // ND-11: days/week + category from the existing plan data; weekday chips
    // only with BE's weekly data.
    const meta = [planInfo?.days_per_week ? `${planInfo.days_per_week} days / week` : null, planInfo?.category?.name || null]
      .filter(Boolean)
      .join(' · ');
    const days = row ? trainingDays(row).map(weekdayLabel).filter(Boolean) : [];
    return (
      <View testID="client-plan-card" style={[styles.planCard, tablet && styles.planCardTablet]}>
        <GradientFill angle={gradients.gold.angle} colors={gradients.gold.colors} stops={gradients.gold.stops} />
        <View style={[styles.planRow, reflow && styles.stack]}>
          <View style={styles.identityText}>
            <Text {...CAP_BODY} style={styles.planEyebrow}>
              Assigned plan
            </Text>
            <Text {...TITLE_TEXT} style={[styles.planName, tablet && styles.planNameTablet]}>
              {planInfo?.name || 'Current plan'}
            </Text>
            <Text {...CAP_BODY} style={styles.planMeta}>
              {started ? `Started ${started}` : 'Active enrollment'}
            </Text>
            {meta ? (
              <Text {...CAP_BODY} style={styles.planMeta}>
                {meta}
              </Text>
            ) : null}
            {days.length ? (
              <View accessible accessibilityLabel={`Training days: ${days.join(', ')}`} style={styles.dayChips}>
                {days.map((day) => (
                  <View key={day} style={styles.dayChip}>
                    <Text {...CAP_PILL} style={styles.dayChipText}>
                      {day}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
          {withButton ? renderInkButton(planLabel, false) : null}
        </View>
      </View>
    );
  }

  // The tablet page's one plan entry: the black pill on the gold card (ND-12).
  // Without a plan it sits by the heading as the gold primary.
  function renderInkButton(planLabel, noPlan) {
    if (noPlan) {
      return <PillButton testID="client-assign-plan" title={planLabel} size="compact" onPress={() => openAssignPlan(clientUserId)} />;
    }
    return (
      <Pressable
        testID="client-assign-plan"
        accessibilityRole="button"
        accessibilityLabel={planLabel}
        onPress={() => openAssignPlan(clientUserId)}
        style={styles.inkButton}
      >
        {({ pressed }) => (
          <>
            {pressed ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.inkPressed]} /> : null}
            <Text {...CAP_BODY} style={styles.inkButtonText}>
              {planLabel}
            </Text>
          </>
        )}
      </Pressable>
    );
  }

  function renderWorkouts(history, unit) {
    const sessions = (history?.items ?? []).slice(0, 10);
    return (
      <View>
        <SectionHeading>Recent workouts</SectionHeading>
        {sessions.length === 0 ? (
          <EmptyState style={styles.sectionBody} title="No workouts yet" message="Their sessions will appear here once they train." />
        ) : (
          // ⚠C-3: the first 10 sessions only.
          <ListCard style={styles.sectionBody}>
            {sessions.map((session) => {
              const date = formatTrainerDate(session.completed_at || session.started_at) || 'Workout';
              const detail = formatSessionDetail(session, unit);
              const completed = session.status === 'completed';
              const statusText = sentenceCase(session.status);
              const title = session.workout_plan_day?.title;
              return (
                <ListRow
                  key={session.id}
                  testID={`client-session-${session.id}`}
                  accessibilityLabel={[title, date, detail, statusText].filter(Boolean).join(', ')}
                  style={styles.sessionRow}
                  onPress={() => setWorkoutId(session.id)}
                >
                  <View style={styles.sessionTile}>
                    {title ? (
                      <Text allowFontScaling={false} style={styles.sessionTileText}>
                        {initialsOf(splitTitle(title))}
                      </Text>
                    ) : (
                      <GymIcon name="workout" size={20} color={colors.textSecondary} />
                    )}
                  </View>
                  <View style={styles.sessionText}>
                    <Text {...CAP_BODY} style={clientStyles.rowLabel}>
                      {date}
                    </Text>
                    <Text {...CAP_BODY} style={clientStyles.rowMeta}>
                      {detail}
                    </Text>
                  </View>
                  <View style={styles.sessionRight}>
                    <StatusPill compact tone={completed ? 'completed' : 'gold'} label={statusText} />
                    <ChevronGlyph size={16} color={colors.textDisabled} />
                  </View>
                </ListRow>
              );
            })}
          </ListCard>
        )}
      </View>
    );
  }

  function renderAssignments(assignments) {
    return (
      <View>
        <SectionHeading>Assignment history</SectionHeading>
        {assignments.length === 0 ? (
          <EmptyState style={styles.sectionBody} title="Nothing assigned yet" message="Plans you assign to this client show up here." />
        ) : (
          <ListCard style={styles.sectionBody}>
            {assignments.map((assignment) => (
              <ListRow key={assignment.id} testID={`client-assignment-${assignment.id}`} style={styles.sessionRow}>
                <View style={styles.sessionText}>
                  {/* ⚠C-4: the id, not the plan name. */}
                  <Text {...CAP_BODY} style={clientStyles.rowLabel}>
                    Plan #{assignment.workout_plan_id}
                  </Text>
                  <Text {...CAP_BODY} style={clientStyles.rowMeta}>
                    {formatTrainerDate(assignment.created_at) ?? ''}
                  </Text>
                </View>
                <StatusPill compact tone={statusTone(assignment.status)} label={sentenceCase(assignment.status)} />
              </ListRow>
            ))}
          </ListCard>
        )}
      </View>
    );
  }

  function renderCoaching(wide) {
    return (
      <View testID="client-coaching" style={[styles.coachingCard, wide && styles.coachingWide, wide && reflow && styles.stack]}>
        <View style={styles.identityText}>
          <SectionHeading>Coaching</SectionHeading>
          <Text {...CAP_BODY} style={styles.coachingText}>
            Ending coaching is not destructive: they keep their enrollment, schedule and history, and any active assignment is
            released so they can manage their own plan again.
          </Text>
        </View>
        <Pressable
          testID="client-end-coaching"
          accessibilityRole="button"
          accessibilityLabel="End coaching"
          onPress={() => setEndOpen(true)}
          style={[styles.dangerOutline, !wide && styles.dangerOutlineTop]}
        >
          {({ pressed }) => (
            <>
              {/* §8.6a 5: a transparent danger button's pressed = danger-faint. */}
              {pressed ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.dangerPressed]} /> : null}
              <Text {...CAP_BODY} style={styles.dangerText}>
                End coaching
              </Text>
            </>
          )}
        </Pressable>
      </View>
    );
  }
}

// "Upper A" → first + second word initials ("UA").
function splitTitle(title) {
  const [first, ...rest] = String(title).trim().split(/\s+/);
  return { first_name: first, last_name: rest.length ? rest[rest.length - 1] : '' };
}

function TitleOnly({ heading, tablet }) {
  return (
    <Text {...(tablet ? DISPLAY_TITLE_TEXT : TITLE_TEXT)} accessibilityRole="header" style={[styles.name, tablet && styles.heroName]}>
      {heading}
    </Text>
  );
}

function Detail({ label, value, onPress, cellStyle }) {
  return (
    <View style={cellStyle}>
      <Text {...CAP_BODY} style={styles.detailLabel}>
        {label}
      </Text>
      {onPress ? (
        <Pressable
          testID="client-current-weight"
          accessibilityRole="button"
          accessibilityLabel={`${label}, ${value}, opens weight history`}
          onPress={onPress}
          hitSlop={8}
          style={styles.detailLinkRow}
        >
          {({ pressed }) => (
            <>
              <Text {...CAP_BODY} style={[styles.detailValue, styles.detailLink, pressed && styles.detailLinkPressed]}>
                {value}
              </Text>
              <ChevronGlyph size={14} color={colors.gold} />
            </>
          )}
        </Pressable>
      ) : (
        <Text {...CAP_BODY} style={styles.detailValue}>
          {value}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    gap: spacing[3],
  },
  loader: {
    paddingVertical: 48,
  },
  sectionBody: {
    marginTop: spacing[2],
  },
  stack: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['3_5'],
  },
  identityText: {
    flex: 1,
    minWidth: 0,
    gap: spacing[1],
  },
  // title-lg (board 28/32).
  name: {
    ...typography.titleLg,
    color: colors.textPrimary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  flexButton: {
    flex: 1,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    padding: spacing[4],
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing['2_5'],
    columnGap: spacing[3],
  },
  detailLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  detailValue: {
    ...font(600),
    marginTop: spacing['0_5'],
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  detailLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing[1],
    minHeight: 28,
  },
  detailLink: {
    color: colors.gold,
  },
  detailLinkPressed: {
    textDecorationLine: 'underline',
  },
  headRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  planCard: {
    borderRadius: radii.xl,
    padding: spacing['4_5'],
    overflow: 'hidden',
    backgroundColor: colors.gold,
  },
  planCardTablet: {
    borderRadius: radii.xxl,
    paddingVertical: spacing[5],
    paddingHorizontal: spacing['5_5'],
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  planEyebrow: {
    ...font(600),
    fontSize: 12,
    lineHeight: 16,
    color: colors.onGoldMuted,
  },
  planName: {
    ...font(700),
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.4,
    color: colors.onGold,
  },
  planNameTablet: {
    ...typography.titleLg,
    fontSize: 28,
    color: colors.onGold,
  },
  planMeta: {
    ...font(400),
    fontSize: 13,
    lineHeight: 18,
    color: colors.onGoldMuted,
  },
  dayChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing['1_5'],
    marginTop: spacing[1],
  },
  dayChip: {
    minHeight: 28,
    justifyContent: 'center',
    paddingHorizontal: spacing['2_5'],
    // Board radius 10 has no token: the nearest, radius-sm 12 (reported).
    borderRadius: radii.sm,
    backgroundColor: colors.onGold,
  },
  dayChipText: {
    ...font(600),
    fontSize: 13,
    lineHeight: 18,
    color: colors.gold,
  },
  inkButton: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing[5],
    borderRadius: radii.full,
    backgroundColor: colors.onGold,
    overflow: 'hidden',
  },
  inkPressed: {
    backgroundColor: colors.pressOverlay,
  },
  inkButtonText: {
    ...font(600),
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
    color: colors.textPrimary,
  },
  sessionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing[3],
  },
  sessionTile: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.fillGlass,
  },
  sessionTileText: {
    ...font(700),
    fontSize: 14,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  sessionText: {
    flex: 1,
    flexBasis: 160,
    minWidth: 0,
  },
  sessionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['2_5'],
  },
  coachingCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.dangerLine,
    backgroundColor: colors.dangerFaint,
    padding: spacing[4],
  },
  coachingWide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    paddingVertical: spacing['4_5'],
    paddingHorizontal: spacing['5_5'],
  },
  coachingText: {
    ...font(400),
    marginTop: spacing[1],
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  dangerOutline: {
    minHeight: layout.touchMin,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: spacing[5],
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.dangerLine,
    overflow: 'hidden',
  },
  dangerOutlineTop: {
    marginTop: spacing[3],
  },
  dangerPressed: {
    backgroundColor: colors.dangerFaint,
  },
  dangerText: {
    ...font(600),
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: colors.dangerText,
  },
  hero: {
    borderRadius: radii.xxxl,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing[6],
    overflow: 'hidden',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['4_5'],
  },
  heroAction: {
    flexShrink: 0,
    minWidth: 120,
  },
  heroEyebrow: {
    ...font(600),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  heroName: {
    ...typography.displayMd,
    color: colors.textPrimary,
  },
  heroDetails: {
    marginTop: spacing[5],
  },
  heroCell: {
    flexGrow: 1,
    borderRadius: radii.md,
    paddingVertical: spacing['2_5'],
    paddingHorizontal: spacing[3],
    backgroundColor: colors.fillChip,
  },
  heroCellLink: {
    backgroundColor: colors.goldTint,
  },
  twoColumns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  columnHalf: {
    flex: 1,
    minWidth: 0,
  },
});
