import { useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { routes } from '../../../navigation/routes';
import { getServerMessage, getStatus } from '../../../shared/api/apiError';
import { CardHeroFill } from '../../../shared/components/Card';
import ConfirmDialog from '../../../shared/components/ConfirmDialog';
import EmptyState from '../../../shared/components/EmptyState';
import GradientFill from '../../../shared/components/GradientFill';
import ErrorAlert from '../../../shared/components/ErrorAlert';
import { CAP_BODY, CAP_PILL, DISPLAY_TITLE_TEXT, TITLE_TEXT } from '../../../shared/components/largeText';
import Loader from '../../../shared/components/Loader';
import PillButton from '../../../shared/components/PillButton';
import StateSlot from '../../../shared/components/StateSlot';
import StatusPill from '../../../shared/components/StatusPill';
import { ToastTone, addToast } from '../../../shared/components/toastStore';
import { useFocusRemountKey } from '../../../shared/hooks/useFocusRemountKey';
import { breakpoints, colors, font, muscleGlow, radii, shadows, spacing, typography } from '../../../shared/theme/tokens';
import { statusPill, trainerDisplayName, trainerInitials } from '../../myTrainer/myTrainerFormat';
import ShellPage from '../../shell/ShellPage';
import { getTrainer, requestCoaching } from '../api/trainersApi';
import { PageBackLink } from '../components/CoachingPage';
import PersonAvatar, { avatarColor } from '../personAvatar';
import { requestErrorMessage } from '../trainersFormat';
import { HeroTitleMark } from '../../shell/heroTitle';

export const DETAIL_COLUMN_MAX = 640;

// UX L ND1: the page's top glow takes the trainer's avatar colour (the board's
// teal for a teal person). Phone: a 330-tall wash at the top; tablet:
// radial(80 % 42 % at 60 % −4 %). The colour comes from the route's user id,
// so the glow is present from the first render (Android gradient rule).
export function detailGlow(trainerUserId, tablet) {
  const spec = muscleGlow(avatarColor(trainerUserId));
  return {
    radial: tablet ? { cx: 0.6, cy: -0.04, rx: 0.8, ry: 0.42 } : { cx: 0.5, cy: 0, rx: 0.9, ry: 0.4 },
    colors: spec.colors,
    stops: spec.stops,
  };
}

// TR2 Trainer profile (`/trainers/:trainerUserId`), param `trainerUserId`.
// Every focus is a fresh mount, so `requested` resets (⚠TR-3).
export default function TrainerDetailScreen() {
  const remountKey = useFocusRemountKey();
  const route = useRoute();
  const tablet = useWindowDimensions().width >= breakpoints.md;
  const trainerUserId = route.params?.trainerUserId;
  return (
    <ShellPage testID="trainer-detail-screen" glow={detailGlow(trainerUserId, tablet)}>
      <View style={styles.column}>
        <TrainerDetail key={remountKey} trainerUserId={trainerUserId} tablet={tablet} />
      </View>
    </ShellPage>
  );
}

function TrainerDetail({ trainerUserId, tablet }) {
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

  // §3 back-link rule: "← All trainers" (→ /trainers) on every state.
  const back = <PageBackLink testID="trainer-detail-all" label="All trainers" onPress={openList} />;

  if (state.loading) {
    return (
      <View style={styles.page}>
        {back}
        <StateSlot>
          <Loader label="Loading trainer" style={styles.loader} />
        </StateSlot>
      </View>
    );
  }
  if (state.notFound) {
    return (
      <View style={styles.page}>
        {back}
        <StateSlot>
          <EmptyState
            title="Trainer not found"
            message="This trainer isn’t available. They may have removed their profile."
            actionLabel="Back to trainers"
            actionTestID="trainer-detail-back"
            onAction={openList}
          />
        </StateSlot>
      </View>
    );
  }
  if (state.error || !state.trainer) {
    return (
      <View style={styles.page}>
        {back}
        <StateSlot>
          <ErrorAlert title="Could not load this trainer" description={state.error} onRetry={load} />
        </StateSlot>
      </View>
    );
  }

  const { trainer } = state;
  const name = trainerDisplayName(trainer);
  const initials = trainerInitials(trainer);
  const userId = trainer.user_id ?? trainerUserId;

  const action = requested ? (
    // The requested state: the status pill + sentence in the CTA slot (no gold button).
    <View testID="trainer-detail-requested" style={styles.requestedRow}>
      <StatusPill testID="trainer-detail-requested-status" {...statusPill(requested.status)} />
      <Text {...CAP_BODY} style={styles.requestedText}>{`Your request is waiting for ${name} to respond.`}</Text>
    </View>
  ) : (
    // ⚠TR-5: shown whatever the relationship with this trainer.
    <PillButton testID="trainer-detail-ask" title={`Ask ${name} to coach me`} size="cta" fullWidth style={tablet && styles.ctaTablet} onPress={() => setDialogOpen(true)} />
  );

  return (
    <View style={[styles.page, tablet && styles.pageTablet]}>
      {back}
      {tablet ? (
        <View testID="trainer-detail-card" style={styles.heroCard}>
          <CardHeroFill />
          <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.heroGlow}>
            <PersonGlow userId={userId} />
          </View>
          <PersonAvatar testID="trainer-detail-avatar" userId={userId} name={name} initials={initials} size={132} initialsSize={46} style={styles.avatarShadow} />
          <Text {...CAP_BODY} style={styles.eyebrowTablet}>
            Trainer
          </Text>
          <HeroTitleMark />
          <Text {...DISPLAY_TITLE_TEXT} accessibilityRole="header" style={styles.nameTablet}>
            {name}
          </Text>
          {trainer.email ? <ContactLink email={trainer.email} /> : null}
        </View>
      ) : (
        <View testID="trainer-detail-card" style={styles.identity}>
          <PersonAvatar testID="trainer-detail-avatar" userId={userId} name={name} initials={initials} size={104} initialsSize={38} ring={{ gap: 5, alpha: 0.45 }} />
          <StatusPill label="Trainer" tone="gold" style={styles.trainerPill} />
          <HeroTitleMark />
          <Text {...TITLE_TEXT} accessibilityRole="header" style={styles.name}>
            {name}
          </Text>
        </View>
      )}
      <View testID="trainer-detail-about" style={[styles.about, tablet && styles.aboutTablet]}>
        <Text {...TITLE_TEXT} style={tablet ? styles.aboutTitleTablet : styles.aboutTitle}>
          About
        </Text>
        {trainer.bio ? (
          <Text {...CAP_BODY} style={[styles.bio, tablet && styles.bioTablet]}>
            {trainer.bio}
          </Text>
        ) : (
          <Text {...CAP_BODY} style={[styles.bio, tablet && styles.bioTablet, styles.noBio]}>
            This trainer hasn’t written a bio yet.
          </Text>
        )}
      </View>
      <View style={styles.action}>{action}</View>
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
        // UX R2-2: the Request coaching board draws the × and Cancel.
        boardClose
      />
    </View>
  );
}

