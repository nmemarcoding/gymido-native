import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { routes } from '../../navigation/routes';
import { getServerMessage, getStatus } from '../../shared/api/apiError';
import EmptyState from '../../shared/components/EmptyState';
import ErrorAlert from '../../shared/components/ErrorAlert';
import GradientFill from '../../shared/components/GradientFill';
import Loader from '../../shared/components/Loader';
import PillButton from '../../shared/components/PillButton';
import StatusPill from '../../shared/components/StatusPill';
import { ToastTone, addToast } from '../../shared/components/toastStore';
import { useFocusRemountKey } from '../../shared/hooks/useFocusRemountKey';
import { breakpoints, colors, font, gradients, radii, spacing, textScale, typography } from '../../shared/theme/tokens';
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
import EndCoachingDialog from '../trainers/components/EndCoachingDialog';
import PersonAvatar, { AVATAR_FILL_ALPHA, avatarColor, personInitials } from '../trainers/personAvatar';
import { acceptErrorMessage, deriveHub, statusPill, trainerDisplayName, trainerInitials } from './myTrainerFormat';

// v2 Phase 2 C5 (UX C §My trainer / §Tablet): LOOK only. Behaviour is
// RN-SPEC-my-trainer MT1.4–MT1.5 (Contact, End coaching + confirm, View
// plans, View progress, Accept / Decline), invitations on top (Batch B).
// One gold action per state (UX ruling), see `goldAction`.

// Large text (UX §9): role caps; titles wrap by word (max 3 lines) and a
// single long word shrinks the title instead of breaking inside it.
const TITLE_TEXT = Object.freeze({
  textBreakStrategy: 'simple',
  maxFontSizeMultiplier: textScale.title,
  numberOfLines: 3,
  adjustsFontSizeToFit: true,
  minimumFontScale: 0.7,
});
const DISPLAY_TEXT = Object.freeze({ ...TITLE_TEXT, maxFontSizeMultiplier: textScale.display });
const BODY_TEXT = Object.freeze({ maxFontSizeMultiplier: textScale.body });
const PILL_TEXT = Object.freeze({ maxFontSizeMultiplier: textScale.pill });
// MT1.6: the gold card's trainer name wraps by word with no line cap, no
// ellipsis and no shrink (title-capped).
const INVITE_NAME_TEXT = Object.freeze({ textBreakStrategy: 'simple', maxFontSizeMultiplier: textScale.title });

// UX §8.3 decorative teal orb on the teal-accent cards (gradients.tealOrb):
// phone 200 at right/top −60 ("Find a trainer"); tablet "Your trainer" 340 at
// −90. Cards the boards don't draw at that size reuse the other size's orb.
export const ORB_PHONE = Object.freeze({ size: 200, offset: -60 });
export const ORB_TABLET = Object.freeze({ size: 340, offset: -90 });
// The tablet link cards' 150° tint wash: 0.16 → 0.04 on the ladder = tint →
// faint, the 0.28 edge = line (UX §8.5).
export const LINK_FILL = Object.freeze({
  gold: Object.freeze([colors.goldTint, colors.goldFaint]),
  teal: Object.freeze([colors.tealTint, colors.tealFaint]),
});
// The active trainer avatar's 5 px card-coloured gap (tablet board).
const AVATAR_GAP = 5;

// Initials (§3 a11y rule): the first and last word of a name (an address drops its domain).
export const initialsOf = personInitials;

// The status pill rule lives in myTrainerFormat (shared with Trainer detail).
export { statusPill };

// One gold action per state: an invitation's Accept wins; then Contact (an
// active trainer with an email); else "Browse trainers". Every other action
// is the glass secondary. Dated 27 Oct 2026 (audit b2b, MT1a never gold): a
// trainer-role member gets no Browse card, so with neither of the first two
// that state has NO gold action (null).
export function goldAction({ hub, trainer, isTrainer }) {
  if (hub.invitations.length > 0) {
    return 'accept';
  }
  if (hub.hasActiveTrainer && trainer?.email) {
    return 'contact';
  }
  if (isTrainer) {
    return null;
  }
  return 'browse';
}

