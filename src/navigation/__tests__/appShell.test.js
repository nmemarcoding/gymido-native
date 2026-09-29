import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { act, render, screen, userEvent, within } from '@testing-library/react-native';
import { useWindowDimensions } from 'react-native';

import { AuthStatus, useAuthStore } from '../../features/auth/authStore';
import { useProfileStore } from '../../features/profile/profileStore';
import { httpError, mockApi } from '../../test/mockApi';
import { NOT_FOUND_CURRENT, planItem, plansList } from '../../test/planFixtures';
import { focusedPath, renderMemberApp } from '../../test/renderMemberApp';
import RootNavigator from '../RootNavigator';
import { routes } from '../routes';
import { headerTitleFor, isCompactHeader, resolveMode } from '../shell/shellRules';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 390, height: 844, scale: 3, fontScale: 1 })),
}));

const TRAINER = { email: 't@example.com', roles: ['Trainer'] };
const MEMBER = { email: 'm@example.com', roles: [] };
const homeState = () => ({ index: 0, routes: [{ name: routes.HomeTab }] });

function signIn(user, workspace = 'member') {
  useAuthStore.setState({ user, workspace });
}

function api() {
  return mockApi({
    'GET /plans': plansList([planItem({ id: 3, name: 'Strength Base' })]),
    'GET /my-plans/current': httpError(404, NOT_FOUND_CURRENT),
  });
}

const tabLabels = () => screen.getAllByRole('tab').map((tab) => tab.props.accessibilityLabel);
const selectedTabs = () =>
  screen
    .getAllByRole('tab')
    .filter((tab) => tab.props.accessibilityState?.selected)
    .map((tab) => tab.props.accessibilityLabel);

beforeEach(async () => {
  await AsyncStorage.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
  useWindowDimensions.mockImplementation(() => ({ width: 390, height: 844, scale: 3, fontScale: 1 }));
  useAuthStore.setState({ status: AuthStatus.restoring, user: null, workspace: 'member' });
});

describe('rules (RN-SPEC-app-shell §5, §6.1)', () => {
  test('resolved mode is per route', () => {
    expect(resolveMode(MEMBER, '/trainer', 'trainer')).toBe('member');
    expect(resolveMode(TRAINER, '/trainer/clients', 'member')).toBe('trainer');
    expect(resolveMode(TRAINER, '/trainer/apply', 'member')).toBe('member');
    expect(resolveMode(TRAINER, '/trainers', 'member')).toBe('member');
    expect(resolveMode(TRAINER, '/plans', 'trainer')).toBe('trainer');
    expect(resolveMode(TRAINER, '/plans', 'member')).toBe('member');
  });

  test.each([
    ['/', 'Dashboard'],
    ['/workout', ''],
    ['/exercises', 'Library'],
    ['/plans', 'Library'],
    ['/plans/3', 'Library'],
    ['/progress', 'Progress'],
    ['/profile', 'Settings'],
    ['/my-trainer', 'Coaching'],
    ['/trainer/clients', 'Coaching'],
    ['/elsewhere', 'Workout'],
  ])('title for %s is %j', (path, title) => {
    expect(headerTitleFor(path)).toBe(title);
  });

  test('compact header paths', () => {
    expect(isCompactHeader('/exercises')).toBe(true);
    expect(isCompactHeader('/plans/3')).toBe(true);
    expect(isCompactHeader('/plans')).toBe(false);
    expect(isCompactHeader('/workout', 'active=1')).toBe(true);
  });
});

