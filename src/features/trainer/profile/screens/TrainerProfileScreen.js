import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import ErrorAlert from '../../../../shared/components/ErrorAlert';
import FeedbackIcon from '../../../../shared/components/FeedbackIcon';
import FormField from '../../../../shared/components/FormField';
import GradientFill from '../../../../shared/components/GradientFill';
import { CAP_BODY, DISPLAY_TITLE_TEXT, useLargeTextReflow } from '../../../../shared/components/largeText';
import PillButton from '../../../../shared/components/PillButton';
import { ToastTone, addToast } from '../../../../shared/components/toastStore';
import { useFocusRemountKey } from '../../../../shared/hooks/useFocusRemountKey';
import { breakpoints, colors, font, gradients, radii, spacing, textScale, typography } from '../../../../shared/theme/tokens';
import { useAuthStore } from '../../../auth/authStore';
import { logout } from '../../../auth/authService';
import { useProfileStore } from '../../../profile/profileStore';
import ShellPage from '../../../shell/ShellPage';
import TrainerOnly from '../../TrainerOnly';
import { CoachingChip } from '../../plans/components/TrainerChips';
import { updateTrainerProfile } from '../api/trainerProfileApi';
import {
  BIO_MAX_LENGTH,
  BIO_ROWS,
  DISPLAY_NAME_MAX_LENGTH,
  SAVED_TOAST_MESSAGE,
  SAVED_TOAST_TITLE,
  buildTrainerProfilePayload,
  initialTrainerProfileValues,
  ownInitials,
  trainerProfileSaveError,
} from '../trainerProfileForm';
import { HeroTitleMark } from '../../../shell/heroTitle';

const NO_AUTOFILL = { autoComplete: 'off', textContentType: 'none', importantForAutofill: 'no' };

// Teal page washes (UX O): phone 100 % 40 % at 90 % −5 %, tablet 70 % 38 % at
// 85 % −6 %, the §8.5 teal ambient (0.18; the boards' 0.14 / 0.18 fold on it).
export const PROFILE_GLOW = Object.freeze({
  radial: Object.freeze({ cx: 0.9, cy: -0.05, rx: 1, ry: 0.4 }),
  colors: gradients.tealAmbient.colors,
  stops: gradients.tealAmbient.stops,
});
export const TABLET_PROFILE_GLOW = Object.freeze({
  radial: Object.freeze({ cx: 0.85, cy: -0.06, rx: 0.7, ry: 0.38 }),
  colors: gradients.tealAmbient.colors,
  stops: gradients.tealAmbient.stops,
});
export const HERO_GLOW_SIZE = 220;
export const CARD_GLOW_SIZE = 260;
export const AVATAR_PHONE = 72;
export const AVATAR_TABLET = 96;
// Initials sit in fixed-size chrome: capped like a badge.
const BADGE_TEXT = Object.freeze({ maxFontSizeMultiplier: textScale.badge });

// RN-SPEC-trainer-profile TP1 (`/trainer/profile`, the TProfile tab root).
// ⚠TP-1: no load; every focus remounts the form blank, as the web route does.
// v2 Phase 6 O (TrainerProfile / TabletTrainerProfile / TrainerProfileEdit):
// the Coaching chip, the own-initials avatar hero (ruling 6), the form card
// with the discoverable notice, inline Save (ruling 7; no sticky bar), the
// save error at the top of the form, and T-44 Logout last. No Back arrow
// (code). The Workspace switch stays where the shell draws it (report).
export default function TrainerProfileScreen() {
  const remountKey = useFocusRemountKey();
  const { width } = useWindowDimensions();
  const tablet = width >= breakpoints.md;
  return (
    <TrainerOnly>
      <ShellPage testID="trainer-profile-screen" glow={tablet ? TABLET_PROFILE_GLOW : PROFILE_GLOW}>
        <TrainerProfileForm key={remountKey} tablet={tablet} />
      </ShellPage>
    </TrainerOnly>
  );
}

function OwnAvatar({ size, radius }) {
  const profile = useProfileStore((state) => state.profile);
  const email = useAuthStore((state) => state.user?.email);
  return (
    // The shadow sits on an unclipped wrapper; the gradient is clipped inside.
    <View
      testID="trainer-profile-avatar"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: radius }}
    >
      <View style={[styles.avatarClip, { borderRadius: radius }]}>
        <GradientFill angle={gradients.goldAvatar.angle} colors={gradients.goldAvatar.colors} />
        <Text {...BADGE_TEXT} style={[styles.initials, size >= AVATAR_TABLET && styles.initialsTablet]}>
          {ownInitials(profile, email)}
        </Text>
      </View>
    </View>
  );
}

function CornerGlow({ size, spec, testID }) {
  return (
    <View testID={testID} pointerEvents="none" style={[styles.cornerGlow, { width: size, height: size, top: -size / 2, right: -size / 2 }]}>
      <GradientFill radial={spec.radial} colors={spec.colors} stops={spec.stops} />
    </View>
  );
}