// The member's trainer hub (RN-SPEC-my-trainer), pushed in the Profile stack
// from the Coaching card. Every focus is a fresh mount (plans §8.1).
export default function TrainerHubScreen() {
  const remountKey = useFocusRemountKey();
  return (
    <ShellPage testID="trainer-hub-screen" glow={gradients.tealAmbient}>
      <View testID="trainer-hub-column" style={styles.pageColumn}>
        <TrainerHub key={remountKey} />
      </View>
    </ShellPage>
  );
}

function TrainerHub() {
  const navigation = useNavigation();
  const { width, fontScale } = useWindowDimensions();
  const tablet = width >= breakpoints.md;
  // UX §9 reflow past 1.3×: button pairs stack (primary on top), side-by-side
  // cards become one column and trailing actions drop below the text.
  const stacked = fontScale > textScale.reflowAbove;
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
  const halfStyle = stacked ? null : styles.half;

  const outgoingCard = (compact) => (
    <View key="outgoing" testID="trainer-hub-outgoing" style={[styles.card, compact && halfStyle, tablet && styles.cardTablet]}>
      <Text {...BODY_TEXT} accessibilityRole="header" style={[styles.smallHeading, tablet && styles.smallHeadingTablet]}>
        Your requests
      </Text>
      <View style={styles.requestRows}>
        {hub.outgoing.map((request) => {
          const pill = statusPill(request.status);
          return (
            <View
              key={request.id}
              testID={`trainer-hub-request-${request.id}`}
              style={compact || stacked ? styles.requestStack : styles.requestRow}
            >
              <Text
                {...(compact ? TITLE_TEXT : BODY_TEXT)}
                numberOfLines={compact ? 3 : 2}
                style={[compact ? styles.requestNameCompact : styles.requestName, styles.flexShrink]}
              >
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
    <View key="empty" testID="trainer-hub-empty" style={[styles.card, halfStyle]}>
      <View style={styles.iconTile} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <GymIcon name="trainer" size={20} color={colors.textMuted} />
      </View>
      <Text {...BODY_TEXT} style={styles.emptyTitle}>
        You don’t have a trainer
      </Text>
      <Text {...BODY_TEXT} style={styles.emptyMessage}>
        Find a trainer to get plans built for you and your progress followed.
      </Text>
    </View>
  );

  const blocks = {
    invitations: (
      // Dated 27 Oct 2026 (audit b3, MT1.6): phone + tablet = ONE solid gold
      // card (150°, the gold stops), ink text, no border; the page's one gold.
      <View key="invitations" testID="trainer-hub-invitations" style={styles.goldCard}>
        <GradientFill angle={150} colors={gradients.gold.colors} stops={gradients.gold.stops} />
        <View testID="trainer-hub-invitations-chip" style={styles.headingPill}>
          <Text
            {...PILL_TEXT}
            accessibilityRole="header"
            style={styles.headingPillText}
          >{`Invitations (${hub.invitations.length})`}</Text>
        </View>
        {hub.hasActiveTrainer ? (
          <Text {...BODY_TEXT} style={styles.hint}>
            You already have a trainer. End your current coaching before accepting one of these.
          </Text>
        ) : null}
        {hub.invitations.map((request) => {
          const name = trainerDisplayName(request.trainer);
          return (
            <View key={request.id} testID={`trainer-hub-invitation-${request.id}`} style={styles.invitation}>
              <View style={styles.invitationTop}>
                <InviteTile
                  testID={`trainer-hub-invite-avatar-${request.id}`}
                  userId={request.trainer?.user_id ?? request.trainer_user_id}
                  initials={trainerInitials(request.trainer)}
                />
                <View style={styles.textColumn}>
                  {/* MT1.6 (27 Oct 2026, wins over X7 here): the name wraps, no truncation. */}
                  <Text {...INVITE_NAME_TEXT} style={styles.invitationName}>
                    {name}
                  </Text>
                  <Text {...BODY_TEXT} style={styles.invitationSub}>
                    wants to coach you
                  </Text>
                </View>
              </View>
              <View
                testID={`trainer-hub-invitation-buttons-${request.id}`}
                style={[styles.invitationButtons, stacked && styles.column]}
              >
                {(stacked ? ['accept', 'decline'] : ['decline', 'accept']).map((action) => (
                  <View key={action} style={stacked ? null : styles.flex}>
                    {/* On the gold card: Accept = solid ink (gold text), Decline = ink 0.12. */}
                    <PillButton
                      testID={`trainer-hub-${action}-${request.id}`}
                      title={action === 'accept' ? 'Accept' : 'Decline'}
                      variant={action === 'accept' ? 'ink' : 'inkTint'}
                      style={styles.invitationButton}
                      fullWidth
                      accessibilityLabel={`${action === 'accept' ? 'Accept' : 'Decline'} ${name}`}
                      disabled={busy}
                      onPress={() => respond(request, action === 'accept')}
                    />
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </View>
    ),
    // Dated 27 Oct 2026 (audit b2b, MT1a): never gold at any width. A surface
    // link card; the whole card is the one tap target (same action and name).
    // ⚠MT-9: the path forces Trainer mode; the preference is not stored.
    trainerMode: (
      <Pressable
        key="trainerMode"
        testID="trainer-hub-switch"
        accessibilityRole="button"
        accessibilityLabel="Switch to Trainer Mode"
        onPress={() => openShellPath('/trainer')}
        style={({ pressed }) => [styles.switchCard, tablet && styles.switchCardTablet, pressed && styles.linkCardPressed]}
      >
        {({ pressed }) => (
          <>
            {pressed ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pressOverlay]} /> : null}
            <View
              testID="trainer-hub-switch-icon"
              style={styles.switchIcon}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <GymIcon name="trainer" size={22} color={colors.teal} />
            </View>
            <View style={styles.textColumn}>
              <Text {...BODY_TEXT} style={styles.eyebrow}>
                Trainer mode
              </Text>
              <Text {...TITLE_TEXT} style={[styles.switchTitle, styles.mt6]}>
                You are already a trainer
              </Text>
              <Text {...BODY_TEXT} style={styles.cardBody}>
                Switch to Trainer Mode to manage your clients, their plans and your trainer profile.
              </Text>
              <Text {...BODY_TEXT} style={styles.switchAction}>
                Switch to Trainer Mode
              </Text>
            </View>
            <View testID="trainer-hub-switch-chevron" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M9 5l7 7-7 7" stroke={colors.textMuted} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
          </>
        )}
      </Pressable>
    ),
    activeTrainer: (
      <ActiveTrainerCard
        key="activeTrainer"
        tablet={tablet}
        stacked={stacked}
        name={hub.trainerName}
        initials={trainerInitials(state.trainer)}
        trainer={state.trainer}
        status={state.relationship?.status}
        userId={state.trainer?.user_id ?? state.relationship?.trainer_user_id}
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
      <View key="links" testID="trainer-hub-links" style={tablet && !stacked ? styles.linksRow : styles.linksColumn}>
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
      <View key="outgoing" testID="trainer-hub-pair" style={[styles.pair, stacked && styles.column]}>
        {emptyCompact}
        {outgoingCard(true)}
      </View>
    ) : (
      outgoingCard(false)
    ),
    findTrainer: (
      <View key="findTrainer" testID="trainer-hub-find" style={[styles.heroCard, tablet && styles.heroCardTablet]}>
        <GradientFill angle={gradients.card.angle} colors={gradients.card.colors} />
        <TealOrb testID="trainer-hub-find-orb" orb={ORB_PHONE} />
        <Text {...TITLE_TEXT} accessibilityRole="header" style={styles.findTitle}>
          Find a trainer
        </Text>
        <Text {...BODY_TEXT} style={[styles.cardBody, styles.mt8]}>
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
      <View
        key="becomeTrainer"
        testID="trainer-hub-become-card"
        style={[styles.card, styles.becomeCard, tablet && styles.becomeCardTablet, stacked && styles.becomeCardStacked]}
      >
        <View style={stacked ? null : styles.textColumn}>
          <Text {...BODY_TEXT} style={[styles.becomeTitle, tablet && styles.becomeTitleTablet]}>
            Want to coach others?
          </Text>
          <Text {...BODY_TEXT} style={[styles.becomeBody, tablet && styles.becomeBodyTablet]}>
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
      <EndCoachingDialog
        testID="trainer-hub-end-dialog"
        variant="member"
        isOpen={endOpen}
        onClose={() => setEndOpen(false)}
        onConfirm={confirmEnd}
        title="End coaching?"
        description="You keep your current plan, schedule and history — you just manage them yourself again. You can ask another trainer afterwards."
        confirmLabel="End coaching"
        loading={busy}
      />
    </View>
  );
}

// v2 Phase 5 avatar colour rule (RN-SPEC-v2-phase5 §1): the trainer's
// colour = user_id mod 6, 16 % fill + that colour for the initials. The
// active trainer keeps the board's card-coloured gap and 1 px ring (in the
// person's colour); an invitation keeps the rounded-square tile.
function Avatar({ name, initials, userId, size, ring = false }) {
  return (
    <PersonAvatar
      testID="trainer-hub-avatar"
      userId={userId}
      name={name}
      initials={initials}
      size={size}
      radius={ring ? undefined : radii.lg}
      initialsSize={Math.round(size / 3)}
      ring={ring ? { gap: AVATAR_GAP, gapColor: colors.surfaceCard2, alpha: 0.6 } : null}
      style={ring ? styles.avatarRing : undefined}
    />
  );
}

// MT1.6 (27 Oct 2026): the invitation's 60 r20 ink tile on the gold card.
// my-trainer:327 (audit b4, 27 Oct, wins over MT1.6's gold initials): the
// trainer's person colour (16 % tint + coloured initials, user_id mod 6) at
// every width. Decorative: the name beside it labels.
// T-64: trainerInitials (display name only, else the neutral "T").
function InviteTile({ testID, userId, initials }) {
  const color = avatarColor(userId);
  return (
    <View testID={testID} style={styles.inviteTile} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View testID={`${testID}-fill`} style={[StyleSheet.absoluteFill, { backgroundColor: color, opacity: AVATAR_FILL_ALPHA }]} />
      <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={[styles.inviteTileText, { color }]}>
        {initials}
      </Text>
    </View>
  );
}

// Decorative, no motion, hidden from accessibility (UX §8.3).
function TealOrb({ testID, orb }) {
  return (
    <View
      testID={testID}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.orb, { width: orb.size, height: orb.size, right: orb.offset, top: orb.offset }]}
    >
      <GradientFill radial={gradients.tealOrb.radial} colors={gradients.tealOrb.colors} stops={gradients.tealOrb.stops} />
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
      {({ pressed }) => (
        <>
          <GradientFill angle={150} colors={gold ? LINK_FILL.gold : LINK_FILL.teal} />
          {pressed ? (
            <View testID={`${testID}-pressed`} pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pressOverlay]} />
          ) : null}
          <View style={[styles.linkIcon, tablet && styles.linkIconTablet, gold ? styles.linkIconGold : styles.linkIconTeal]}>
            <GymIcon name={icon} size={tablet ? 24 : 20} color={gold ? colors.gold : colors.teal} />
          </View>
          <Text {...TITLE_TEXT} style={[styles.linkLabel, tablet && styles.linkLabelTablet]}>
            {title}
          </Text>
          <Text {...TITLE_TEXT} style={styles.linkArrow} accessibilityElementsHidden importantForAccessibility="no">
            →
          </Text>
        </>
      )}
    </Pressable>
  );
}

// MT1.4
// T-64 (27 Oct 2026, owner): no address is printed; Contact (only with an
// email) still opens mailto: without showing it.
function ActiveTrainerCard({ tablet, stacked = false, name, initials, userId, trainer, status, contactVariant, onEnd }) {
  const pill = statusPill(status);
  return (
    <View testID="trainer-hub-active" style={[styles.heroCard, styles.activeCard, tablet && styles.activeCardTablet]}>
      <GradientFill angle={gradients.card.angle} colors={gradients.card.colors} />
      <TealOrb testID="trainer-hub-active-orb" orb={tablet ? ORB_TABLET : ORB_PHONE} />
      <View style={[styles.activeTop, tablet && styles.activeTopTablet]}>
        <Avatar name={name} initials={initials} userId={userId} size={tablet ? 104 : 64} ring />
        <View style={styles.textColumn}>
          <Text {...BODY_TEXT} style={styles.yourTrainer}>
            Your trainer
          </Text>
          <Text
            {...(tablet ? DISPLAY_TEXT : TITLE_TEXT)}
            accessibilityRole="header"
            style={tablet ? styles.trainerNameTablet : styles.trainerName}
          >
            {name}
          </Text>
          {pill.label ? (
            <View style={styles.mt8}>
              <StatusPill testID="trainer-hub-active-status" label={pill.label} tone={pill.tone} compact />
            </View>
          ) : null}
        </View>
      </View>
      {trainer?.bio ? (
        <Text {...BODY_TEXT} style={[styles.bio, tablet && styles.bioTablet]}>
          {trainer.bio}
        </Text>
      ) : null}
      <View
        testID="trainer-hub-active-buttons"
        style={[styles.activeButtons, tablet && styles.activeButtonsTablet, stacked && styles.column]}
      >
        {trainer?.email ? (
          <PillButton
            testID="trainer-hub-contact"
            title="Contact"
            variant={contactVariant}
            fullWidth={stacked}
            icon={({ color }) => <GymIcon name="mail" size={18} color={color} />}
            onPress={() => Linking.openURL(`mailto:${trainer.email}`).catch(() => {})}
          />
        ) : null}
        <PillButton testID="trainer-hub-end" title="End coaching" variant="secondary" fullWidth={stacked} onPress={onEnd} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The page column (was a second `column` key, so a later one replaced it).
  pageColumn: {
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
  column: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  orb: {
    position: 'absolute',
  },
  pressOverlay: {
    backgroundColor: colors.pressOverlay,
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
  // MT1.6 gold card: radius 28, padding 20 at every width below 1280.
  goldCard: {
    overflow: 'hidden',
    borderRadius: radii.xxl,
    padding: spacing[5],
  },
  headingPill: {
    alignSelf: 'flex-start',
    minHeight: 26,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: radii.full,
    backgroundColor: colors.inkChip,
  },
  headingPillText: {
    ...typography.caption,
    ...font(700),
    fontSize: 12,
    color: colors.onGold,
  },
  hint: {
    ...typography.bodySm,
    marginTop: spacing[2],
    color: colors.onGoldMuted,
  },
  invitation: {
    marginTop: spacing[5],
  },
  inviteTile: {
    width: 60,
    height: 60,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.onGold,
  },
  // The colour is the person's (InviteTile).
  inviteTileText: {
    ...font(700),
    fontSize: 20,
    lineHeight: 24,
  },
  invitationButton: {
    minHeight: 50,
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
    color: colors.onGold,
  },
  invitationSub: {
    ...typography.bodySm,
    marginTop: 3,
    color: colors.onGoldMuted,
  },
  invitationButtons: {
    marginTop: spacing[4],
    flexDirection: 'row',
    gap: spacing['2_5'],
  },
  // The ring (5 px gap + 1 px line) sits outside the disc, as the board
  // draws it with shadows: the negative margin keeps the drawn layout.
  avatarRing: {
    margin: -AVATAR_GAP,
  },
  eyebrow: {
    ...typography.eyebrow,
  },
  // MT1a (27 Oct 2026): the surface link card, radius 24, padding 20 / 24.
  switchCard: {
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    padding: spacing[5],
  },
  switchCardTablet: {
    padding: spacing[6],
  },
  switchIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealTint,
  },
  switchTitle: {
    ...font(600),
    fontSize: 16,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  switchAction: {
    ...typography.bodySm,
    ...font(600),
    marginTop: spacing[2],
    color: colors.teal,
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
  becomeCardStacked: {
    flexDirection: 'column',
    alignItems: 'flex-start',
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
    overflow: 'hidden',
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
    borderColor: colors.goldLine,
  },
  linkCardTeal: {
    borderColor: colors.tealLine,
  },
  linkCardPressed: {
    transform: [{ scale: 0.99 }],
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
