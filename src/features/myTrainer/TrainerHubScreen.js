import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { routes } from '../../navigation/routes';
import { getServerMessage, getStatus } from '../../shared/api/apiError';
import ConfirmDialog from '../../shared/components/ConfirmDialog';
import EmptyState from '../../shared/components/EmptyState';
import ErrorAlert from '../../shared/components/ErrorAlert';
import GradientFill from '../../shared/components/GradientFill';
import Loader from '../../shared/components/Loader';
import PillButton from '../../shared/components/PillButton';
import StatusPill from '../../shared/components/StatusPill';
import { ToastTone, addToast } from '../../shared/components/toastStore';
import { useFocusRemountKey } from '../../shared/hooks/useFocusRemountKey';
import { breakpoints, colors, font, gradients, radii, spacing, typography } from '../../shared/theme/tokens';
import { useAuthStore } from '../auth/authStore';
import GymIcon from '../shell/GymIcon';
import ShellPage from '../shell/ShellPage';
import { openShellPath } from '../shell/shellLinks';
import { isTrainerUser } from '../shell/shellRules';
import {
  acceptTrainerRequest,
  endCoaching,
  getMyTrainer,
  listPendingTrainerRequests,
  rejectTrainerRequest,
} from './api/myTrainerApi';
import { acceptErrorMessage, deriveHub, trainerDisplayName } from './myTrainerFormat';

// v2 Phase 2 C5 (UX C §My trainer / §Tablet): LOOK only. Behaviour is
// RN-SPEC-my-trainer MT1.4–MT1.5 (Contact, End coaching + confirm, View
// plans, View progress, Accept / Decline), invitations on top (Batch B).
// One gold action per state (UX ruling), see `goldAction`.

// Two letters for an avatar: the first letters of the first two words.
export function initialsOf(name) {
  const words = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) {
    return '';
  }
  return (words.length === 1 ? words[0].slice(0, 2) : `${words[0][0]}${words[1][0]}`).toUpperCase();
}

// The status pill: the code's status in sentence case ("pending" → "Pending");
// Active = teal (UX ruling), Pending = warning, anything else neutral.
export function statusPill(status) {
  const key = String(status ?? '').trim().toLowerCase();
  const label = key ? `${key[0].toUpperCase()}${key.slice(1)}` : '';
  const tone = key === 'active' ? 'active' : key === 'pending' ? 'warning' : 'neutral';
  return { label, tone };
}

