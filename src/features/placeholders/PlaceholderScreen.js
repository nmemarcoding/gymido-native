import { useRoute } from '@react-navigation/native';

import Button from '../../shared/components/Button';
import Card from '../../shared/components/Card';
import Screen from '../../shared/components/Screen';
import { Body, Eyebrow, Heading } from '../../shared/components/Typography';
import { env } from '../../shared/config/env';
import { useAuthStore } from '../auth/authStore';
import ShellPage from '../shell/ShellPage';
import { openShellPath } from '../shell/shellLinks';
import { isShellScreen } from '../shell/shellNavigation';

// Stand-in for signed-in screens that don't have a spec yet. Shows the session
// details needed to check the landing rules.
export default function PlaceholderScreen({ title }) {
  const route = useRoute();
  // Inside the tab shell it gets the shell chrome; elsewhere (Onboarding) a plain screen.
  const Wrapper = isShellScreen(route.name) ? ShellPage : Screen;
  const user = useAuthStore((state) => state.user);
  const roles = user?.roles?.length ? user.roles.join(', ') : 'none';

  return (
    <Wrapper>
      <Card>
        <Eyebrow>Placeholder</Eyebrow>
        <Heading>{title}</Heading>
        <Body>Signed in as {user?.email ?? 'unknown'}</Body>
        <Body>Roles: {roles}</Body>
        <Body>Environment: {env.appEnv}</Body>
        <Button
          testID="placeholder-open-settings"
          title="Settings"
          variant="secondary"
          onPress={() => openShellPath('/profile')}
        />
      </Card>
    </Wrapper>
  );
}
