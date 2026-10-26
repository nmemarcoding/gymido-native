import PillButton from '../../../shared/components/PillButton';
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
        <PillButton fullWidth testID="welcome-log-in" title="Log in" onPress={login} />
        <PillButton fullWidth testID="welcome-sign-up" title="Sign up" variant="secondary" onPress={signup} />
      </Card>
    </Screen>
  );
}