// One gold action per state: an invitation's Accept wins; then Contact (an
// active trainer with an email); then "Switch to Trainer Mode"; else
// "Browse trainers". Every other action is the glass secondary.
export function goldAction({ hub, trainer, isTrainer }) {
  if (hub.invitations.length > 0) {
    return 'accept';
  }
  if (hub.hasActiveTrainer && trainer?.email) {
    return 'contact';
  }
  if (isTrainer) {
    return 'switch';
  }
  return 'browse';
}

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
  const tablet = width >= breakpoints.md;
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
  const gold = goldAction({ hub, trainer: state.trainer, isTrainer });
  const variantFor = (action) => (gold === action ? 'primary' : 'secondary');
  // The phone board pairs "You don’t have a trainer" with "Your requests".
  const pairEmpty = !tablet && hub.blocks.includes('empty') && hub.blocks.includes('outgoing');

  const outgoingCard = (compact) => (
    <View key="outgoing" testID="trainer-hub-outgoing" style={[styles.card, compact && styles.half, tablet && styles.cardTablet]}>
      <Text accessibilityRole="header" style={[styles.smallHeading, tablet && styles.smallHeadingTablet]}>
        Your requests
      </Text>
      <View style={styles.requestRows}>
        {hub.outgoing.map((request) => {
          const pill = statusPill(request.status);
          return (
            <View key={request.id} testID={`trainer-hub-request-${request.id}`} style={compact ? styles.requestStack : styles.requestRow}>
              <Text numberOfLines={compact ? 2 : 1} style={[compact ? styles.requestNameCompact : styles.requestName, styles.flexShrink]}>
                {trainerDisplayName(request.trainer)}
              </Text>
              <StatusPill testID={`trainer-hub-request-status-${request.id}`} label={pill.label} tone={pill.tone} compact />
            </View>
          );
        })}
      </View>
    </View>
  );

  const emptyCompact = (
    <View key="empty" testID="trainer-hub-empty" style={[styles.card, styles.half]}>
      <View style={styles.iconTile} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <GymIcon name="trainer" size={20} color={colors.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>You don’t have a trainer</Text>
      <Text style={styles.emptyMessage}>Find a trainer to get plans built for you and your progress followed.</Text>
    </View>
  );

  const blocks = {
    invitations: (
      <View key="invitations" testID="trainer-hub-invitations" style={[styles.heroCard, tablet && styles.heroCardTablet]}>
        <GradientFill angle={gradients.card.angle} colors={gradients.card.colors} />
        <View style={styles.headingPill}>
          <Text accessibilityRole="header" style={styles.headingPillText}>{`Invitations (${hub.invitations.length})`}</Text>
        </View>
        {hub.hasActiveTrainer ? (
          <Text style={styles.hint}>You already have a trainer. End your current coaching before accepting one of these.</Text>
        ) : null}
        {hub.invitations.map((request) => {
          const name = trainerDisplayName(request.trainer);
          return (
            <View key={request.id} testID={`trainer-hub-invitation-${request.id}`} style={styles.invitation}>
              <View style={styles.invitationTop}>
                <Avatar name={name} size={60} />
                <View style={styles.textColumn}>
                  <Text numberOfLines={2} style={styles.invitationName}>
                    {name}
                  </Text>
                  <Text style={styles.invitationSub}>wants to coach you</Text>
                </View>
              </View>
              <View style={styles.invitationButtons}>
                <View style={styles.flex}>
                  <PillButton
                    testID={`trainer-hub-decline-${request.id}`}
                    title="Decline"
                    variant="secondary"
                    fullWidth
                    accessibilityLabel={`Decline ${name}`}
                    disabled={busy}
                    onPress={() => respond(request, false)}
                  />
                </View>
                <View style={styles.flex}>
                  <PillButton
                    testID={`trainer-hub-accept-${request.id}`}
                    title="Accept"
                    variant={variantFor('accept')}
                    fullWidth
                    accessibilityLabel={`Accept ${name}`}
                    disabled={busy}
                    onPress={() => respond(request, true)}
                  />
                </View>
              </View>
            </View>
          );
        })}
      </View>
    ),
    trainerMode: (
      <View key="trainerMode" testID="trainer-hub-trainer-mode" style={[styles.card, tablet && styles.cardTablet]}>
        <Text style={styles.eyebrow}>Trainer mode</Text>
        <Text style={[styles.cardTitle, styles.mt6]}>You are already a trainer</Text>
        <Text style={styles.cardBody}>Switch to Trainer Mode to manage your clients, their plans and your trainer profile.</Text>
        <View style={styles.mt16}>
          {/* ⚠MT-9: the path forces Trainer mode; the preference is not stored. */}
          <PillButton
            testID="trainer-hub-switch"
            title="Switch to Trainer Mode"
            variant={variantFor('switch')}
            onPress={() => openShellPath('/trainer')}
          />
        </View>
      </View>
    ),
    activeTrainer: (
      <ActiveTrainerCard
        key="activeTrainer"
        tablet={tablet}
        name={hub.trainerName}
        trainer={state.trainer}
        status={state.relationship?.status}
        contactVariant={variantFor('contact')}
        onEnd={() => setEndOpen(true)}
      />
    ),
    empty: pairEmpty ? null : (
      <EmptyState
        key="empty"
        title="You don’t have a trainer"
        message="Find a trainer to get plans built for you and your progress followed."
      />
    ),
    links: (
      <View key="links" style={tablet ? styles.linksRow : styles.linksColumn}>
        <LinkCard
          testID="trainer-hub-view-plans"
          title="View plans"
          icon="plans"
          tone="gold"
          tablet={tablet}
          onPress={() => openShellPath('/plans')}
        />
        <LinkCard
          testID="trainer-hub-view-progress"
          title="View progress"
          icon="progress"
          tone="teal"
          tablet={tablet}
          onPress={() => openShellPath('/progress')}
        />
      </View>
    ),
    outgoing: pairEmpty ? (
      <View key="outgoing" style={styles.pair}>
        {emptyCompact}
        {outgoingCard(true)}
      </View>
    ) : (
      outgoingCard(false)
    ),
    findTrainer: (
      <View key="findTrainer" testID="trainer-hub-find" style={[styles.heroCard, tablet && styles.heroCardTablet]}>
        <GradientFill angle={gradients.card.angle} colors={gradients.card.colors} />
        <Text style={styles.findTitle}>Find a trainer</Text>
        <Text style={[styles.cardBody, styles.mt8]}>
          Browse and search the trainers on Gymido, then send a request to the one you want. They build your plans and follow your
          progress.
        </Text>
        <View style={styles.mt16}>
          <PillButton
            testID="trainer-hub-browse"
            title="Browse trainers"
            variant={variantFor('browse')}
            fullWidth
            onPress={() => navigation.push(routes.Trainers)}
          />
        </View>
      </View>
    ),
    becomeTrainer: (
      <View key="becomeTrainer" testID="trainer-hub-become-card" style={[styles.card, styles.becomeCard, tablet && styles.becomeCardTablet]}>
        <View style={styles.textColumn}>
          <Text style={[styles.becomeTitle, tablet && styles.becomeTitleTablet]}>Want to coach others?</Text>
          <Text style={[styles.becomeBody, tablet && styles.becomeBodyTablet]}>
            Apply to become a trainer and get your own clients, plans and coaching dashboard.
          </Text>
        </View>
        <PillButton
          testID="trainer-hub-become"
          title="Become a trainer"
          variant="secondary"
          size="compact"
          onPress={() => navigation.push(routes.TrainerApply)}
        />
      </View>
    ),
  };

  return (
    <View style={[styles.page, tablet && styles.pageTablet]}>
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

// Initials avatar: the ground disc with gold initials (phone board).
function Avatar({ name, size, teal = false }) {
  return (
    <View
      testID="trainer-hub-avatar"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: teal ? size / 2 : radii.lg },
        teal && styles.avatarTeal,
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: Math.round(size / 3), lineHeight: Math.round(size / 3) + 4 }, teal && styles.avatarTextTeal]}>
        {initialsOf(name)}
      </Text>
    </View>
  );
}