const NOTICE = 'Saving this makes you discoverable under Find a trainer. Members see your name and bio there.';

function Notice({ tablet }) {
  return (
    <View testID="trainer-profile-notice" style={tablet ? styles.noticeTablet : styles.notice}>
      <FeedbackIcon name="info" size={16} color={colors.teal} />
      <Text {...CAP_BODY} style={[styles.noticeText, tablet && styles.noticeTextTablet]}>
        {NOTICE}
      </Text>
    </View>
  );
}

function TrainerProfileForm({ tablet }) {
  const reflow = useLargeTextReflow();
  const [values, setValues] = useState(initialTrainerProfileValues);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  // Guards a second press landing before `saving` re-renders.
  const savingRef = useRef(false);

  const setField = (key) => (text) => {
    setValues((current) => ({ ...current, [key]: text }));
    setSaved(false);
  };

  async function submit() {
    if (savingRef.current) {
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      await updateTrainerProfile(buildTrainerProfilePayload(values));
      setSaved(true);
      // ⚠TP-4: "Saved." and the toast both show.
      addToast(ToastTone.success, SAVED_TOAST_TITLE, SAVED_TOAST_MESSAGE);
    } catch (failure) {
      setError(trainerProfileSaveError(failure));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const title = (
    <>
      <HeroTitleMark />
      <Text {...DISPLAY_TITLE_TEXT} accessibilityRole="header" style={tablet ? styles.titleTablet : styles.title}>
        Trainer profile
      </Text>
    </>
  );
  const subtitle = (
    <Text {...CAP_BODY} style={tablet ? styles.subtitleTablet : styles.subtitle}>
      How you appear to members browsing for a trainer.
    </Text>
  );

  return (
    <View testID="trainer-profile-column" style={[styles.column, tablet && styles.columnTablet]}>
      <CoachingChip testID="trainer-profile-eyebrow" />
      {tablet ? (
        <View testID="trainer-profile-hero" style={[styles.titleRow, reflow && styles.titleRowStacked]}>
          <OwnAvatar size={AVATAR_TABLET} radius={AVATAR_TABLET / 2} />
          <View style={styles.titleBlock}>
            {title}
            {subtitle}
          </View>
        </View>
      ) : (
        <View testID="trainer-profile-hero" style={styles.hero}>
          <GradientFill angle={gradients.card.angle} colors={gradients.card.colors} />
          <CornerGlow testID="trainer-profile-hero-glow" size={HERO_GLOW_SIZE} spec={gradients.tealOrb} />
          <OwnAvatar size={AVATAR_PHONE} radius={radii.xl} />
          {title}
          {subtitle}
        </View>
      )}
      {tablet ? <Notice tablet /> : null}

      <View testID="trainer-profile-card" style={[styles.card, tablet && styles.cardTablet]}>
        {tablet ? (
          <>
            <GradientFill angle={gradients.card.angle} colors={gradients.card.colors} />
            <CornerGlow testID="trainer-profile-card-glow" size={CARD_GLOW_SIZE} spec={gradients.cardCornerGlow} />
          </>
        ) : null}
        {tablet ? null : <Notice />}
        {error ? (
          // TrainerProfileEdit: the save-error state of this same form.
          <View testID="trainer-profile-error">
            <ErrorAlert title="Could not save" description={error} />
          </View>
        ) : null}
        <FormField
          testID="trainer-profile-display-name"
          label="Display name"
          placeholder="Coach K"
          helperText="Shown instead of your email."
          value={values.display_name}
          onChangeText={setField('display_name')}
          maxLength={DISPLAY_NAME_MAX_LENGTH}
          editable={!saving}
          returnKeyType="go"
          onSubmitEditing={submit}
          {...NO_AUTOFILL}
        />
        <FormField
          testID="trainer-profile-bio"
          label="Bio"
          placeholder="What you coach, and how you work with clients."
          value={values.bio}
          onChangeText={setField('bio')}
          maxLength={BIO_MAX_LENGTH}
          multiline
          rows={BIO_ROWS}
          numberOfLines={BIO_ROWS}
          editable={!saving}
          {...NO_AUTOFILL}
        />
        <View testID="trainer-profile-actions" style={[styles.actions, tablet && styles.actionsTablet, reflow && styles.actionsStacked]}>
          <PillButton
            testID="trainer-profile-save"
            title="Save profile"
            loading={saving}
            size={tablet ? 'cta' : 'default'}
            onPress={submit}
            style={reflow ? styles.saveStacked : tablet ? styles.saveTablet : styles.savePhone}
          />
          {saved ? (
            <View
              testID="trainer-profile-saved-status"
              accessibilityRole="text"
              accessibilityLiveRegion="polite"
              style={tablet ? styles.savedChip : styles.savedRow}
            >
              <FeedbackIcon name="check" size={14} color={colors.success} />
              <Text testID="trainer-profile-saved" {...CAP_BODY} style={styles.saved}>
                Saved.
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* T-44: personal Profile's P1 #4 Logout, so trainer mode can sign out.
          No confirmation (⚠P-4); it stays enabled while saving. Phase 5 K
          look: the danger-tint pill (full width on phones, auto on tablets). */}
      <Pressable
        testID="trainer-profile-sign-out"
        accessibilityRole="button"
        accessibilityLabel="Logout"
        onPress={() => logout()}
        style={[styles.logout, tablet && !reflow && styles.logoutTablet]}
      >
        {({ pressed }) => (
          <>
            {pressed ? <View testID="trainer-profile-sign-out-pressed" pointerEvents="none" style={[StyleSheet.absoluteFill, styles.logoutPressed]} /> : null}
            <Text {...CAP_BODY} style={styles.logoutText}>
              Logout
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    width: '100%',
    maxWidth: 672,
    alignSelf: 'center',
    gap: spacing['3_5'],
    paddingBottom: spacing[6],
  },
  columnTablet: {
    maxWidth: 620,
    gap: spacing['4_5'],
  },
  // Phone hero: radius 28, padding 22, gradient-card, a 220 teal orb at the
  // top-right corner. The radius never changes, so it clips safely.
  hero: {
    overflow: 'hidden',
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.choiceBorder,
    padding: spacing['5_5'],
  },
  cornerGlow: {
    position: 'absolute',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[5],
  },
  titleRowStacked: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  titleBlock: {
    flexShrink: 1,
    minWidth: 0,
  },
  avatarClip: {
    flex: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    ...font(700),
    fontSize: 26,
    lineHeight: 31,
    color: colors.onGold,
    textAlign: 'center',
  },
  initialsTablet: {
    fontSize: 34,
    lineHeight: 40,
  },
  // title-xl (board 40/40 −0.045em).
  title: {
    ...typography.titleXl,
    marginTop: spacing[4],
    color: colors.textPrimary,
  },
  // display-lg 52/52 (board 52/54 −0.055em).
  titleTablet: {
    ...typography.displayLg,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.bodySm,
    marginTop: spacing['2_5'],
    color: colors.textSecondary,
  },
  // Board 17: body-lg 16/24 is the nearest step.
  subtitleTablet: {
    ...typography.bodyLg,
    marginTop: spacing[2],
    color: colors.textSecondary,
  },
  // Phone notice: teal 8 % tint box, padding 12, radius 16, 13/19 strong-2.
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing['2_5'],
    padding: spacing[3],
    borderRadius: radii.md,
    backgroundColor: colors.tealFaint,
  },
  // Tablet notice: a bordered teal card, padding 16 18, radius 22, light teal
  // text (board teal 10 % + 22 % edge → the ladder's faint 8 % + line 30 %).
  noticeTablet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    paddingVertical: spacing[4],
    paddingHorizontal: spacing['4_5'],
    borderRadius: radii.lgPlus,
    borderWidth: 1,
    borderColor: colors.tealLine,
    backgroundColor: colors.tealFaint,
  },
  noticeText: {
    ...typography.label,
    ...font(400),
    lineHeight: 19,
    flexShrink: 1,
    color: colors.textStrong2,
  },
  noticeTextTablet: {
    ...typography.bodySm,
    lineHeight: 21,
    color: colors.tealText,
  },
  // Phone form card: padding 18, radius 28, surface, hairline, gap 14.
  card: {
    gap: spacing['3_5'],
    padding: spacing['4_5'],
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  // Tablet: radius 32, padding 30, gradient-card + a 260 gold corner glow.
  cardTablet: {
    overflow: 'hidden',
    gap: spacing[5],
    padding: 30,
    borderRadius: radii.xxxl,
    borderColor: colors.choiceBorder,
    backgroundColor: undefined,
  },
  actions: {
    marginTop: spacing['0_5'],
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing[3],
  },
  actionsTablet: {
    gap: spacing[4],
  },
  actionsStacked: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  savePhone: {
    minHeight: 54,
    paddingHorizontal: spacing[7],
  },
  saveTablet: {
    paddingHorizontal: 36,
  },
  saveStacked: {
    alignSelf: 'stretch',
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['1_5'],
  },
  // Tablet "Saved." chip: 36 tall, pill, success (green, brief) tint.
  savedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['1_5'],
    minHeight: 36,
    paddingHorizontal: spacing['3_5'],
    borderRadius: radii.full,
    backgroundColor: colors.successTint,
  },
  saved: {
    ...typography.bodySm,
    ...font(600),
    color: colors.success,
  },
  // Phase 5 K Logout: 52 tall pill, danger-faint fill, danger-line edge.
  logout: {
    marginTop: spacing['2_5'],
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[7],
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.dangerLine,
    backgroundColor: colors.dangerFaint,
  },
  logoutTablet: {
    alignSelf: 'flex-start',
  },
  logoutPressed: {
    borderRadius: radii.full,
    backgroundColor: colors.pressOverlay,
  },
  logoutText: {
    ...font(600),
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
    color: colors.dangerText,
  },
});