describe('member tab bar (§6.3)', () => {
  test('Home: six member tabs with icons, none active (⚠S1), "Home, coming soon"', async () => {
    signIn(MEMBER);
    api();
    await renderMemberApp({ initialState: homeState() });
    expect(tabLabels()).toEqual(['Workout', 'Exercises', 'Library', 'Progress', 'Trainer', 'Settings']);
    expect(selectedTabs()).toEqual([]);
    expect(screen.getByText('Home, coming soon')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Dashboard' })).toBeOnTheScreen();
    ['workout', 'exercises', 'library', 'progress', 'trainer', 'settings'].forEach((icon) => {
      expect(screen.getByTestId(`gym-icon-${icon}`)).toBeOnTheScreen();
    });
  });

  test('every tab opens its screen and becomes the only active tab', async () => {
    const user = userEvent.setup();
    signIn(MEMBER);
    api();
    await renderMemberApp({ initialState: homeState() });
    for (const [label, text] of [
      ['Exercises', 'Exercises, coming soon'],
      ['Progress', 'Progress, coming soon'],
      ['Trainer', 'Trainer, coming soon'],
      ['Settings', 'Settings, coming soon'],
      ['Library', 'Strength Base'],
    ]) {
      await user.press(screen.getByRole('tab', { name: label }));
      expect(await screen.findByText(text)).toBeOnTheScreen();
      expect(selectedTabs()).toEqual([label]);
    }
  });

  test('members never see the Workspace block or the Trainer mode card', async () => {
    const user = userEvent.setup();
    signIn(MEMBER);
    api();
    await renderMemberApp({ initialState: homeState() });
    await user.press(screen.getByRole('tab', { name: 'Settings' }));
    expect(screen.queryByTestId('mobile-mode-switch')).not.toBeOnTheScreen();
    await user.press(screen.getByRole('tab', { name: 'Trainer' }));
    expect(screen.queryByTestId('trainer-mode-card')).not.toBeOnTheScreen();
  });

  test('TrainerRoute: a member sent to /trainer is replaced to "/"', async () => {
    signIn(MEMBER);
    api();
    const { navigation } = await renderMemberApp({
      initialState: { index: 0, routes: [{ name: routes.TrainerClientsTab }] },
    });
    expect(await screen.findByText('Home, coming soon')).toBeOnTheScreen();
    expect(navigation.current.getCurrentRoute().name).toBe(routes.HomeTab);
  });
});

describe('trainer mode (§5, §6.2, §6.5)', () => {
  test('Landing (§3.3): trainer mode on "/" replaces to /trainer with the four trainer tabs', async () => {
    signIn(TRAINER, 'trainer');
    api();
    const { navigation } = await renderMemberApp({ initialState: homeState() });
    expect(await screen.findByText('Dashboard, coming soon')).toBeOnTheScreen();
    expect(navigation.current.getCurrentRoute().name).toBe(routes.TrainerDashboardTab);
    expect(tabLabels()).toEqual(['Dashboard', 'Clients', 'Plans', 'Profile']);
    expect(selectedTabs()).toEqual(['Dashboard']);
    ['dashboard', 'users', 'plans', 'profile'].forEach((icon) => {
      expect(screen.getByTestId(`gym-icon-${icon}`)).toBeOnTheScreen();
    });
  });

  // Sign-in remounts the signed-in stack, so the shell mounts fresh; a
  // navigate from Home during that mount used to be lost (blank Home).
  async function signInThroughRoot(workspace) {
    useAuthStore.setState({ status: AuthStatus.signedOut, user: null, workspace: 'member' });
    api();
    const navigation = { current: null };
    await render(
      <NavigationContainer
        ref={(ref) => {
          navigation.current = ref;
        }}
      >
        <RootNavigator />
      </NavigationContainer>
    );
    await act(async () => {
      useProfileStore.setState({ profile: { id: 1 }, profileStatus: 'loaded' });
      useAuthStore.setState({ status: AuthStatus.signedIn, user: TRAINER, workspace, profileMissing: false });
    });
    return navigation;
  }

  test('Landing after sign-in: trainer mode opens /trainer, not a blank Home', async () => {
    const navigation = await signInThroughRoot('trainer');
    expect(await screen.findByText('Dashboard, coming soon')).toBeOnTheScreen();
    expect(navigation.current.getCurrentRoute().name).toBe(routes.TrainerDashboardTab);
    expect(selectedTabs()).toEqual(['Dashboard']);
  });

  test('Landing after sign-in: the Personal preference opens member Home', async () => {
    const navigation = await signInThroughRoot('member');
    expect(await screen.findByText('Home, coming soon')).toBeOnTheScreen();
    expect(navigation.current.getCurrentRoute().name).toBe(routes.HomeTab);
  });

  test('a trainer with the Personal preference lands on member Home', async () => {
    signIn(TRAINER, 'member');
    api();
    await renderMemberApp({ initialState: homeState() });
    expect(screen.getByText('Home, coming soon')).toBeOnTheScreen();
    expect(tabLabels()).toHaveLength(6);
  });

  test('the tab set follows the current path: trainer preference on /plans shows trainer tabs, none active', async () => {
    signIn(TRAINER, 'trainer');
    api();
    await renderMemberApp();
    await screen.findByText('Strength Base');
    expect(tabLabels()).toEqual(['Dashboard', 'Clients', 'Plans', 'Profile']);
    expect(selectedTabs()).toEqual([]);
  });

  test('Workspace block on Trainer Profile: Personal saves the preference and pushes "/"', async () => {
    const user = userEvent.setup();
    signIn(TRAINER, 'trainer');
    api();
    const { navigation } = await renderMemberApp({ initialState: homeState() });
    await user.press(await screen.findByRole('tab', { name: 'Profile' }));
    const block = screen.getByTestId('mobile-mode-switch');
    expect(within(block).getByText('Workspace')).toBeOnTheScreen();
    expect(within(block).getByRole('button', { name: 'Trainer' })).toBeSelected();

    await user.press(within(block).getByRole('button', { name: 'Personal' }));
    expect(await AsyncStorage.getItem('gymido-mode')).toBe('member');
    expect(await screen.findByText('Home, coming soon')).toBeOnTheScreen();
    expect(tabLabels()).toHaveLength(6);

    // ⚠S14: a push, so Back returns to the trainer page.
    await act(async () => {
      navigation.current.goBack();
    });
    expect(navigation.current.getCurrentRoute().name).toBe(routes.TrainerProfileTab);
    expect(tabLabels()).toEqual(['Dashboard', 'Clients', 'Plans', 'Profile']);
  });

  test('Workspace block on Settings: Trainer saves the preference and pushes /trainer', async () => {
    const user = userEvent.setup();
    signIn(TRAINER, 'member');
    api();
    await renderMemberApp({ initialState: homeState() });
    await user.press(screen.getByRole('tab', { name: 'Settings' }));
    const block = screen.getByTestId('mobile-mode-switch');
    await user.press(within(block).getByRole('button', { name: 'Trainer' }));
    expect(await AsyncStorage.getItem('gymido-mode')).toBe('trainer');
    expect(await screen.findByText('Dashboard, coming soon')).toBeOnTheScreen();
  });

  test('tapping the current mode does nothing', async () => {
    const user = userEvent.setup();
    signIn(TRAINER, 'member');
    api();
    const { navigation } = await renderMemberApp({ initialState: homeState() });
    await user.press(screen.getByRole('tab', { name: 'Settings' }));
    await user.press(within(screen.getByTestId('mobile-mode-switch')).getByRole('button', { name: 'Personal' }));
    expect(navigation.current.getCurrentRoute().name).toBe(routes.SettingsTab);
    expect(await AsyncStorage.getItem('gymido-mode')).toBeNull();
  });

  test('TrainerModeCard pushes /trainer WITHOUT writing the preference; Back returns to the member hub', async () => {
    const user = userEvent.setup();
    signIn(TRAINER, 'member');
    api();
    const { navigation } = await renderMemberApp({ initialState: homeState() });
    await user.press(screen.getByRole('tab', { name: 'Trainer' }));
    const card = screen.getByTestId('trainer-mode-card');
    expect(within(card).getByText('You are already a trainer')).toBeOnTheScreen();
    await user.press(within(card).getByText('Switch to Trainer Mode'));
    expect(await screen.findByText('Dashboard, coming soon')).toBeOnTheScreen();
    expect(await AsyncStorage.getItem('gymido-mode')).toBeNull();
    expect(useAuthStore.getState().workspace).toBe('member');

    await act(async () => {
      navigation.current.goBack();
    });
    expect(focusedPath(navigation.current.getRootState())).toEqual([routes.TrainerTab]);
    expect(tabLabels()).toHaveLength(6);
    expect(selectedTabs()).toEqual(['Trainer']);
  });

  test('trainer tabs navigate between the trainer placeholders', async () => {
    const user = userEvent.setup();
    signIn(TRAINER, 'trainer');
    api();
    await renderMemberApp({ initialState: homeState() });
    await screen.findByText('Dashboard, coming soon');
    await user.press(screen.getByRole('tab', { name: 'Clients' }));
    expect(screen.getByText('Clients, coming soon')).toBeOnTheScreen();
    await user.press(screen.getByRole('tab', { name: 'Plans' }));
    expect(screen.getByText('Plans, coming soon')).toBeOnTheScreen();
    expect(selectedTabs()).toEqual(['Plans']);
  });
});

describe('tablet (≥768)', () => {
  test('no tab bar; the header shows the ModeSwitch for trainers; sidebar follows the mode', async () => {
    useWindowDimensions.mockImplementation(() => ({ width: 1024, height: 768, scale: 2, fontScale: 1 }));
    signIn(TRAINER, 'trainer');
    api();
    await renderMemberApp({ initialState: homeState() });
    expect(await screen.findByText('Dashboard, coming soon')).toBeOnTheScreen();
    expect(screen.queryByTestId('tab-bar')).not.toBeOnTheScreen();
    expect(screen.getByTestId('mode-switch')).toBeOnTheScreen();
    expect(screen.queryByTestId('mobile-mode-switch')).not.toBeOnTheScreen();
    const sidebar = screen.getByTestId('desktop-sidebar');
    expect(within(sidebar).getByText('Coach your clients')).toBeOnTheScreen();
    expect(within(sidebar).getByText('Workout Plans')).toBeOnTheScreen();
    expect(within(sidebar).getByText('Logout')).toBeOnTheScreen();
  });
});
