import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { routes } from '../../navigation/routes';
import { getServerMessage, getStatus } from '../../shared/api/apiError';
import ConfirmDialog from '../../shared/components/ConfirmDialog';
import EmptyState from '../../shared/components/EmptyState';
import ErrorAlert from '../../shared/components/ErrorAlert';
import Loader from '../../shared/components/Loader';
import PillButton from '../../shared/components/PillButton';
import { ToastTone, addToast } from '../../shared/components/toastStore';
import { useFocusRemountKey } from '../../shared/hooks/useFocusRemountKey';
import { breakpoints, colors, radii, shadows } from '../../shared/theme/tokens';
import { useAuthStore } from '../auth/authStore';
import ShellPage from '../shell/ShellPage';
import { openShellPath } from '../shell/shellLinks';
import { isTrainerUser } from '../shell/shellRules';
import { ListCard, TrainerStatusBadge } from '../trainer/clients/components/ClientsUi';
import {
  acceptTrainerRequest,
  endCoaching,
  getMyTrainer,
  listPendingTrainerRequests,
  rejectTrainerRequest,
} from './api/myTrainerApi';
import { acceptErrorMessage, deriveHub, trainerDisplayName } from './myTrainerFormat';

// The member's trainer hub (RN-SPEC-my-trainer), pushed in the Profile stack
// from the Coaching card. Every focus is a fresh mount (plans §8.1).
export default function TrainerHubScreen() {
  const remountKey = useFocusRemountKey();
  return (
    <ShellPage testID="trainer-hub-screen">
      <View style={styles.column}>
        <TrainerHub key={remountKey} />
      </View>
    </ShellPage>
  );
}

