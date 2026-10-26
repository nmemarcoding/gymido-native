import { useEffect } from 'react';

import PillButton from '../../../shared/components/PillButton';
import Card from '../../../shared/components/Card';
import Screen from '../../../shared/components/Screen';
import { Heading } from '../../../shared/components/Typography';
import { ToastTone, addToast } from '../../../shared/components/toastStore';
import { login, signup, takeAccountDeletedNotice } from '../authService';

// RN-SPEC-profile P1b.6 (T-43, native only): the notice after Delete account.
const DELETED_NOTICE_MS = 6000;

// Signed-out entry point. Auth0 opens only when the user taps a button.
export default function WelcomeScreen() {
  useEffect(() => {
    if (takeAccountDeletedNotice()) {
      addToast(ToastTone.info, 'Your account has been deleted', 'Thanks for training with Gymido.', DELETED_NOTICE_MS);
    }
  }, []);

  return (
    <Screen>
      <Card>
        <Heading>Gymido</Heading>
        <PillButton fullWidth testID="welcome-log-in" title="Log in" onPress={login} />
        <PillButton fullWidth testID="welcome-sign-up" title="Sign up" variant="secondary" onPress={signup} />
      </Card>
    </Screen>
  );
}
