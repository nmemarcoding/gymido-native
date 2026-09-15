import { useNavigation } from '@react-navigation/native';

import { routes } from '../../navigation/routes';
import Button from '../../shared/components/Button';
import Card from '../../shared/components/Card';
import Screen from '../../shared/components/Screen';
import { Body, Eyebrow, Heading } from '../../shared/components/Typography';
import { env } from '../../shared/config/env';
import { useAuthStore } from '../auth/authStore';

// Stand-in for signed-in screens that don't have a spec yet. Shows the session
// details needed to check the landing rules.
export default function PlaceholderScreen({ title }) {
  const navigation = useNavigation();
  const user = useAuthStore((state) => state.user);
  const roles = user?.roles?.length ? user.roles.join(', ') : 'none';

  return (
    <Screen>
      <Card>
        <Eyebrow>Placeholder</Eyebrow>
        <Heading>{title}</Heading>
        <Body>Signed in as {user?.email ?? 'unknown'}</Body>
        <Body>Roles: {roles}</Body>
        <Body>Environment: {env.appEnv}</Body>
        <Button title="Settings" variant="secondary" onPress={() => navigation.navigate(routes.Settings)} />
      </Card>
    </Screen>
  );
}
