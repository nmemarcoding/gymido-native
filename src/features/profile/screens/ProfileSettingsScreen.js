import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { routes } from '../../../navigation/routes';
import EmptyState from '../../../shared/components/EmptyState';
import { InlineError } from '../../../shared/components/FeedbackBox';
import Loader from '../../../shared/components/Loader';
import { colors, radii, shadows } from '../../../shared/theme/tokens';
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
import { profileDisplayName, profileInitials } from '../editProfileForm';
import { ProfileStatus, fetchProfile, useProfileStore } from '../profileStore';

// RN-SPEC-profile P1 (Settings), the Profile tab root. Renders from the shared
// profile store; it fetches only while the store is idle (⚠P-1).
export default function ProfileSettingsScreen() {
  return (
    <ShellPage>
      <Settings />
    </ShellPage>
  );
}

const SWITCH_TRACK = { false: colors.border, true: colors.brand400 };

function Settings() {
  const navigation = useNavigation();
  const profile = useProfileStore((state) => state.profile);
  const profileStatus = useProfileStore((state) => state.profileStatus);
  const profileError = useProfileStore((state) => state.profileError);
  const email = useAuthStore((state) => state.user?.email);
  const [changePasswordVisible, setChangePasswordVisible] = useState(false);
  const speakRestAlerts = useSpeakRestAlerts((state) => state.enabled);
  const vibrateRestAlerts = useVibrateRestAlerts((state) => state.enabled);

  useEffect(() => {
    if (useProfileStore.getState().profileStatus === ProfileStatus.idle) {
      fetchProfile();
    }
  }, []);

  if (profileStatus === ProfileStatus.loading || profileStatus === ProfileStatus.idle) {
    return <Loader label="Loading settings" />;
  }
  if (profileStatus === ProfileStatus.error) {
    return <InlineError testID="settings-error" message={profileError?.message || 'Failed to load profile'} />;
  }
  if (profileStatus === ProfileStatus.missing || !profile) {
    return (
      <EmptyState
        title="No profile yet"
        message="Create your profile to unlock settings."
        actionLabel="Create profile"
        actionTestID="settings-create-profile"
        onAction={() => navigation.navigate(routes.Onboarding)}
      />
    );
  }

  const displayName = profileDisplayName(profile, email);
  const openEdit = () => navigation.push(routes.EditProfile);
  // RN-SPEC-profile P1.3 3b (23 Oct 2026, native only): the rest-end cues.
  const workoutSwitches = [
    {
      id: 'speak',
      testID: 'settings-speak-rest-alerts',
      glyph: '♪',
      label: 'Speak rest alerts',
      hint: 'Say when rest is over',
      value: speakRestAlerts,
      onChange: setSpeakRestAlerts,
    },
    {
      id: 'vibrate',
      testID: 'settings-vibrate-rest-alerts',
      glyph: '≋',
      label: 'Vibrate on rest end',
      hint: 'Buzz when rest is over',
      value: vibrateRestAlerts,
      onChange: setVibrateRestAlerts,
    },
  ];
  const rows = [
    { glyph: '▣', label: 'Personal Information', value: 'Name, DOB, sex', onPress: openEdit, id: 'personal' },
    { glyph: '▭', label: 'Body Measurements', value: 'Height, current, goal', onPress: openEdit, id: 'body' },
    { glyph: '◖', label: 'Units of Measurement', value: 'Height + weight units', onPress: openEdit, id: 'units' },
    {
      glyph: '◈',
      label: 'Change Password',
      value: 'Update your login password',
      onPress: () => setChangePasswordVisible(true),
      id: 'password',
      testID: 'settings-change-password',
    },
    // ⚠P-3: switches to Progress; it doesn't open the weight modal.
    { glyph: '+', label: 'Add weight log manually', value: 'Track your weight trend', onPress: () => openShellPath('/progress'), id: 'weight' },
  ];

  return (
    <View style={styles.column}>
      <View style={styles.identity}>
        <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text numberOfLines={1} textBreakStrategy="simple" style={styles.initials}>{profileInitials(displayName)}</Text>
        </View>
        <View style={styles.identityText}>
          <Text textBreakStrategy="simple" testID="settings-display-name" numberOfLines={2} style={styles.displayName}>
            {displayName}
          </Text>
          <Text numberOfLines={1} style={styles.email}>
            {email || 'Personal information'}
          </Text>
        </View>
        <Pressable
          testID="settings-manage"
          accessibilityRole="button"
          onPress={openEdit}
          style={({ pressed }) => [styles.manage, pressed && styles.managePressed]}
        >
          <Text style={styles.manageText}>Manage</Text>
        </Pressable>
      </View>

      <CoachingCard />

      <View>
        <Text accessibilityRole="header" style={styles.sectionHeading}>
          Account
        </Text>
        <View style={styles.list}>
          {rows.map((row, index) => (
            <Pressable
              key={row.id}
              testID={row.testID ?? `settings-row-${row.id}`}
              accessibilityRole="button"
              accessibilityLabel={`${row.label}, ${row.value}`}
              onPress={row.onPress}
              style={({ pressed }) => [styles.row, index > 0 && styles.rowDivider, pressed && styles.rowPressed]}
            >
              <View style={styles.tile} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Text style={styles.glyph}>{row.glyph}</Text>
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text numberOfLines={1} style={styles.rowValue}>
                  {row.value}
                </Text>
              </View>
              <Text style={styles.chevron} accessibilityElementsHidden importantForAccessibility="no">
                ›
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* RN-SPEC-profile P1.3 3b (23 Oct 2026, native only): the spoken rest cue. */}
      <View>
        <Text accessibilityRole="header" style={styles.sectionHeading}>
          Workout
        </Text>
        <View style={styles.list}>
          {workoutSwitches.map((row, index) => (
            <Pressable
              key={row.id}
              testID={row.testID}
              accessibilityRole="switch"
              accessibilityLabel={row.label}
              accessibilityHint={row.hint}
              accessibilityState={{ checked: row.value }}
              onPress={() => {
                row.onChange(!row.value);
              }}
              style={({ pressed }) => [styles.row, index > 0 && styles.rowDivider, pressed && styles.rowPressed]}
            >
              <View style={styles.tile} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Text style={styles.glyph}>{row.glyph}</Text>
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text numberOfLines={1} style={styles.rowValue}>
                  {row.hint}
                </Text>
              </View>
              <Switch
                testID={`${row.testID}-switch`}
                value={row.value}
                onValueChange={row.onChange}
                // Design system v1 #17: the gold track (no ✓ in the thumb).
                trackColor={SWITCH_TRACK}
                ios_backgroundColor={colors.border}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              />
            </Pressable>
          ))}
        </View>
      </View>

      {/* ⚠P-4: no confirmation. */}
      <Pressable
        testID="settings-sign-out"
        accessibilityRole="button"
        onPress={() => logout()}
        style={({ pressed }) => [styles.logout, pressed && styles.logoutPressed]}
      >
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>

      <ChangePasswordModal visible={changePasswordVisible} onClose={() => setChangePasswordVisible(false)} />
    </View>
  );
}

const card = {
  borderRadius: radii.xxxl,
  borderWidth: 1,
  borderColor: colors.border,
  backgroundColor: colors.surface,
  boxShadow: shadows.soft,
};

const styles = StyleSheet.create({
  column: {
    gap: 20,
    paddingBottom: 24,
  },
  identity: {
    ...card,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand50,
  },
  initials: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '900',
    color: colors.brand700,
  },
  identityText: {
    flex: 1,
    minWidth: 0,
  },
  displayName: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  email: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  manage: {
    flexShrink: 0,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  managePressed: {
    backgroundColor: colors.surfaceMuted,
  },
  manageText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sectionHeading: {
    marginBottom: 12,
    paddingHorizontal: 4,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  list: {
    ...card,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowPressed: {
    backgroundColor: colors.rowPressedStrong,
  },
  tile: {
    width: 40,
    height: 40,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  glyph: {
    fontSize: 18,
    lineHeight: 22,
    color: colors.brand700,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  rowValue: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  chevron: {
    fontSize: 18,
    lineHeight: 24,
    color: colors.textMuted,
  },
  logout: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoutPressed: {
    backgroundColor: colors.errorFill,
  },
  logoutText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    color: colors.danger700,
  },
});
