import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { getServerMessage, getStatus } from '../../../shared/api/apiError';
import ErrorAlert from '../../../shared/components/ErrorAlert';
import FormField from '../../../shared/components/FormField';
import Loader from '../../../shared/components/Loader';
import PillButton from '../../../shared/components/PillButton';
import { ToastTone, addToast } from '../../../shared/components/toastStore';
import { useFocusRemountKey } from '../../../shared/hooks/useFocusRemountKey';
import { breakpoints, colors, radii, shadows } from '../../../shared/theme/tokens';
import { useAuthStore } from '../../auth/authStore';
import ShellPage from '../../shell/ShellPage';
import { isTrainerUser } from '../../shell/shellRules';
import { CoachingHeader, TrainerStatusBadge } from '../../trainer/clients/components/ClientsUi';
import { formatTrainerDate } from '../../trainer/clients/clientFormat';
import { getMyTrainerApplication, submitTrainerApplication } from '../api/trainersApi';
import {
  APPLICATION_MAX_LENGTH,
  FORM_COPY,
  STATUS_SENTENCES,
  applicationErrorMessage,
  applicationView,
} from '../trainersFormat';

// TR3 Become a trainer (`/trainer/apply`). Every focus is a fresh mount.
export default function TrainerApplyScreen() {
  const remountKey = useFocusRemountKey();
  return (
    <ShellPage testID="trainer-apply-screen">
      <View style={styles.column}>
        <TrainerApply key={remountKey} />
      </View>
    </ShellPage>
  );
}

function TrainerApply() {
  const { width } = useWindowDimensions();
  const cardPadding = width >= breakpoints.sm ? styles.paddingWide : styles.paddingPhone;
  // Live token role (my-trainer §MT1.2).
  const isTrainer = isTrainerUser(useAuthStore((state) => state.user));
  const [state, setState] = useState({ loading: true, error: null, application: null });
  const mounted = useRef(true);

  useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );

  // TR3.1. ⚠TR-6: runs even for trainers.
  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const application = await getMyTrainerApplication();
      if (mounted.current) {
        setState({ loading: false, error: null, application });
      }
    } catch (error) {
      if (mounted.current) {
        setState((current) => ({ ...current, loading: false, error: getServerMessage(error) }));
      }
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onSubmitted = (application) => setState({ loading: false, error: null, application: application ?? null });
  const view = applicationView({ isTrainer, ...state });

  return (
    <View style={styles.page}>
      <CoachingHeader title="Become a trainer" subtitle="Coach other members, build them plans, and track their progress." />
      {renderBody()}
    </View>
  );

  function renderBody() {
    switch (view) {
      case 'alreadyTrainer':
        return (
          <View testID="trainer-apply-already" style={[styles.surfaceCard, cardPadding]}>
            <Text style={styles.cardTitle}>You’re already a trainer</Text>
            <Text style={[styles.body, styles.mt8]}>Your trainer tools are available from the main menu.</Text>
          </View>
        );
      case 'loading':
        return <Loader label="Loading your application" style={styles.loader} />;
      case 'error':
        return <ErrorAlert title="Could not load your application" description={state.error} onRetry={load} />;
      case 'form':
        return <ApplicationForm copy={FORM_COPY.first} cardPadding={cardPadding} onSubmitted={onSubmitted} />;
      case 'rejected':
        return (
          <>
            <StatusPanel application={state.application} sentence={STATUS_SENTENCES.rejected} cardPadding={cardPadding} />
            <ApplicationForm copy={FORM_COPY.again} cardPadding={cardPadding} onSubmitted={onSubmitted} />
          </>
        );
      default:
        return <StatusPanel application={state.application} sentence={STATUS_SENTENCES[view]} cardPadding={cardPadding} />;
    }
  }
}

// TR3.3
function StatusPanel({ application, sentence, cardPadding }) {
  const dates = [
    ['Submitted', formatTrainerDate(application.created_at)],
    ['Reviewed', formatTrainerDate(application.reviewed_at)],
  ].filter(([, value]) => value);

  return (
    <View testID="trainer-apply-status" style={[styles.surfaceCard, cardPadding]}>
      <View style={styles.statusHead}>
        <Text style={styles.cardTitle}>Your application</Text>
        <TrainerStatusBadge status={application.status} />
      </View>
      {dates.length ? (
        <View style={styles.dates}>
          {dates.map(([label, value]) => (
            <View key={label} style={styles.dateRow}>
              <Text style={styles.dateLabel}>{label}</Text>
              <Text style={styles.dateValue}>{value}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {application.message ? (
        <View style={styles.messageBox}>
          <Text style={styles.messageLabel}>Your message</Text>
          <Text style={[styles.body, styles.mt8]}>{application.message}</Text>
        </View>
      ) : null}
      <Text style={[styles.body, styles.mt20]}>{sentence}</Text>
    </View>
  );
}

// TR3.4
function ApplicationForm({ copy, cardPadding, onSubmitted }) {
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const busy = useRef(false);

  async function submit() {
    if (busy.current) {
      return;
    }
    busy.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const application = await submitTrainerApplication(message);
      addToast(ToastTone.success, 'Application submitted', 'An admin will review it shortly.');
      busy.current = false;
      onSubmitted(application);
    } catch (failure) {
      busy.current = false;
      setError(applicationErrorMessage(getStatus(failure), getServerMessage(failure)));
      setSubmitting(false);
    }
  }

  return (
    <View testID="trainer-apply-form" style={[styles.surfaceCard, cardPadding]}>
      <Text style={styles.cardTitle}>{copy.heading}</Text>
      <Text style={[styles.body, styles.mt8]}>{copy.blurb}</Text>
      {error ? (
        <View style={styles.mt20}>
          <ErrorAlert title="Could not submit" description={error} />
        </View>
      ) : null}
      <View style={styles.mt20}>
        <FormField
          testID="trainer-apply-message"
          label="Message (optional)"
          placeholder="Tell the team about your coaching experience."
          helperText="Optional — you can apply without one."
          multiline
          rows={5}
          maxLength={APPLICATION_MAX_LENGTH}
          editable={!submitting}
          value={message}
          onChangeText={setMessage}
        />
      </View>
      <View style={styles.submit}>
        <PillButton testID="trainer-apply-submit" title={copy.submit} loading={submitting} onPress={submit} />
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
  page: {
    gap: 20,
    paddingBottom: 24,
  },
  loader: {
    alignSelf: 'center',
    paddingVertical: 48,
  },
  surfaceCard: {
    borderRadius: radii.surfaceCard,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
    boxShadow: shadows.soft,
  },
  paddingPhone: {
    padding: 24,
  },
  paddingWide: {
    padding: 32,
  },
  cardTitle: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  body: {
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  statusHead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  dates: {
    marginTop: 20,
    gap: 8,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dateLabel: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  dateValue: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  messageBox: {
    marginTop: 20,
    borderRadius: radii.xxl,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  messageLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 2.16,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  submit: {
    marginTop: 24,
    alignItems: 'flex-start',
  },
  mt8: {
    marginTop: 8,
  },
  mt20: {
    marginTop: 20,
  },
});
