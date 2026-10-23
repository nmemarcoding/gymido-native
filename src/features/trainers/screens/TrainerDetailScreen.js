import { useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { routes } from '../../../navigation/routes';
import { getServerMessage, getStatus } from '../../../shared/api/apiError';
import ConfirmDialog from '../../../shared/components/ConfirmDialog';
import EmptyState from '../../../shared/components/EmptyState';
import ErrorAlert from '../../../shared/components/ErrorAlert';
import Loader from '../../../shared/components/Loader';
import PillButton from '../../../shared/components/PillButton';
import { ToastTone, addToast } from '../../../shared/components/toastStore';
import { useFocusRemountKey } from '../../../shared/hooks/useFocusRemountKey';
import { colors, radii, shadows } from '../../../shared/theme/tokens';
import { trainerDisplayName } from '../../myTrainer/myTrainerFormat';
import ShellPage from '../../shell/ShellPage';
import { TrainerStatusBadge } from '../../trainer/clients/components/ClientsUi';
import { getTrainer, requestCoaching } from '../api/trainersApi';
import { requestErrorMessage } from '../trainersFormat';

// TR2 Trainer profile (`/trainers/:trainerUserId`), param `trainerUserId`.
// Every focus is a fresh mount, so `requested` resets (⚠TR-3).
export default function TrainerDetailScreen() {
  const remountKey = useFocusRemountKey();
  const route = useRoute();
  return (
    <ShellPage testID="trainer-detail-screen">
      <View style={styles.column}>
        <TrainerDetail key={remountKey} trainerUserId={route.params?.trainerUserId} />
      </View>
    </ShellPage>
  );
}

function TrainerDetail({ trainerUserId }) {
  const navigation = useNavigation();
  const [state, setState] = useState({ loading: true, error: null, notFound: false, trainer: null });
  const [requested, setRequested] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const mounted = useRef(true);

  useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null, notFound: false }));
    try {
      const trainer = await getTrainer(trainerUserId);
      if (mounted.current) {
        setState({ loading: false, error: null, notFound: false, trainer: trainer ?? null });
      }
    } catch (error) {
      if (!mounted.current) {
        return;
      }
      if (getStatus(error) === 404) {
        setState((current) => ({ ...current, loading: false, notFound: true }));
      } else {
        setState((current) => ({ ...current, loading: false, error: getServerMessage(error) }));
      }
    }
  }, [trainerUserId]);

  useEffect(() => {
    load();
  }, [load]);

  // ⚠TR-4: both links push a new list instead of going back.
  const openList = () => navigation.push(routes.Trainers);

  // TR2a. ⚠TR-9: the dialog closes on failure too.
  async function sendRequest() {
    setSending(true);
    try {
      const relationship = await requestCoaching(trainerUserId);
      if (mounted.current) {
        setRequested(relationship ?? null);
      }
      addToast(ToastTone.success, 'Request sent', 'They’ll see it and can accept or decline.');
    } catch (error) {
      addToast(ToastTone.error, 'Could not send request', requestErrorMessage(getStatus(error), getServerMessage(error)));
    } finally {
      if (mounted.current) {
        setSending(false);
        setDialogOpen(false);
      }
    }
  }

  if (state.loading) {
    return <Loader label="Loading trainer" style={styles.loader} />;
  }
  if (state.notFound) {
    return (
      <EmptyState
        title="Trainer not found"
        message="This trainer isn’t available. They may have removed their profile."
        actionLabel="Back to trainers"
        actionTestID="trainer-detail-back"
        onAction={openList}
      />
    );
  }
  if (state.error || !state.trainer) {
    return <ErrorAlert title="Could not load this trainer" description={state.error} onRetry={load} />;
  }

  const { trainer } = state;
  const name = trainerDisplayName(trainer);

  return (
    <View style={styles.page}>
      <Pressable testID="trainer-detail-all" accessibilityRole="link" onPress={openList} style={styles.link}>
        {({ pressed }) => <Text style={[styles.linkText, pressed && styles.linkPressed]}>← All trainers</Text>}
      </Pressable>
      <View testID="trainer-detail-card" style={styles.card}>
        <View style={styles.accent} accessibilityElementsHidden importantForAccessibility="no" />
        <View style={styles.content}>
          <Text style={styles.eyebrow}>Trainer</Text>
          <Text accessibilityRole="header" style={styles.name}>
            {name}
          </Text>
          {trainer.email ? <Text style={styles.email}>{trainer.email}</Text> : null}
          <Text style={styles.about}>About</Text>
          {trainer.bio ? (
            <Text style={styles.bio}>{trainer.bio}</Text>
          ) : (
            <Text style={[styles.bio, styles.noBio]}>This trainer hasn’t written a bio yet.</Text>
          )}
          <View style={styles.action}>
            {requested ? (
              <View testID="trainer-detail-requested" style={styles.requestedRow}>
                <TrainerStatusBadge status={requested.status} />
                <Text style={styles.requestedText}>{`Your request is waiting for ${name} to respond.`}</Text>
              </View>
            ) : (
              // ⚠TR-5: shown whatever the relationship with this trainer.
              <View style={styles.buttonRow}>
                <PillButton testID="trainer-detail-ask" title={`Ask ${name} to coach me`} onPress={() => setDialogOpen(true)} />
              </View>
            )}
          </View>
        </View>
      </View>
      <ConfirmDialog
        testID="trainer-detail-dialog"
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConfirm={sendRequest}
        title={`Ask ${name} to coach you?`}
        description="They can accept or decline. You can hold more than one pending request, but only one trainer at a time."
        confirmLabel="Send request"
        tone="brand"
        loading={sending}
      />
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
  // Batch A A3: the 44pt text-link hit area.
  link: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  linkText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.brand700,
  },
  linkPressed: {
    textDecorationLine: 'underline',
  },
  card: {
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
  content: {
    flex: 1,
    minWidth: 0,
    padding: 24,
  },
  eyebrow: {
    fontSize: 11.2,
    lineHeight: 16.8,
    fontWeight: '700',
    letterSpacing: 2.016,
    textTransform: 'uppercase',
    color: colors.brand700,
  },
  name: {
    marginTop: 6,
    fontSize: 30,
    lineHeight: 37.5,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  email: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  about: {
    marginTop: 20,
    fontSize: 11.2,
    lineHeight: 16.8,
    fontWeight: '700',
    letterSpacing: 2.016,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  bio: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  noBio: {
    fontStyle: 'italic',
    color: colors.textMuted,
  },
  action: {
    marginTop: 24,
  },
  buttonRow: {
    alignItems: 'flex-start',
  },
  requestedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
  },
  requestedText: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
});
