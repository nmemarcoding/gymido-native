import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { getServerMessage, getStatus } from '../../../shared/api/apiError';
import { CardHeroFill } from '../../../shared/components/Card';
import ErrorAlert from '../../../shared/components/ErrorAlert';
import FormField from '../../../shared/components/FormField';
import GradientFill from '../../../shared/components/GradientFill';
import { CAP_BODY, DISPLAY_TITLE_TEXT, TITLE_TEXT } from '../../../shared/components/largeText';
import Loader from '../../../shared/components/Loader';
import PillButton from '../../../shared/components/PillButton';
import StateSlot from '../../../shared/components/StateSlot';
import StatusPill from '../../../shared/components/StatusPill';
import { ToastTone, addToast } from '../../../shared/components/toastStore';
import { useFocusRemountKey } from '../../../shared/hooks/useFocusRemountKey';
import { breakpoints, colors, font, gradients, radii, shadows, spacing, typography } from '../../../shared/theme/tokens';
import { useAuthStore } from '../../auth/authStore';
import ShellPage from '../../shell/ShellPage';
import { openShellPath } from '../../shell/shellLinks';
import { isTrainerUser } from '../../shell/shellRules';
import { formatTrainerDate } from '../../trainer/clients/clientFormat';
import { getMyTrainerApplication, submitTrainerApplication } from '../api/trainersApi';
import { PageBackLink, PageHeading } from '../components/CoachingPage';
import {
  APPLICATION_MAX_LENGTH,
  FORM_COPY,
  STATUS_SENTENCES,
  applicationErrorMessage,
  applicationView,
} from '../trainersFormat';
import { HeroTitleMark } from '../../shell/heroTitle';

export const APPLY_COLUMN_MAX = 620;
// The form card's gold corner glow (a 220 circle at the top-right).
export const FORM_GLOW_SIZE = 220;

// UX L: the phone page glow (gold 0.18 → the gold-ambient token).
export const APPLY_GLOW = Object.freeze({ radial: { cx: 0.85, cy: -0.08, rx: 1.2, ry: 0.45 }, colors: gradients.goldAmbient.colors, stops: [0, 0.6] });

// The application's status pill (TR3.3): the code's status in sentence case;
// approved = success green, rejected = danger, pending = warning.
export function applicationPill(status) {
  const key = String(status ?? '').trim().toLowerCase();
  const label = key ? `${key[0].toUpperCase()}${key.slice(1)}` : '';
  const tone = { approved: 'completed', rejected: 'danger', pending: 'warning' }[key] ?? 'neutral';
  return { label, tone };
}

// TR3 Become a trainer (`/trainer/apply`). Every focus is a fresh mount.
export default function TrainerApplyScreen() {
  const remountKey = useFocusRemountKey();
  return (
    <ShellPage testID="trainer-apply-screen" glow={APPLY_GLOW}>
      <View style={styles.column}>
        <TrainerApply key={remountKey} />
      </View>
    </ShellPage>
  );
}

function TrainerApply() {
  const tablet = useWindowDimensions().width >= breakpoints.md;
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
  const subtitle = 'Coach other members, build them plans, and track their progress.';

  return (
    <View style={[styles.page, tablet && styles.pageTablet]}>
      {/* §3 back-link rule (newly added): "← Coaching" → /my-trainer. */}
      <PageBackLink testID="trainer-apply-back" label="Coaching" onPress={() => openShellPath('/my-trainer')} />
      {tablet ? <GoldHero subtitle={subtitle} /> : <PageHeading testID="trainer-apply-heading" size="apply" title="Become a" accent="trainer" subtitle={subtitle} />}
      {renderBody()}
    </View>
  );

  function renderBody() {
    switch (view) {
      case 'alreadyTrainer':
        return (
          <FormCard testID="trainer-apply-already" tablet={tablet}>
            <Text {...TITLE_TEXT} style={styles.cardTitle}>
              You’re already a trainer
            </Text>
            <Text {...CAP_BODY} style={styles.body}>
              Your trainer tools are available from the main menu.
            </Text>
          </FormCard>
        );
      case 'loading':
        return (
          <StateSlot>
            <Loader label="Loading your application" style={styles.loader} />
          </StateSlot>
        );
      case 'error':
        return (
          <StateSlot>
            <ErrorAlert title="Could not load your application" description={state.error} onRetry={load} />
          </StateSlot>
        );
      case 'form':
        return <ApplicationForm copy={FORM_COPY.first} tablet={tablet} onSubmitted={onSubmitted} />;
      case 'rejected':
        return (
          <>
            <StatusPanel application={state.application} sentence={STATUS_SENTENCES.rejected} tablet={tablet} />
            <ApplicationForm copy={FORM_COPY.again} tablet={tablet} onSubmitted={onSubmitted} />
          </>
        );
      default:
        return <StatusPanel application={state.application} sentence={STATUS_SENTENCES[view]} tablet={tablet} />;
    }
  }
}

