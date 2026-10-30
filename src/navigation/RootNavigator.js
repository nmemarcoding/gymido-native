import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AuthStatus, useAuthStore } from '../features/auth/authStore';
import AccountUnavailableScreen from '../features/auth/screens/AccountUnavailableScreen';
import SessionLoadingScreen from '../features/auth/screens/SessionLoadingScreen';
import SignInFailedScreen from '../features/auth/screens/SignInFailedScreen';
import WelcomeScreen from '../features/auth/screens/WelcomeScreen';
import CreateProfileScreen from '../features/profile/CreateProfileScreen';
import OnboardingDaysScreen from '../features/onboarding/OnboardingDaysScreen';
import AppShell from '../features/shell/AppShell';
import NotFoundScreen from '../features/shell/NotFoundScreen';
import { getScreenTab, isShellScreen } from '../features/shell/shellNavigation';
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

// Shell screens open inside their tab: the root lands on AppShell, which
// starts on that tab, whose stack starts on the screen.
function landingRoute(landing) {
  if (!landing || !isShellScreen(landing.name)) {
    return { name: landing?.name, params: landing?.params };
  }
  return {
    name: routes.AppShell,
    params: { screen: getScreenTab(landing.name), params: { screen: landing.name, params: landing.params } },
  };
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
  const initial = landingRoute(landing);

  return (
    // A navigator reads initialRouteName only on mount, so the key remounts it
    // on sign-in to apply the landing rules.
    <Stack.Navigator
      key={signedIn ? 'signed-in' : 'signed-out'}
      initialRouteName={initial.name}
      screenOptions={{ headerShown: false, animation: 'fade' }}
    >
      {signedIn ? (
        <Stack.Group screenOptions={{ animation: 'default' }}>
          <Stack.Screen
            name={routes.AppShell}
            component={AppShell}
            initialParams={initial.name === routes.AppShell ? initial.params : undefined}
          />
          <Stack.Screen
            name={routes.Onboarding}
            component={CreateProfileScreen}
            initialParams={initial.name === routes.Onboarding ? initial.params : undefined}
          />
          {/* T-53 D: "Pick your days" after the onboarding generator's Accept. */}
          <Stack.Screen name={routes.OnboardingDays} component={OnboardingDaysScreen} />
          <Stack.Screen name={routes.NotFound} component={NotFoundRoute} />
        </Stack.Group>
      ) : (
        <Stack.Screen name={statusScreen.name} component={statusScreen.component} />
      )}
    </Stack.Navigator>
  );
}

// App-shell §3.1 / §9.4: any path the shell doesn't know lands here; "Go home"
// replaces it with Today.
function NotFoundRoute({ navigation }) {
  return <NotFoundScreen onGoHome={() => navigation.replace(routes.AppShell)} />;
}
