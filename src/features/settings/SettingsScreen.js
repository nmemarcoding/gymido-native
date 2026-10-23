import { useState } from 'react';
import { StyleSheet } from 'react-native';

import Button from '../../shared/components/Button';
import Card from '../../shared/components/Card';
import { Body, Eyebrow, Heading } from '../../shared/components/Typography';
import { logout } from '../auth/authService';
import ChangePasswordModal from '../profile/ChangePasswordModal';
import CoachingCard from '../profile/CoachingCard';
import ExerciseRowFixture from '../plans/components/ExerciseRowFixture';
import ChartFixture from '../trainer/clients/components/ChartFixture';
import ShellPage from '../shell/ShellPage';

// The Profile tab root (5-tab nav, 23 Oct). Placeholder until the Profile spec
// is built: the Coaching card plus the auth actions.
export default function SettingsScreen() {
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
    <ShellPage>
      <CoachingCard />
      <Card style={styles.card}>
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
      {/* Development-only visual check of the weight chart (renders nothing in release). */}
      <ChartFixture />
      <ExerciseRowFixture />
      <ChangePasswordModal visible={changePasswordVisible} onClose={() => setChangePasswordVisible(false)} />
    </ShellPage>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 20,
  },
});
