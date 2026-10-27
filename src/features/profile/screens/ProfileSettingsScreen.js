import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View, useWindowDimensions } from 'react-native';

import { routes } from '../../../navigation/routes';
import { isTabletWidth } from '../../../shared/components/AppModal';
import EmptyState from '../../../shared/components/EmptyState';
import ErrorAlert from '../../../shared/components/ErrorAlert';
import GradientFill from '../../../shared/components/GradientFill';
import Loader from '../../../shared/components/Loader';
import StateSlot from '../../../shared/components/StateSlot';
import { CAP_BODY, TITLE_TEXT, useLargeTextReflow } from '../../../shared/components/largeText';
import { colors, font, gradients, radii, spacing, typography } from '../../../shared/theme/tokens';
import { logout } from '../../auth/authService';
import { useAuthStore } from '../../auth/authStore';
import ShellPage from '../../shell/ShellPage';
import { openShellPath } from '../../shell/shellLinks';
import {
  setSpeakRestAlerts,
  setVibrateRestAlerts,
  useSpeakRestAlerts,
  useVibrateRestAlerts,
} from '../../workout/runtime/speakRestAlerts';
import ChangePasswordModal from '../ChangePasswordModal';
import CoachingCard from '../CoachingCard';
import DeleteAccountAction from '../DeleteAccountAction';
import { profileDisplayName, profileInitials } from '../editProfileForm';
import { hasGymidoPassword } from '../passwordReset';
import ProfileAvatar from '../ProfileAvatar';
import ProfileIcon from '../ProfileIcon';
import ProfileStatTiles from '../ProfileStatTiles';
import { ProfileStatus, fetchProfile, useProfileStore } from '../profileStore';

// The boards' page glows (UX K; colours = the §8.5 gold-ambient ladder step,
// geometry as drawn): phone radial(100% 40% at 50% −5%), tablet
// radial(70% 30% at 30% −5%), both to transparent at 70 %. The identity hero
// card's top glow is the gold orb, radial(100% 60% at 50% 0%).
export const PROFILE_GLOW = Object.freeze({
  radial: Object.freeze({ cx: 0.5, cy: -0.05, rx: 1, ry: 0.4 }),
  colors: gradients.accountGlow.colors,
  stops: Object.freeze([0, 0.7]),
});
export const PROFILE_GLOW_TABLET = Object.freeze({
  radial: Object.freeze({ cx: 0.3, cy: -0.05, rx: 0.7, ry: 0.3 }),
  colors: gradients.accountGlow.colors,
  stops: Object.freeze([0, 0.7]),
});
const HERO_GLOW = Object.freeze({
  radial: Object.freeze({ cx: 0.5, cy: 0, rx: 1, ry: 0.6 }),
  colors: gradients.cardCornerGlow.colors,
  stops: Object.freeze([0, 0.7]),
});

// RN-SPEC-profile P1 (Settings), the Profile tab root. Renders from the shared
// profile store; it fetches only while the store is idle (⚠P-1).
// v2 (RN-SPEC-v2-phase5 §2, UX K Profile / Tablet: Profile): phone = one
// column (identity, stat tiles, Coaching · Add weight pair, Account,
// Workout, Logout, Delete account); tablet = 300 identity column + lists.
export default function ProfileSettingsScreen() {
  const { width } = useWindowDimensions();
  return (
    <ShellPage glow={isTabletWidth(width) ? PROFILE_GLOW_TABLET : PROFILE_GLOW}>
      <Settings />
    </ShellPage>
  );
}

// RN-SPEC-v2-foundation §4.7: on = gold track + color-ground thumb; off =
// the 14 % white track + a text-primary thumb. The thumb position is the cue.
const SWITCH_TRACK = { false: colors.switchTrackOff, true: colors.gold };