function PersonGlow({ userId }) {
  return <GradientFill {...muscleGlow(avatarColor(userId))} />;
}

// UX L ND4 (approved): the tablet mailto: link chip, the same action as My
// trainer's "Contact". T-64 (27 Oct 2026, owner): members never see a
// trainer's email, so the chip reads "Contact" and the address is never
// printed (nor read out); the phone shows nothing.
function ContactLink({ email }) {
  return (
    <Pressable
      testID="trainer-detail-contact"
      accessibilityRole="link"
      accessibilityLabel="Contact"
      hitSlop={{ top: 4, bottom: 4 }}
      // Like My trainer's Contact: no mail handler → the rejection is caught.
      onPress={() => {
        Linking.openURL(`mailto:${email}`).catch(() => {});
      }}
      style={styles.contactChip}
    >
      {({ pressed }) => (
        <>
          {pressed ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.chipPressed]} /> : null}
          <Text {...CAP_PILL} style={styles.contactChipText}>
            Contact
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  column: {
    width: '100%',
    maxWidth: DETAIL_COLUMN_MAX,
    alignSelf: 'center',
  },
  loader: {
    alignSelf: 'center',
    paddingVertical: 48,
  },
  page: {
    gap: spacing['3_5'],
    paddingBottom: spacing[6],
  },
  pageTablet: {
    gap: spacing[4],
  },
  identity: {
    alignItems: 'center',
    paddingTop: spacing[4],
    paddingHorizontal: spacing[2],
    paddingBottom: spacing[1],
  },
  trainerPill: {
    alignSelf: 'center',
    marginTop: spacing[4],
  },
  name: {
    ...font(700),
    marginTop: spacing['2_5'],
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -1.36,
    textAlign: 'center',
    color: colors.textPrimary,
  },
  about: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    padding: spacing[5],
  },
  // Tablet About: radius 30 → radii.xxl 28, the 0.6 glass → colors.glass
  // (both reported).
  aboutTablet: {
    borderRadius: radii.xxl,
    borderColor: colors.choiceBorder,
    backgroundColor: colors.glass,
    padding: 26,
  },
  aboutTitle: {
    ...font(600),
    fontSize: 15,
    lineHeight: 20,
    color: colors.textMuted,
  },
  aboutTitleTablet: {
    ...font(700),
    marginBottom: 0,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.4,
    color: colors.textPrimary,
  },
  bio: {
    ...font(400),
    marginTop: spacing['2_5'],
    fontSize: 15,
    lineHeight: 24,
    color: colors.textStrong2,
  },
  bioTablet: {
    fontSize: 18,
    lineHeight: 29,
  },
  noBio: {
    fontStyle: 'italic',
    color: colors.textFaint,
  },
  action: {
    marginTop: spacing['0_5'],
  },
  // Board 64; the kit's cta is 60 (reported).
  ctaTablet: {
    minHeight: 64,
  },
  requestedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing[3],
  },
  requestedText: {
    ...typography.bodySm,
    flexShrink: 1,
    color: colors.textSecondary,
  },
  heroCard: {
    overflow: 'hidden',
    alignItems: 'center',
    gap: spacing['2_5'],
    borderRadius: radii.xxxxl,
    borderWidth: 1,
    borderColor: colors.choiceBorder,
    paddingTop: 40,
    paddingHorizontal: spacing[8],
    paddingBottom: 36,
  },
  heroGlow: {
    position: 'absolute',
    top: -210,
    alignSelf: 'center',
    width: 420,
    height: 420,
  },
  // The drawn shadow is the person's colour at 0.7 (no token per colour):
  // the float shadow instead (reported).
  avatarShadow: {
    boxShadow: shadows.float,
  },
  eyebrowTablet: {
    ...font(600),
    marginTop: spacing[2],
    fontSize: 14,
    lineHeight: 20,
    color: colors.gold,
  },
  nameTablet: {
    ...typography.displayXl,
    textAlign: 'center',
    color: colors.textPrimary,
  },
  contactChip: {
    minHeight: 36,
    marginTop: spacing[1],
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: spacing['3_5'],
    borderRadius: radii.full,
    backgroundColor: colors.hairline,
  },
  chipPressed: {
    backgroundColor: colors.pressOverlay,
  },
  contactChipText: {
    ...typography.body,
    color: colors.textStrong2,
  },
});
