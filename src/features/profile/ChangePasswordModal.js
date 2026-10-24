import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { getApiErrorMessage } from '../../shared/api/apiError';
import AppModal from '../../shared/components/AppModal';
import PillButton from '../../shared/components/PillButton';
import TextField from '../../shared/components/TextField';
import { showToast } from '../../shared/components/toastStore';
import { changePassword } from './api/profileApi';
import { validateChangePassword } from './validateChangePassword';

export default function ChangePasswordModal({ visible, onClose }) {
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

  // Web's Modal (the same AppModal as the weight log): bottom sheet below
  // 640, black/70 scrim with blur, a divider above the footer (G-PF1).
  return (
    <AppModal
      testID="change-password-modal"
      isOpen={visible}
      onClose={handleCancel}
      size="md"
      title="Change password"
      description="Set a new password for signing in. This updates your Auth0 login."
      footer={
        // ⚠P-5: the buttons sit inline, left aligned and touching, Cancel first.
        <View style={styles.actions}>
          <PillButton
            testID="change-password-cancel"
            title="Cancel"
            variant="secondary"
            disabled={saving}
            onPress={handleCancel}
          />
          <PillButton testID="change-password-submit" title="Change password" loading={saving} onPress={handleSubmit} />
        </View>
      }
    >
      <View style={styles.body}>
        <TextField
          testID="change-password-new"
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
          testID="change-password-confirm"
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
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 16,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
});