function Settings() {
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const tablet = isTabletWidth(width);
  const reflow = useLargeTextReflow();
  const profile = useProfileStore((state) => state.profile);
  const profileStatus = useProfileStore((state) => state.profileStatus);
  const profileError = useProfileStore((state) => state.profileError);
  const email = useAuthStore((state) => state.user?.email);
  const sub = useAuthStore((state) => state.claims?.sub);
  const [changePasswordVisible, setChangePasswordVisible] = useState(false);
  const speakRestAlerts = useSpeakRestAlerts((state) => state.enabled);
  const vibrateRestAlerts = useVibrateRestAlerts((state) => state.enabled);

  // P1.1 (T-16): a failed load is retried once, on mount only.
  useEffect(() => {
    const status = useProfileStore.getState().profileStatus;
    if (status === ProfileStatus.idle || status === ProfileStatus.error) {
      fetchProfile();
    }
  }, []);

  if (profileStatus === ProfileStatus.loading || profileStatus === ProfileStatus.idle) {
    return (
      <StateSlot loader>
        <Loader label="Loading settings" />
      </StateSlot>
    );
  }
  // §D1: whole-page states in the 640 column under the header.
  if (profileStatus === ProfileStatus.error) {
    return (
      <StateSlot>
        <ErrorAlert
          testID="settings-error"
          title="Something went wrong"
          description={profileError?.message || 'Failed to load profile'}
          onRetry={() => fetchProfile()}
        />
      </StateSlot>
    );
  }
  if (profileStatus === ProfileStatus.missing || !profile) {
    // UX D row 19: the code's secondary "Create profile" (§D1 keeps it).
    return (
      <StateSlot>
        <EmptyState
          title="No profile yet"
          message="Create your profile to unlock settings."
          actionLabel="Create profile"
          actionTestID="settings-create-profile"
          onAction={() => navigation.navigate(routes.Onboarding)}
        />
      </StateSlot>
    );
  }

  const displayName = profileDisplayName(profile, email);
  const openEdit = () => navigation.push(routes.EditProfile);
  // ⚠P-3: switches to Progress; it doesn't open the weight modal.
  const openWeight = () => openShellPath('/progress');
  // RN-SPEC-profile P1.3 3b (23 Oct 2026, native only): the rest-end cues.
  // Phone tiles: speak gold-tint, vibrate teal-tint (Q1 as drawn); the
  // tablet board draws these two rows without tiles.
  const workoutSwitches = [
    {
      id: 'speak',
      testID: 'settings-speak-rest-alerts',
      icon: 'speaker',
      tint: 'gold',
      label: 'Speak rest alerts',
      hint: 'Say when rest is over',
      value: speakRestAlerts,
      onChange: setSpeakRestAlerts,
    },
    {
      id: 'vibrate',
      testID: 'settings-vibrate-rest-alerts',
      icon: 'vibrate',
      tint: 'teal',
      label: 'Vibrate on rest end',
      hint: 'Buzz when rest is over',
      value: vibrateRestAlerts,
      onChange: setVibrateRestAlerts,
    },
  ];
  const weightRow = {
    icon: 'plus',
    tint: 'gold',
    label: 'Add weight log manually',
    value: 'Track your weight trend',
    onPress: openWeight,
    id: 'weight',
  };
  const rows = [
    { icon: 'person', label: 'Personal Information', value: 'Name, DOB, sex', onPress: openEdit, id: 'personal' },
    { icon: 'measure', label: 'Body Measurements', value: 'Height, current, goal', onPress: openEdit, id: 'body' },
    { icon: 'units', label: 'Units of Measurement', value: 'Height + weight units', onPress: openEdit, id: 'units' },
    // P1a (25 Oct 2026, T-32 H1): an account without a Gymido password (any
    // sub but `auth0|`) gets a plain, non-interactive "Password" row instead.
    hasGymidoPassword(sub)
      ? {
          icon: 'lock',
          label: 'Change Password',
          value: 'Update your login password',
          onPress: () => setChangePasswordVisible(true),
          id: 'password',
          testID: 'settings-change-password',
        }
      : {
          icon: 'lock',
          label: 'Password',
          value: "You sign in with Google, so there's no Gymido password to change.",
          id: 'password',
          testID: 'settings-password-info',
          plain: true,
        },
    // Phone: the weight action moves into the pair card (UX K, a
    // presentation move); tablet keeps it as the last Account row.
    ...(tablet ? [weightRow] : []),
  ];

  const name = (
    <Text
      {...TITLE_TEXT}
      testID="settings-display-name"
      accessibilityRole="header"
      style={[styles.displayName, tablet && styles.displayNameTablet]}
    >
      {displayName}
    </Text>
  );
  const emailLine = (
    <Text {...CAP_BODY} numberOfLines={1} style={styles.email}>
      {email || 'Personal information'}
    </Text>
  );
  const manage = (
    <Pressable
      testID="settings-manage"
      accessibilityRole="button"
      onPress={openEdit}
      hitSlop={tablet ? undefined : MANAGE_SLOP}
      style={[styles.manage, tablet && styles.manageTablet]}
    >
      {({ pressed }) => (
        <>
          {pressed ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pressOverlay]} /> : null}
          <Text {...CAP_BODY} style={[styles.manageText, tablet && styles.manageTextTablet]}>
            Manage
          </Text>
        </>
      )}
    </Pressable>
  );

  const account = (
    <Section title="Account" tablet={tablet}>
      {rows.map((row, index) => (
        <ListRow key={row.id} row={row} first={index === 0} tablet={tablet} reflow={reflow} />
      ))}
    </Section>
  );
  const workout = (
    // RN-SPEC-profile P1.3 3b (23 Oct 2026, native only): the rest-end cues.
    <Section title="Workout" tablet={tablet}>
      {workoutSwitches.map((row, index) => (
        <SwitchRow key={row.id} row={row} first={index === 0} tablet={tablet} reflow={reflow} />
      ))}
    </Section>
  );
  const logoutButton = (
    // ⚠P-4: no confirmation.
    <Pressable
      testID="settings-sign-out"
      accessibilityRole="button"
      onPress={() => logout()}
      style={[styles.logout, tablet && styles.logoutTablet]}
    >
      {({ pressed }) => (
        <>
          {pressed ? <View testID="settings-sign-out-pressed" pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pressOverlay]} /> : null}
          <Text {...CAP_BODY} style={styles.logoutText}>
            Logout
          </Text>
        </>
      )}
    </Pressable>
  );
  const modal = <ChangePasswordModal visible={changePasswordVisible} onClose={() => setChangePasswordVisible(false)} email={email} />;

  if (tablet) {
    return (
      <View testID="settings-tablet" style={[styles.tabletGrid, reflow && styles.tabletGridStacked]}>
        <View style={[styles.tabletLeft, reflow && styles.tabletLeftStacked]}>
          <View testID="settings-identity" style={styles.hero}>
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <GradientFill angle={gradients.card.angle} colors={gradients.card.colors} />
            </View>
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <GradientFill radial={HERO_GLOW.radial} colors={HERO_GLOW.colors} stops={HERO_GLOW.stops} />
            </View>
            <ProfileAvatar initials={profileInitials(displayName)} size={120} testID="settings-avatar" />
            <View style={styles.heroText}>
              {name}
              {emailLine}
            </View>
            {manage}
            <ProfileStatTiles profile={profile} inCard />
          </View>
          <CoachingCard layout="row" />
        </View>
        <View style={styles.tabletRight}>
          {account}
          {workout}
          {logoutButton}
          {/* P1.3 item 5 / P1b (T-43): 32 below Logout (the 18 gap + 14). */}
          <DeleteAccountAction align="start" style={styles.deleteAccountTablet} />
        </View>
        {modal}
      </View>
    );
  }

  return (
    <View style={styles.column}>
      <View testID="settings-identity" style={styles.identity}>
        <ProfileAvatar initials={profileInitials(displayName)} size={84} testID="settings-avatar" />
        <View style={styles.identityText}>
          {name}
          {emailLine}
        </View>
        {manage}
      </View>

      <ProfileStatTiles profile={profile} />

      <View testID="settings-pair" style={[styles.pair, reflow && styles.pairStacked]}>
        <CoachingCard layout="pair" />
        <Pressable
          testID="settings-row-weight"
          accessibilityRole="button"
          accessibilityLabel={`${weightRow.label}, ${weightRow.value}`}
          onPress={openWeight}
          style={styles.weightCard}
        >
          {({ pressed }) => (
            <>
              {pressed ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pressOverlay]} /> : null}
              <Text {...CAP_BODY} style={styles.weightTitle}>
                {weightRow.label}
              </Text>
              <Text {...CAP_BODY} style={styles.weightSub}>
                {weightRow.value}
              </Text>
            </>
          )}
        </Pressable>
      </View>

      {account}
      {workout}
      {logoutButton}

      {/* P1.3 item 5 / P1b (T-43): 32 below Logout (the 14 gap + 18). */}
      <DeleteAccountAction style={styles.deleteAccount} />

      {modal}
    </View>
  );
}