function TrainerHub() {
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const wide = width >= breakpoints.sm;
  // MT1.2: read live from the current token user on every render.
  const isTrainer = isTrainerUser(useAuthStore((state) => state.user));
  const [state, setState] = useState({ loading: true, error: null, relationship: null, trainer: null, requests: [] });
  const [busy, setBusy] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const mounted = useRef(true);

  useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );

  // MT1.1. ⚠MT-1: every reload shows the loader; ⚠MT-7: data kept on error.
  const reload = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const [mine, requests] = await Promise.all([getMyTrainer(), listPendingTrainerRequests()]);
      if (mounted.current) {
        setState({ loading: false, error: null, relationship: mine.relationship, trainer: mine.trainer, requests });
      }
    } catch (error) {
      if (mounted.current) {
        setState((current) => ({ ...current, loading: false, error: getServerMessage(error) }));
      }
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function respond(request, accept) {
    setBusy(true);
    try {
      if (accept) {
        await acceptTrainerRequest(request.id);
        addToast(ToastTone.success, 'Trainer accepted', 'They can now assign you plans and follow your progress.');
      } else {
        await rejectTrainerRequest(request.id);
        // ⚠MT-4: a title and no message.
        addToast(ToastTone.success, 'Request declined');
      }
    } catch (error) {
      if (accept) {
        addToast(ToastTone.error, 'Could not accept', acceptErrorMessage(getStatus(error), getServerMessage(error)));
      } else {
        addToast(ToastTone.error, 'Could not decline', getServerMessage(error));
      }
    } finally {
      if (mounted.current) {
        setBusy(false);
      }
    }
    reload();
  }

  // MT2: no reload on failure; the dialog closes either way (⚠MT-10).
  async function confirmEnd() {
    setBusy(true);
    try {
      await endCoaching();
      addToast(ToastTone.success, 'Coaching ended', 'Your plan, schedule and history are all kept — you just manage them yourself now.');
      reload();
    } catch (error) {
      addToast(ToastTone.error, 'Could not end coaching', getServerMessage(error));
    } finally {
      if (mounted.current) {
        setBusy(false);
        setEndOpen(false);
      }
    }
  }

  if (state.loading) {
    return <Loader label="Loading your trainer" style={styles.loader} />;
  }
  if (state.error) {
    return <ErrorAlert title="Could not load your trainer" description={state.error} onRetry={reload} />;
  }

  const hub = deriveHub({ relationship: state.relationship, trainer: state.trainer, requests: state.requests, isTrainer });
  const cardPadding = wide ? styles.surfaceCardWide : styles.surfaceCardPhone;

  const blocks = {
    invitations: (
      <View key="invitations" testID="trainer-hub-invitations">
        <Text accessibilityRole="header" style={styles.heading}>{`Invitations (${hub.invitations.length})`}</Text>
        {hub.hasActiveTrainer ? (
          <Text style={styles.hint}>You already have a trainer. End your current coaching before accepting one of these.</Text>
        ) : null}
        <ListCard style={styles.mt12}>
          {hub.invitations.map((request) => (
            <View key={request.id} testID={`trainer-hub-invitation-${request.id}`} style={styles.invitationRow}>
              <View style={styles.textColumn}>
                <Text numberOfLines={1} style={styles.rowName}>
                  {trainerDisplayName(request.trainer)}
                </Text>
                <Text style={styles.rowSub}>wants to coach you</Text>
              </View>
              <View style={styles.rowButtons}>
                <PillButton
                  testID={`trainer-hub-decline-${request.id}`}
                  title="Decline"
                  variant="secondary"
                  disabled={busy}
                  onPress={() => respond(request, false)}
                />
                <PillButton
                  testID={`trainer-hub-accept-${request.id}`}
                  title="Accept"
                  disabled={busy}
                  onPress={() => respond(request, true)}
                />
              </View>
            </View>
          ))}
        </ListCard>
      </View>
    ),
    trainerMode: (
      <View key="trainerMode" style={[styles.surfaceCard, cardPadding]}>
        <Text style={styles.eyebrow}>Trainer mode</Text>
        <Text style={[styles.cardTitle, styles.mt6]}>You are already a trainer</Text>
        <Text style={styles.cardBody}>Switch to Trainer Mode to manage your clients, their plans and your trainer profile.</Text>
        <View style={styles.mt20}>
          {/* ⚠MT-9: the path forces Trainer mode; the preference is not stored. */}
          <PillButton testID="trainer-hub-switch" title="Switch to Trainer Mode" onPress={() => openShellPath('/trainer')} />
        </View>
      </View>
    ),
    activeTrainer: (
      <ActiveTrainerCard
        key="activeTrainer"
        name={hub.trainerName}
        trainer={state.trainer}
        status={state.relationship?.status}
        onEnd={() => setEndOpen(true)}
      />
    ),
    empty: (
      <EmptyState
        key="empty"
        title="You don’t have a trainer"
        message="Find a trainer to get plans built for you and your progress followed."
      />
    ),
    links: (
      <View key="links" style={wide ? styles.linksRow : styles.linksColumn}>
        <View style={wide ? styles.flex : null}>
          <PillButton testID="trainer-hub-view-plans" title="View plans" variant="secondary" fullWidth onPress={() => openShellPath('/plans')} />
        </View>
        <View style={wide ? styles.flex : null}>
          <PillButton
            testID="trainer-hub-view-progress"
            title="View progress"
            variant="secondary"
            fullWidth
            onPress={() => openShellPath('/progress')}
          />
        </View>
      </View>
    ),
    outgoing: (
      <View key="outgoing" testID="trainer-hub-outgoing">
        <Text accessibilityRole="header" style={styles.heading}>
          Your requests
        </Text>
        <ListCard style={styles.mt12}>
          {hub.outgoing.map((request) => (
            <View key={request.id} style={styles.outgoingRow}>
              <Text numberOfLines={1} style={[styles.rowName, styles.flexShrink]}>
                {trainerDisplayName(request.trainer)}
              </Text>
              <TrainerStatusBadge status={request.status} />
            </View>
          ))}
        </ListCard>
      </View>
    ),
    findTrainer: (
      <View key="findTrainer" style={[styles.surfaceCard, cardPadding]}>
        <Text style={styles.cardTitle}>Find a trainer</Text>
        <Text style={styles.cardBody}>
          Browse and search the trainers on Gymido, then send a request to the one you want. They build your plans and follow your
          progress.
        </Text>
        <View style={styles.mt20}>
          <PillButton testID="trainer-hub-browse" title="Browse trainers" onPress={() => navigation.push(routes.Trainers)} />
        </View>
      </View>
    ),
    becomeTrainer: (
      <View key="becomeTrainer" style={[styles.surfaceCard, cardPadding]}>
        <Text style={styles.cardTitle}>Want to coach others?</Text>
        <Text style={styles.cardBody}>Apply to become a trainer and get your own clients, plans and coaching dashboard.</Text>
        <View style={styles.mt20}>
          <PillButton
            testID="trainer-hub-become"
            title="Become a trainer"
            variant="secondary"
            onPress={() => navigation.push(routes.TrainerApply)}
          />
        </View>
      </View>
    ),
  };

  return (
    <View style={styles.page}>
      {hub.blocks.map((name) => blocks[name])}
      <ConfirmDialog
        testID="trainer-hub-end-dialog"
        isOpen={endOpen}
        onClose={() => setEndOpen(false)}
        onConfirm={confirmEnd}
        title="End coaching?"
        description="You keep your current plan, schedule and history — you just manage them yourself again. You can ask another trainer afterwards."
        confirmLabel="End coaching"
        tone="danger"
        loading={busy}
      />
    </View>
  );
}

