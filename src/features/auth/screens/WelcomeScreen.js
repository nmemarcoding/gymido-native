import Button from '../../../shared/components/Button';
import Card from '../../../shared/components/Card';
import Screen from '../../../shared/components/Screen';
import { Heading } from '../../../shared/components/Typography';
import { login, signup } from '../authService';

// Signed-out entry point. Auth0 opens only when the user taps a button.
export default function WelcomeScreen() {
  return (
    <Screen>
      <Card>
        <Heading>Gymido</Heading>
        <Button testID="welcome-log-in" title="Log in" onPress={login} />
        <Button testID="welcome-sign-up" title="Sign up" variant="secondary" onPress={signup} />
      </Card>
    </Screen>
  );
}
