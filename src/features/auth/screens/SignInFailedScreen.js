import { useState } from 'react';

import Button from '../../../shared/components/Button';
import Card from '../../../shared/components/Card';
import ErrorBox from '../../../shared/components/ErrorBox';
import Screen from '../../../shared/components/Screen';
import { Body, Eyebrow, Heading } from '../../../shared/components/Typography';
import { retryLastAttempt } from '../authService';
import { useAuthStore } from '../authStore';

export default function SignInFailedScreen() {
  const signInError = useAuthStore((state) => state.signInError);
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await retryLastAttempt();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <Screen>
      <Card>
        <Eyebrow>Sign-in</Eyebrow>
        <Heading>Sign-in failed</Heading>
        <Body>Auth0 rejected the login request.</Body>
        <ErrorBox title="Something went wrong" message={signInError} />
        <Button title="Try again" loading={retrying} onPress={handleRetry} />
      </Card>
    </Screen>
  );
}
