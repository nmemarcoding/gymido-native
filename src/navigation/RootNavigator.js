import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AuthStatus, useAuthStore } from '../features/auth/authStore';
import AccountUnavailableScreen from '../features/auth/screens/AccountUnavailableScreen';
import SessionLoadingScreen from '../features/auth/screens/SessionLoadingScreen';
import SignInFailedScreen from '../features/auth/screens/SignInFailedScreen';
import WelcomeScreen from '../features/auth/screens/WelcomeScreen';
import CreateProfileScreen from '../features/profile/CreateProfileScreen';
import RouteErrorBoundary from '../shared/components/RouteErrorBoundary';
import AppShell from './AppShell';
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

// RN-SPEC-app-shell §9.2: the bootstrap-level screens sit OUTSIDE the crash
// boundary, as on the web (FullScreenLoader and SessionErrorScreen are outside
// its RouteErrorBoundary). Everything the route tree renders is inside.
const BOOTSTRAP_ROUTES = new Set([routes.SessionLoading, routes.AccountUnavailable]);

// Debug builds only: the "Trigger render crash" probe (src/dev/debugCrash.js).
const DebugCrashProbe = __DEV__ ? require('../dev/debugCrash').DebugCrashProbe : null;

function initialParamsFor(landing, name) {
  return landing?.name === name ? landing.params : undefined;
}

export default function RootNavigator() {
  const status = useAuthStore((state) => state.status);
  const profileMissing = useAuthStore((state) => state.profileMissing);
  const meErrored = useAuthStore((state) => state.meErrored);
  const pendingDestination = useAuthStore((state) => state.pendingDestination);

  const signedIn = status === AuthStatus.signedIn;

  // Only read when the signed-in screens mount; later changes don't move the user.
  const landing = signedIn
    ? resolveLanding({ meErrored, pendingDestination, profileMissing })
    : null;

  const statusScreen = SIGNED_OUT_SCREENS[status] ?? LOADING_SCREEN;

  const navigator = (
    // A navigator reads initialRouteName only on mount, so the key remounts it
    // on sign-in to apply the landing rules.
    <Stack.Navigator
      key={signedIn ? 'signed-in' : 'signed-out'}
      initialRouteName={landing?.name}
      screenOptions={{ headerShown: false, animation: 'fade' }}
    >
      {signedIn ? (
        <Stack.Group screenOptions={{ headerShown: true, animation: 'default' }}>
          {/* Home is the app shell (RN-SPEC-app-shell §3.4); it draws its own headers. */}
          <Stack.Screen
            name={routes.Home}
            component={AppShell}
            initialParams={initialParamsFor(landing, routes.Home)}
            options={{ title: 'Home', headerShown: false }}
          />
          <Stack.Screen
            name={routes.Onboarding}
            component={CreateProfileScreen}
            initialParams={initialParamsFor(landing, routes.Onboarding)}
            options={{ title: 'Create Profile', headerShown: false }}
          />
        </Stack.Group>
      ) : (
        <Stack.Screen name={statusScreen.name} component={statusScreen.component} />
      )}
    </Stack.Navigator>
  );

  if (!signedIn && BOOTSTRAP_ROUTES.has(statusScreen.name)) {
    return navigator;
  }
  return (
    <RouteErrorBoundary>
      {DebugCrashProbe ? <DebugCrashProbe /> : null}
      {navigator}
    </RouteErrorBoundary>
  );
}