const MANAGE_SLOP = { top: 4, bottom: 4 };

function Section({ title, tablet, children }) {
  return (
    <View style={tablet ? styles.sectionTablet : styles.section}>
      <Text {...CAP_BODY} accessibilityRole="header" style={styles.sectionHeading}>
        {title}
      </Text>
      <View style={styles.list}>{children}</View>
    </View>
  );
}

function IconTile({ icon, tint, tablet }) {
  const tone = TILE_TONES[tint] ?? TILE_TONES.neutral;
  return (
    <View
      style={[styles.tile, tablet && styles.tileTablet, { backgroundColor: tone.fill }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <ProfileIcon name={icon} size={tablet ? 18 : 17} color={tone.ink} />
    </View>
  );
}

const TILE_TONES = {
  neutral: { fill: colors.fillGlass, ink: colors.textPrimary },
  gold: { fill: colors.goldTint, ink: colors.gold },
  teal: { fill: colors.tealTint, ink: colors.teal },
};

function ListRow({ row, first, tablet, reflow }) {
  const rowStyle = [styles.row, tablet && styles.rowTablet, !first && styles.rowDivider];
  const text = (
    <View style={styles.rowText}>
      <Text {...CAP_BODY} style={styles.rowLabel}>
        {row.label}
      </Text>
      <Text {...CAP_BODY} numberOfLines={row.plain || reflow ? undefined : 1} style={[styles.rowValue, tablet && styles.rowValueTablet, row.plain && styles.plainValue]}>
        {row.value}
      </Text>
    </View>
  );
  if (row.plain) {
    // Not interactive: no chevron, no pressed state, no tab stop.
    return (
      <View testID={row.testID} accessible accessibilityRole="text" accessibilityLabel={`${row.label}, ${row.value}`} style={rowStyle}>
        <IconTile icon={row.icon} tint={row.tint} tablet={tablet} />
        {text}
      </View>
    );
  }
  return (
    <Pressable
      testID={row.testID ?? `settings-row-${row.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${row.label}, ${row.value}`}
      onPress={row.onPress}
      style={rowStyle}
    >
      {({ pressed }) => (
        <>
          {pressed ? <View testID={`${row.testID ?? `settings-row-${row.id}`}-pressed`} pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pressOverlay]} /> : null}
          <IconTile icon={row.icon} tint={row.tint} tablet={tablet} />
          {text}
          <ProfileIcon name="chevron" size={16} color={colors.textDisabled} />
        </>
      )}
    </Pressable>
  );
}