// Tablet: the solid gold hero (150°, the gold gradient's three stops) with
// the decorative ring and person-check icon (aria-hidden), ink text.
function GoldHero({ subtitle }) {
  return (
    <View testID="trainer-apply-hero" style={styles.hero}>
      <GradientFill angle={150} colors={gradients.gold.colors} stops={gradients.gold.stops} />
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.heroRing} />
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.heroIcon}>
        <Svg width={88} height={88} viewBox="0 0 88 88" fill="none">
          <Circle cx={34} cy={30} r={14} stroke={colors.onGold} strokeWidth={5} />
          <Path d="M10 72a24 24 0 0 1 48 0" stroke={colors.onGold} strokeWidth={5} strokeLinecap="round" />
          <Path d="M62 30l5 5 11-11" stroke={colors.onGold} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>
      <HeroTitleMark />
      <Text {...DISPLAY_TITLE_TEXT} accessibilityRole="header" style={styles.heroTitle}>
        Become a trainer
      </Text>
      <Text {...CAP_BODY} style={styles.heroSub}>
        {subtitle}
      </Text>
    </View>
  );
}

// The card every body state uses: phone radius 28 / padding 22, tablet
// radius 32 / padding 30; gradient-card, the 0.08 edge; `glow` = the gold
// corner glow (the form card).
function FormCard({ testID, tablet, glow = false, children }) {
  return (
    <View testID={testID} style={[styles.card, tablet && styles.cardTablet]}>
      <CardHeroFill />
      {glow ? (
        <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.cardGlow}>
          <GradientFill radial={gradients.heroGlow.radial} colors={gradients.heroGlow.colors} stops={gradients.heroGlow.stops} />
        </View>
      ) : null}
      {children}
    </View>
  );
}