// MT1.4
function ActiveTrainerCard({ name, trainer, status, onEnd }) {
  return (
    <View testID="trainer-hub-active" style={styles.activeCard}>
      <View style={styles.accent} accessibilityElementsHidden importantForAccessibility="no" />
      <View style={styles.activeContent}>
        <View style={styles.activeTop}>
          <View style={styles.textColumn}>
            <Text style={styles.eyebrow}>Your trainer</Text>
            <Text numberOfLines={1} style={[styles.trainerName, styles.mt6]}>
              {name}
            </Text>
            {trainer?.email ? <Text style={styles.email}>{trainer.email}</Text> : null}
          </View>
          <TrainerStatusBadge status={status} />
        </View>
        {trainer?.bio ? <Text style={styles.bio}>{trainer.bio}</Text> : null}
        <View style={styles.activeButtons}>
          {trainer?.email ? (
            <PillButton
              testID="trainer-hub-contact"
              title="Contact"
              onPress={() => Linking.openURL(`mailto:${trainer.email}`).catch(() => {})}
            />
          ) : null}
          <PillButton testID="trainer-hub-end" title="End coaching" variant="secondary" onPress={onEnd} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    width: '100%',
    maxWidth: 672,
    alignSelf: 'center',
  },
  loader: {
    alignSelf: 'center',
    paddingVertical: 48,
  },
  page: {
    gap: 20,
    paddingBottom: 24,
  },
  heading: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    letterSpacing: 2.52,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  hint: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  invitationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  outgoingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  textColumn: {
    flex: 1,
    minWidth: 0,
  },
  flexShrink: {
    flexShrink: 1,
  },
  rowName: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  rowSub: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  rowButtons: {
    flexDirection: 'row',
    flexShrink: 0,
    gap: 8,
  },
  surfaceCard: {
    borderRadius: radii.surfaceCard,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
    boxShadow: shadows.soft,
  },
  surfaceCardPhone: {
    padding: 20,
  },
  surfaceCardWide: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  eyebrow: {
    fontSize: 11.2,
    lineHeight: 16.8,
    fontWeight: '700',
    letterSpacing: 2.016,
    textTransform: 'uppercase',
    color: colors.brand700,
  },
  cardTitle: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: colors.textPrimary,
  },
  cardBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  linksColumn: {
    gap: 12,
  },
  linksRow: {
    flexDirection: 'row',
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  activeCard: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: radii.xxxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    boxShadow: shadows.soft,
  },
  accent: {
    width: 6,
    backgroundColor: colors.brand400,
  },
  activeContent: {
    flex: 1,
    minWidth: 0,
    padding: 20,
  },
  activeTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  trainerName: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  email: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  bio: {
    marginTop: 16,
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  activeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 20,
  },
  mt6: {
    marginTop: 6,
  },
  mt12: {
    marginTop: 12,
  },
  mt20: {
    marginTop: 20,
  },
});
