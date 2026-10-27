import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CAP_BODY } from '../../shared/components/largeText';
import { colors, font, radii, spacing, typography } from '../../shared/theme/tokens';
import { signOutDeletedAccount } from '../auth/authService';
import { useAuthStore } from '../auth/authStore';
import { hasGymidoPassword } from './passwordReset';
import { isAdminUser, isTrainerUser } from '../shell/shellRules';
import DeleteAccountDialog from './DeleteAccountDialog';

// RN-SPEC-profile P1b.1–P1b.2 (T-43, 26 Oct 2026): the "Delete account" text
// button + subline that opens the dialog. Hidden for admins. `profileLess` is
// the Create-profile variant (P1b.4); `disabled` while that form submits.
// v2 (UX K shared facts): a danger TEXT button (never filled or bordered),
// pressed = danger-faint (§8.6a 5), disabled 0.5; `align="start"` is the
// tablet Profile's left-aligned block under Logout (default centred).
export default function DeleteAccountAction({ profileLess = false, disabled = false, style, align = 'center' }) {
  const user = useAuthStore((state) => state.user);
  const googleOnly = useAuthStore((state) => !hasGymidoPassword(state.claims?.sub));
  const [open, setOpen] = useState(false);

  if (isAdminUser(user)) {
    return null;
  }

  return (
    <View testID="delete-account-action" style={[styles.column, align === 'start' && styles.columnStart, style]}>
      <Pressable
        testID="delete-account-open"
        accessibilityRole="button"
        accessibilityHint="Opens a confirmation. This can't be undone."
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.button, pressed && !disabled && styles.buttonPressed, disabled && styles.disabled]}
      >
        <Text {...CAP_BODY} style={styles.buttonText}>
          Delete account
        </Text>
      </Pressable>
      {/* Max 2 lines as drawn; at large text it wraps freely (UX §9 rule 2). */}
      <Text {...CAP_BODY} style={[styles.subline, align === 'start' && styles.sublineStart]}>
        {profileLess ? "Don't want to continue? Permanently erase your sign-in." : 'Permanently erase your account and all your data.'}
      </Text>
      <DeleteAccountDialog
        isOpen={open}
        onClose={() => setOpen(false)}
        onDeleted={() => signOutDeletedAccount()}
        profileLess={profileLess}
        isTrainer={isTrainerUser(user)}
        googleOnly={googleOnly}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    alignItems: 'center',
    gap: spacing[1],
  },
  columnStart: {
    alignItems: 'flex-start',
  },
  // min 44 × 44, padding 12 16, radius-full.
  button: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    borderRadius: radii.full,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  buttonPressed: {
    backgroundColor: colors.dangerFaint,
  },
  disabled: {
    opacity: 0.5,
  },
  buttonText: {
    ...typography.bodySm,
    ...font(600),
    textAlign: 'center',
    color: colors.dangerText,
  },
  subline: {
    ...typography.caption,
    textAlign: 'center',
    color: colors.textMuted,
  },
  sublineStart: {
    textAlign: 'left',
    paddingHorizontal: spacing[4],
  },
});