function SwitchRow({ row, first, tablet, reflow }) {
  return (
    <Pressable
      testID={row.testID}
      accessibilityRole="switch"
      accessibilityLabel={row.label}
      accessibilityHint={row.hint}
      accessibilityState={{ checked: row.value }}
      onPress={() => {
        row.onChange(!row.value);
      }}
      style={[styles.row, styles.switchRow, tablet && styles.rowTablet, !first && styles.rowDivider]}
    >
      {({ pressed }) => (
        <>
          {pressed ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pressOverlay]} /> : null}
          {tablet ? null : <IconTile icon={row.icon} tint={row.tint} />}
          <View style={styles.rowText}>
            <Text {...CAP_BODY} style={styles.rowLabel}>
              {row.label}
            </Text>
            <Text {...CAP_BODY} numberOfLines={reflow ? undefined : 1} style={[styles.rowValue, tablet && styles.rowValueTablet]}>
              {row.hint}
            </Text>
          </View>
          <Switch
            testID={`${row.testID}-switch`}
            value={row.value}
            onValueChange={row.onChange}
            // v2 §4.7: the gold track (no ✓ in the thumb); the thumb is set
            // in both states, since Android's default ON thumb is an
            // off-palette teal.
            trackColor={SWITCH_TRACK}
            thumbColor={row.value ? colors.ground : colors.textPrimary}
            ios_backgroundColor={colors.switchTrackOff}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Phone column: gap 14 (the shell already pads the sides and the tab bar).
  column: {
    gap: spacing['3_5'],
    paddingBottom: spacing[6],
  },
  // Identity: centred, gap 10, padding 6 0 4.
  identity: {
    alignItems: 'center',
    gap: spacing['2_5'],
    paddingTop: spacing['1_5'],
    paddingBottom: spacing[1],
  },
  identityText: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  // Name 26/30/700 −0.03em (phone), wraps to 2+ lines by word.
  displayName: {
    ...font(700),
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.78,
    textAlign: 'center',
    color: colors.textPrimary,
  },
  // Tablet: title-lg 30, the board's 34 line.
  displayNameTablet: {
    ...typography.titleLg,
    lineHeight: 34,
  },
  email: {
    ...typography.bodySm,
    marginTop: spacing[1],
    textAlign: 'center',
    color: colors.textMuted,
  },
  // Manage: glass pill 36 tall (44 hit), padding 0 16, 14/600.
  manage: {
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.fillGlass,
    paddingHorizontal: spacing[4],
    overflow: 'hidden',
  },
  // Tablet: stretched, 48 tall, 15/600.
  manageTablet: {
    alignSelf: 'stretch',
    minHeight: 48,
  },
  manageText: {
    ...typography.bodySm,
    ...font(600),
    textAlign: 'center',
    color: colors.textPrimary,
  },
  manageTextTablet: {
    ...typography.body,
    ...font(600),
  },
  // UX §8.6 STATE RULE: the rest colour + a 4 % white overlay.
  pressOverlay: {
    backgroundColor: colors.pressOverlay,
  },
  // Coaching · Add weight: 2 columns, gap 8; one column past 1.3× (§9).
  pair: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  pairStacked: {
    flexDirection: 'column',
  },
  weightCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.goldLine,
    backgroundColor: colors.surface,
    padding: spacing['3_5'],
    overflow: 'hidden',
  },
  weightTitle: {
    ...typography.body,
    ...font(600),
    color: colors.gold,
  },
  weightSub: {
    ...typography.caption,
    marginTop: 3,
    color: colors.textMuted,
  },
  // "Account" / "Workout": 13/600 muted, margin 6 4 0; the column's gap 14
  // sits between the label and its card.
  section: {
    gap: spacing['3_5'],
    marginTop: spacing['1_5'],
  },
  sectionTablet: {
    gap: spacing['2_5'],
  },
  sectionHeading: {
    ...typography.label,
    ...font(600),
    marginHorizontal: spacing[1],
    color: colors.textMuted,
  },
  list: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  // Rows: min 56, padding 10 16, gap 12 (switch rows 60); tablet min 64,
  // padding 10 18.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: 56,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing['2_5'],
  },
  switchRow: {
    minHeight: 60,
  },
  rowTablet: {
    minHeight: 64,
    paddingHorizontal: spacing['4_5'],
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  // Icon tile 34 (tablet 36); the drawn radius 10/11 has no token → sm 12.
  tile: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTablet: {
    width: 36,
    height: 36,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowLabel: {
    ...typography.body,
    ...font(600),
    color: colors.textPrimary,
  },
  rowValue: {
    ...typography.caption,
    marginTop: spacing['0_5'],
    color: colors.textMuted,
  },
  rowValueTablet: {
    ...typography.label,
    ...font(400),
  },
  // Variant B (Google-only): 12/17 muted, wraps (one row system).
  plainValue: {
    lineHeight: 17,
  },
  // Logout: danger-ghost pill 52, danger-line edge, danger-faint fill,
  // 15/600 danger-text.
  logout: {
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.dangerLine,
    backgroundColor: colors.dangerFaint,
    paddingHorizontal: spacing[6],
    overflow: 'hidden',
  },
  // Tablet: auto width, left-aligned, padding 0 28.
  logoutTablet: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[7],
  },
  logoutText: {
    ...typography.body,
    ...font(600),
    textAlign: 'center',
    color: colors.dangerText,
  },
  deleteAccount: {
    paddingTop: spacing['4_5'],
  },
  deleteAccountTablet: {
    paddingTop: spacing['3_5'],
  },
  // Tablet: grid 300 | 1fr, gap 20, top-aligned; past 1.3× one column.
  tabletGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[5],
    paddingBottom: spacing[6],
  },
  tabletGridStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  tabletLeft: {
    width: 300,
    gap: spacing[4],
  },
  tabletLeftStacked: {
    width: '100%',
  },
  tabletRight: {
    flex: 1,
    minWidth: 0,
    gap: spacing['4_5'],
  },
  // Identity hero: radius 32, padding 30 24 24, gradient-card + the gold
  // orb glow at the top, hairline-strong edge, centred, gap 16.
  hero: {
    alignItems: 'center',
    gap: spacing[4],
    borderRadius: radii.xxxl,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    paddingTop: 30,
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[6],
    overflow: 'hidden',
  },
  heroText: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
});