// TR3.3
function StatusPanel({ application, sentence, tablet }) {
  const dates = [
    ['Submitted', formatTrainerDate(application.created_at)],
    ['Reviewed', formatTrainerDate(application.reviewed_at)],
  ].filter(([, value]) => value);

  return (
    <FormCard testID="trainer-apply-status" tablet={tablet}>
      <View style={styles.statusHead}>
        <Text {...TITLE_TEXT} style={styles.cardTitle}>
          Your application
        </Text>
        <StatusPill testID="trainer-apply-status-pill" {...applicationPill(application.status)} />
      </View>
      {dates.length ? (
        <View style={styles.dates}>
          {dates.map(([label, value]) => (
            <View key={label} style={styles.dateRow}>
              <Text {...CAP_BODY} style={styles.dateLabel}>
                {label}
              </Text>
              <Text {...CAP_BODY} style={styles.dateValue}>
                {value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {application.message ? (
        <View style={styles.messageBox}>
          <Text {...CAP_BODY} style={styles.messageLabel}>
            Your message
          </Text>
          <Text {...CAP_BODY} style={styles.messageText}>
            {application.message}
          </Text>
        </View>
      ) : null}
      <Text {...CAP_BODY} style={styles.body}>
        {sentence}
      </Text>
    </FormCard>
  );
}

// TR3.4
function ApplicationForm({ copy, tablet, onSubmitted }) {
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
    <FormCard testID="trainer-apply-form" tablet={tablet} glow={!tablet}>
      <View>
        <Text {...TITLE_TEXT} accessibilityRole="header" style={styles.formTitle}>
          {copy.heading}
        </Text>
        <Text {...CAP_BODY} style={[styles.blurb, tablet && styles.blurbTablet]}>
          {copy.blurb}
        </Text>
      </View>
      {error ? <ErrorAlert title="Could not submit" description={error} /> : null}
      <FormField
        testID="trainer-apply-message"
        label="Message (optional)"
        labelStyle={styles.label}
        placeholder="Tell the team about your coaching experience."
        helperText="Optional — you can apply without one."
        variant="well"
        multiline
        rows={tablet ? 6 : 5}
        maxLength={APPLICATION_MAX_LENGTH}
        editable={!submitting}
        value={message}
        onChangeText={setMessage}
      />
      <View style={tablet ? styles.submitTablet : null}>
        <PillButton testID="trainer-apply-submit" title={copy.submit} size="cta" fullWidth={!tablet} loading={submitting} onPress={submit} />
      </View>
    </FormCard>
  );
}

const styles = StyleSheet.create({
  column: {
    width: '100%',
    maxWidth: APPLY_COLUMN_MAX,
    alignSelf: 'center',
  },
  page: {
    gap: spacing[4],
    paddingBottom: spacing[6],
  },
  pageTablet: {
    gap: spacing['4_5'],
  },
  loader: {
    alignSelf: 'center',
    paddingVertical: 48,
  },
  hero: {
    overflow: 'hidden',
    borderRadius: radii.xxxxl,
    padding: spacing[8],
    boxShadow: shadows.goldGlowLarge,
  },
  heroRing: {
    position: 'absolute',
    right: -60,
    bottom: -110,
    width: 280,
    height: 280,
    borderRadius: radii.full,
    borderWidth: 34,
    borderColor: colors.inkFaint,
  },
  heroIcon: {
    position: 'absolute',
    right: 30,
    top: 28,
  },
  heroTitle: {
    ...font(700),
    maxWidth: 420,
    fontSize: 58,
    lineHeight: 58,
    letterSpacing: -3.48,
    color: colors.onGold,
  },
  // The drawn ink 0.78 folds to onGoldMuted 0.72 (reported).
  heroSub: {
    ...font(400),
    maxWidth: 440,
    marginTop: spacing['3_5'],
    fontSize: 17,
    lineHeight: 26,
    color: colors.onGoldMuted,
  },
  card: {
    overflow: 'hidden',
    gap: spacing['3_5'],
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.choiceBorder,
    padding: spacing['5_5'],
  },
  cardTablet: {
    gap: spacing['4_5'],
    borderRadius: radii.xxxl,
    padding: 30,
  },
  cardGlow: {
    position: 'absolute',
    top: -FORM_GLOW_SIZE / 2,
    right: -FORM_GLOW_SIZE / 2,
    width: FORM_GLOW_SIZE,
    height: FORM_GLOW_SIZE,
  },
  cardTitle: {
    ...typography.titleXs,
    flexShrink: 1,
    color: colors.textPrimary,
  },
  formTitle: {
    ...font(700),
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.91,
    color: colors.textPrimary,
  },
  blurb: {
    ...font(400),
    marginTop: spacing[1],
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  blurbTablet: {
    fontSize: 15,
    lineHeight: 22,
  },
  label: {
    ...font(600),
    fontSize: 14,
    lineHeight: 20,
  },
  body: {
    ...typography.bodySm,
    color: colors.textSecondary,
  },
  submitTablet: {
    alignItems: 'flex-start',
  },
  statusHead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  dates: {
    gap: spacing[2],
  },
  dateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  dateLabel: {
    ...typography.bodySm,
    color: colors.textMuted,
  },
  dateValue: {
    ...typography.bodySm,
    ...font(600),
    color: colors.textPrimary,
  },
  messageBox: {
    borderRadius: radii.lg,
    backgroundColor: colors.fillWell,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  // v2 eyebrow: sentence case 12/600 muted, never tracked caps.
  messageLabel: {
    ...font(600),
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  messageText: {
    ...typography.bodySm,
    marginTop: spacing['1_5'],
    color: colors.textStrong2,
  },
});
