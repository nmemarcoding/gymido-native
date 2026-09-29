import { useState } from 'react';

import Button from '../../shared/components/Button';
import Card from '../../shared/components/Card';
import { Body, Eyebrow, Heading } from '../../shared/components/Typography';
import { logout } from '../auth/authService';
import ChangePasswordModal from '../profile/ChangePasswordModal';

// The account actions from the Login & Sign Up spec (change password, sign
// out). Placeholder home until the Settings/Profile spec arrives.
export default function AccountActionsCard() {
  const [changePasswordVisible, setChangePasswordVisible] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <>
      <Card>
        <Eyebrow>Placeholder</Eyebrow>
        <Heading>Settings</Heading>
        <Body>Only the account actions from the Login & Sign Up spec live here for now.</Body>
        <Button
          testID="settings-change-password"
          title="Change password"
          onPress={() => setChangePasswordVisible(true)}
        />
        <Button
          testID="settings-sign-out"
          title="Sign out"
          variant="secondary"
          loading={signingOut}
          onPress={handleSignOut}
        />
      </Card>
      <ChangePasswordModal visible={changePasswordVisible} onClose={() => setChangePasswordVisible(false)} />
    </>
  );
}
