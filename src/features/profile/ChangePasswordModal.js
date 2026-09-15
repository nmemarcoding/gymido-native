import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, View } from 'react-native';

import { getApiErrorMessage } from '../../shared/api/apiError';
import Button from '../../shared/components/Button';
import TextField from '../../shared/components/TextField';
import { showToast } from '../../shared/components/toastStore';
import { Body, Heading } from '../../shared/components/Typography';
import { useReducedMotion } from '../../shared/hooks/useReducedMotion';
import { colors, shadows } from '../../shared/theme/tokens';
import { changePassword } from './api/profileApi';
import { validateChangePassword } from './validateChangePassword';

export default function ChangePasswordModal({ visible, onClose }) {
  const reducedMotion = useReducedMotion();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setPassword('');
    setConfirmPassword('');
    setError(null);
  };

  // The modal can't be dismissed while the request is in flight.
  const handleCancel = () => {
    if (saving) {
      return;
    }
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (saving) {
      return;
    }
    const validationError = validateChangePassword(password, confirmPassword);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSaving(true);
    try {
      await changePassword(password);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Failed to change password.', 'password'));
      setSaving(false);
      return;
    }
    setSaving(false);
    resetForm();
    onClose();
    showToast('Password changed', 'Your password has been updated.');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion ? 'none' : 'fade'}
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View accessibilityViewIsModal style={styles.sheet}>
          <Heading>Change password</Heading>
          <Body>Set a new password for signing in. This updates your Auth0 login.</Body>
          <TextField
            label="New password"
            helperText="At least 8 characters, meeting your login password policy."
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!saving}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
          <TextField
            label="Confirm new password"
            error={error}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!saving}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
          <View style={styles.actions}>
            <Button title="Change password" loading={saving} onPress={handleSubmit} />
            <Button title="Cancel" variant="secondary" disabled={saving} onPress={handleCancel} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(17, 24, 39, 0.4)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    gap: 16,
    boxShadow: shadows.soft,
  },
  actions: {
    gap: 12,
  },
});