// View plans (gold tint) / View progress (teal tint): link cards, the label
// is the name and the arrow is decorative.
function LinkCard({ testID, title, icon, tone, tablet, onPress }) {
  const gold = tone === 'gold';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.linkCard,
        gold ? styles.linkCardGold : styles.linkCardTeal,
        tablet && styles.linkCardTablet,
        pressed && styles.linkCardPressed,
      ]}
    >
      <View style={[styles.linkIcon, tablet && styles.linkIconTablet, gold ? styles.linkIconGold : styles.linkIconTeal]}>
        <GymIcon name={icon} size={tablet ? 24 : 20} color={gold ? colors.gold : colors.teal} />
      </View>
      <Text style={[styles.linkLabel, tablet && styles.linkLabelTablet]}>{title}</Text>
      <Text style={styles.linkArrow} accessibilityElementsHidden importantForAccessibility="no">
        →
      </Text>
    </Pressable>
  );
}

// MT1.4
function ActiveTrainerCard({ tablet, name, trainer, status, contactVariant, onEnd }) {
  const pill = statusPill(status);
  return (
    <View testID="trainer-hub-active" style={[styles.heroCard, styles.activeCard, tablet && styles.activeCardTablet]}>
      <GradientFill angle={gradients.card.angle} colors={gradients.card.colors} />
      <View style={[styles.activeTop, tablet && styles.activeTopTablet]}>
        <Avatar name={name} size={tablet ? 104 : 64} teal />
        <View style={styles.textColumn}>
          <Text style={styles.yourTrainer}>Your trainer</Text>
          <Text textBreakStrategy="simple" numberOfLines={2} style={tablet ? styles.trainerNameTablet : styles.trainerName}>
            {name}
          </Text>
          {trainer?.email ? <Text style={styles.email}>{trainer.email}</Text> : null}
          {pill.label ? (
            <View style={styles.mt8}>
              <StatusPill testID="trainer-hub-active-status" label={pill.label} tone={pill.tone} compact />
            </View>
          ) : null}
        </View>
      </View>
      {trainer?.bio ? <Text style={[styles.bio, tablet && styles.bioTablet]}>{trainer.bio}</Text> : null}
      <View style={[styles.activeButtons, tablet && styles.activeButtonsTablet]}>
        {trainer?.email ? (
          <PillButton
            testID="trainer-hub-contact"
            title="Contact"
            variant={contactVariant}
            onPress={() => Linking.openURL(`mailto:${trainer.email}`).catch(() => {})}
          />
        ) : null}
        <PillButton testID="trainer-hub-end" title="End coaching" variant="secondary" onPress={onEnd} />
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
    gap: spacing[3],
    paddingBottom: spacing[6],
  },
  pageTablet: {
    gap: spacing[4],
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  flexShrink: {
    flexShrink: 1,
  },
  textColumn: {
    flex: 1,
    minWidth: 0,
  },
  mt6: {
    marginTop: spacing['1_5'],
  },
  mt8: {
    marginTop: spacing[2],
  },
  mt16: {
    marginTop: spacing[4],
  },
  // The gradient-card hero (radius 28, padding 20); tablet 32 / 32.
  heroCard: {
    overflow: 'hidden',
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.choiceBorder,
    padding: spacing[5],
  },
  heroCardTablet: {
    padding: spacing[7],
  },
  // A surface card (radius 24, padding 16).
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    padding: spacing[4],
  },
  cardTablet: {
    borderRadius: radii.xxl,
    paddingVertical: spacing['4_5'],
    paddingHorizontal: spacing[6],
  },
  pair: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing[3],
  },
  half: {
    flex: 1,
    minWidth: 0,
  },
  headingPill: {
    alignSelf: 'flex-start',
    height: 26,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: radii.full,
    backgroundColor: colors.goldTint,
  },
  headingPillText: {
    ...typography.caption,
    ...font(700),
    color: colors.gold,
  },
  hint: {
    ...typography.bodySm,
    marginTop: spacing[2],
    color: colors.textSecondary,
  },
  invitation: {
    marginTop: spacing[4],
  },
  invitationTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  invitationName: {
    ...typography.titleLg,
    fontSize: 26,
    lineHeight: 28,
    letterSpacing: -1.04,
    color: colors.textPrimary,
  },
  invitationSub: {
    ...typography.bodySm,
    marginTop: 3,
    color: colors.textSecondary,
  },
  invitationButtons: {
    marginTop: spacing['4_5'],
    flexDirection: 'row',
    gap: spacing[2],
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ground,
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },
  avatarTeal: {
    backgroundColor: colors.tealTint,
    borderColor: colors.teal,
  },
  avatarText: {
    ...font(700),
    color: colors.gold,
  },
  avatarTextTeal: {
    color: colors.teal,
  },
  eyebrow: {
    ...typography.eyebrow,
  },
  cardTitle: {
    ...typography.titleXs,
    color: colors.textPrimary,
  },
  cardBody: {
    ...typography.bodySm,
    marginTop: spacing[2],
    color: colors.textSecondary,
  },
  smallHeading: {
    ...typography.label,
    ...font(600),
    color: colors.textMuted,
  },
  smallHeadingTablet: {
    ...typography.bodySm,
    ...font(600),
  },
  requestRows: {
    marginTop: spacing[2],
    gap: spacing[3],
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  requestStack: {
    gap: spacing[2],
    alignItems: 'flex-start',
  },
  requestName: {
    ...typography.labelLg,
    color: colors.textPrimary,
  },
  requestNameCompact: {
    ...typography.titleXs,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.6,
    color: colors.textPrimary,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.fillChip,
  },
  emptyTitle: {
    ...typography.labelLg,
    ...font(700),
    marginTop: spacing[3],
    letterSpacing: -0.32,
    color: colors.textPrimary,
  },
  emptyMessage: {
    ...typography.caption,
    lineHeight: 17,
    marginTop: 5,
    color: colors.textMuted,
  },
  findTitle: {
    ...typography.titleMd,
    letterSpacing: -0.84,
    color: colors.textPrimary,
  },
  becomeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing['4_5'],
  },
  becomeCardTablet: {
    borderRadius: radii.xxl,
    backgroundColor: colors.glass,
    borderColor: colors.choiceBorder,
    paddingVertical: spacing['5_5'],
    paddingHorizontal: spacing[6],
    gap: spacing[4],
  },
  becomeTitle: {
    ...typography.labelLg,
    ...font(700),
    color: colors.textPrimary,
  },
  becomeTitleTablet: {
    ...typography.titleXs,
    ...font(600),
  },
  becomeBody: {
    ...typography.caption,
    lineHeight: 17,
    marginTop: spacing['0_5'],
    color: colors.textMuted,
  },
  becomeBodyTablet: {
    ...typography.body,
    marginTop: spacing['1_5'],
  },
  linksColumn: {
    gap: spacing[3],
  },
  linksRow: {
    flexDirection: 'row',
    gap: spacing[4],
  },
  linkCard: {
    flex: 1,
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: spacing[4],
    borderRadius: radii.xxl,
    borderWidth: 1,
  },
  linkCardTablet: {
    padding: spacing[6],
  },
  linkCardGold: {
    backgroundColor: colors.goldTint,
    borderColor: colors.goldBorder,
  },
  linkCardTeal: {
    backgroundColor: colors.tealTint,
    borderColor: colors.hairlineStrong,
  },
  linkCardPressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.9,
  },
  linkIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkIconTablet: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
  },
  linkIconGold: {
    backgroundColor: colors.goldTint,
  },
  linkIconTeal: {
    backgroundColor: colors.tealTint,
  },
  linkLabel: {
    flex: 1,
    ...typography.titleXs,
    color: colors.textPrimary,
  },
  linkLabelTablet: {
    fontSize: 21,
    lineHeight: 26,
    letterSpacing: -0.42,
  },
  linkArrow: {
    ...typography.titleXs,
    color: colors.textMuted,
  },
  activeCard: {
    gap: spacing[4],
  },
  activeCardTablet: {
    borderRadius: 32,
    padding: spacing[8],
    gap: spacing[6],
  },
  activeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
  },
  activeTopTablet: {
    gap: spacing[5],
  },
  yourTrainer: {
    ...typography.bodySm,
    ...font(600),
    color: colors.teal,
  },
  trainerName: {
    ...typography.titleLg,
    color: colors.textPrimary,
  },
  // 52/54 (display-lg).
  trainerNameTablet: {
    ...typography.displayLg,
    lineHeight: 54,
    color: colors.textPrimary,
  },
  email: {
    ...typography.bodySm,
    marginTop: spacing[1],
    color: colors.textMuted,
  },
  bio: {
    ...typography.body,
    color: colors.textStrong2,
  },
  bioTablet: {
    fontSize: 17,
    lineHeight: 27,
  },
  activeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  activeButtonsTablet: {
    marginTop: spacing[1],
  },
});
