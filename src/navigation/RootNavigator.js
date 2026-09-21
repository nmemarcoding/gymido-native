import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AuthStatus, useAuthStore } from '../features/auth/authStore';
import AccountUnavailableScreen from '../features/auth/screens/AccountUnavailableScreen';
import SessionLoadingScreen from '../features/auth/screens/SessionLoadingScreen';
import SignInFailedScreen from '../features/auth/screens/SignInFailedScreen';
import WelcomeScreen from '../features/auth/screens/WelcomeScreen';
import OnboardingScreen from '../features/onboarding/OnboardingScreen';
import SettingsScreen from '../features/settings/SettingsScreen';
import TrainerDashboardScreen from '../features/trainer/TrainerDashboardScreen';
import MemberTabs from './MemberTabs';
import { resolveLanding } from './resolveLanding';
import { routes } from './routes';

const Stack = createNativeStackNavigator();

const SIGNED_OUT_SCREENS = {
  [AuthStatus.signedOut]: { name: routes.Welcome, component: WelcomeScreen },
  [AuthStatus.signInFailed]: { name: routes.SignInFailed, component: SignInFailedScreen },
  [AuthStatus.accountUnavailable]: { name: routes.AccountUnavailable, component: AccountUnavailableScreen },
};

// Restoring, authenticating and loading the user all share one loading screen.
const LOADING_SCREEN = { name: routes.SessionLoading, component: SessionLoadingScreen };

function initialParamsFor(landing, name) {
  return landing?.name === name ? landing.params : undefined;
}

export default function RootNavigator() {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const profileMissing = useAuthStore((state) => state.profileMissing);
  const meErrored = useAuthStore((state) => state.meErrored);
  const pendingDestination = useAuthStore((state) => state.pendingDestination);
  const workspace = useAuthStore((state) => state.workspace);

  const signedIn = status === AuthStatus.signedIn;

  // Only read when the signed-in screens mount; later changes don't move the user.
  const landing = signedIn
    ? resolveLanding({
        meErrored,
        pendingDestination,
        profileMissing,
        roles: user?.roles ?? [],
        workspace,
      })
    : null;

  const statusScreen = SIGNED_OUT_SCREENS[status] ?? LOADING_SCREEN;

  return (
    // A navigator reads initialRouteName only on mount, so the key remounts it
    // on sign-in to apply the landing rules.
    <Stack.Navigator
      key={signedIn ? 'signed-in' : 'signed-out'}
      initialRouteName={landing?.name}
      screenOptions={{ headerShown: false, animation: 'fade' }}
    >
      {signedIn ? (
        <Stack.Group screenOptions={{ headerShown: true, animation: 'default' }}>
          {/* Home is the member tab shell (RN-SPEC-plans §1.3); it draws its own headers. */}
          <Stack.Screen
            name={routes.Home}
            component={MemberTabs}
            initialParams={initialParamsFor(landing, routes.Home)}
            options={{ title: 'Home', headerShown: false }}
          />
          <Stack.Screen
            name={routes.TrainerDashboard}
            component={TrainerDashboardScreen}
            initialParams={initialParamsFor(landing, routes.TrainerDashboard)}
            options={{ title: 'Trainer dashboard' }}
          />
          <Stack.Screen
            name={routes.Onboarding}
            component={OnboardingScreen}
            initialParams={initialParamsFor(landing, routes.Onboarding)}
            options={{ title: 'Onboarding' }}
          />
          <Stack.Screen
            name={routes.Settings}
            component={SettingsScreen}
            initialParams={initialParamsFor(landing, routes.Settings)}
            options={{ title: 'Settings' }}
          />
        </Stack.Group>
      ) : (
        <Stack.Screen name={statusScreen.name} component={statusScreen.component} />
      )}
    </Stack.Navigator>
  );
}
