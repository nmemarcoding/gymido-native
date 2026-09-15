import { useState } from 'react';

import Button from '../../../shared/components/Button';
import Card from '../../../shared/components/Card';
import Screen from '../../../shared/components/Screen';
import { Body, Eyebrow, Heading } from '../../../shared/components/Typography';
import { logout } from '../authService';

// Shown when /auth/me fails after a valid Auth0 sign-in.
export default function AccountUnavailableScreen() {
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
    <Screen>
      <Card>
        <Eyebrow>Account</Eyebrow>
        <Heading>We couldn't open your account</Heading>
        <Body>
          You signed in, but this login isn't connected to a Gymido account. If you normally sign in with an
          email and password, sign out and use that instead.
        </Body>
        <Button title="Sign out" loading={signingOut} onPress={handleSignOut} />
      </Card>
    </Screen>
  );
}
