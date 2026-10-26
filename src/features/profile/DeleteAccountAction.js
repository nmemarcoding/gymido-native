import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '../../shared/theme/tokens';
import { signOutDeletedAccount } from '../auth/authService';
import { useAuthStore } from '../auth/authStore';
import { hasGymidoPassword } from './passwordReset';
import { isAdminUser, isTrainerUser } from '../shell/shellRules';
import DeleteAccountDialog from './DeleteAccountDialog';

// RN-SPEC-profile P1b.1–P1b.2 (T-43, 26 Oct 2026): the "Delete account" text
// button + subline that opens the dialog. Hidden for admins. `profileLess` is
// the Create-profile variant (P1b.4); `disabled` while that form submits.
export default function DeleteAccountAction({ profileLess = false, disabled = false, style }) {
  const user = useAuthStore((state) => state.user);
  const googleOnly = useAuthStore((state) => !hasGymidoPassword(state.claims?.sub));
  const [open, setOpen] = useState(false);

  if (isAdminUser(user)) {
    return null;
  }

  return (
    <View testID="delete-account-action" style={[styles.column, style]}>
      <Pressable
        testID="delete-account-open"
        accessibilityRole="button"
        accessibilityHint="Opens a confirmation. This can't be undone."
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.button, pressed && !disabled && styles.buttonPressed, disabled && styles.disabled]}
      >
        <Text style={styles.buttonText}>Delete account</Text>
      </Pressable>
      <Text numberOfLines={2} style={styles.subline}>
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
    gap: 4,
  },
  button: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radii.full,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  buttonPressed: {
    backgroundColor: colors.errorFill,
  },
  disabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.danger700,
  },
  subline: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    color: colors.textMuted,
  },
});
