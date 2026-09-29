import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { act, fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { Text } from 'react-native';

import { routes } from '../../../navigation/routes';
import { httpError, mockApi, networkError } from '../../../test/mockApi';
import CreateProfileScreen from '../CreateProfileScreen';
import { useProfileStore } from '../profileStore';

const Stack = createNativeStackNavigator();

function HomeStub() {
  return <Text>Home reached</Text>;
}

async function renderScreen() {
  const navigation = { current: null };
  await render(
    <NavigationContainer
      ref={(ref) => {
        navigation.current = ref;
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name={routes.Onboarding} component={CreateProfileScreen} />
        <Stack.Screen name={routes.Home} component={HomeStub} />
      </Stack.Navigator>
    </NavigationContainer>
  );
  return navigation;
}

const field = (label) => screen.getByLabelText(label);
const submit = () => screen.getByRole('button', { name: 'Create profile' });

async function fillRequired(user) {
  await user.type(field('First Name'), 'John');
  await user.type(field('Last Name'), 'Doe');
  // O5: height opens in ft/in.
  await user.type(field('Feet'), '5');
  await user.type(field('Inches'), '11');
}

const PROFILE = {
  user_id: 7,
  first_name: 'John',
  last_name: 'Doe',
  height_value: 180,
  height_unit: 'cm',
  current_weight_value: null,
  current_weight_unit: null,
  goal_weight_value: null,
  goal_weight_unit: null,
  date_of_birth: null,
  sex: null,
};

afterEach(() => {
  jest.restoreAllMocks();
  useProfileStore.setState({ profile: null, profileStatus: 'idle', profileError: null });
});

test('layout: title, subtitle, fields, defaults, no back or logout (⚠P7)', async () => {
  mockApi({});
  await renderScreen();
  expect(screen.getByRole('header', { name: 'Create Profile' })).toBeOnTheScreen();
  expect(screen.getByText('A quick setup so we can tailor your workout plan.')).toBeOnTheScreen();
  expect(field('First Name')).toHaveProp('placeholder', 'John');
  // O5: ft/in by default; ONE weight Unit selector, lb by default.
  expect(screen.getByRole('button', { name: 'Height unit' })).toHaveAccessibilityValue({ text: 'ft/in' });
  expect(field('Feet')).toHaveProp('placeholder', '5');
  expect(field('Inches')).toHaveProp('placeholder', '9');
  expect(field('Inches')).toHaveDisplayValue('');
  expect(screen.getByText('Whole feet only.')).toBeOnTheScreen();
  // O6 native copy.
  expect(
    screen.getByText('Feet and inches are shown first. Switch to cm or inches if that is how you measure height.')
  ).toBeOnTheScreen();
  expect(screen.queryByText(/Metric is shown first/)).not.toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Unit' })).not.toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Weight unit' })).toHaveAccessibilityValue({ text: 'lb' });
  expect(screen.getByRole('button', { name: 'Sex' })).toHaveAccessibilityValue({ text: 'Prefer not to say' });
  expect(screen.queryByText(/sign out|log ?out|back/i)).not.toBeOnTheScreen();
  // No autofill; return/Go submits.
  expect(field('First Name')).toHaveProp('autoComplete', 'off');
  expect(field('First Name')).toHaveProp('returnKeyType', 'go');
});

test('validation errors show under fields; nothing is sent (⚠P8)', async () => {
  const user = userEvent.setup();
  const api = mockApi({});
  await renderScreen();
  await user.press(submit());
  expect(screen.getByText('First name is required')).toBeOnTheScreen();
  expect(screen.getByText('Last name is required')).toBeOnTheScreen();
  expect(screen.getByText('Feet is required')).toBeOnTheScreen();
  expect(field('First Name')).toHaveProp('accessibilityState', { invalid: true });
  expect(api.calls).toEqual([]);
});

test('⚠P12: an error stays while the field is edited, until the next submit', async () => {
  const user = userEvent.setup();
  mockApi({});
  await renderScreen();
  await user.press(submit());
  await user.type(field('First Name'), 'John');
  expect(screen.getByText('First name is required')).toBeOnTheScreen();
});

test('success: POST /profile with the exact body, profile stored, replaced to "/" (⚠P6)', async () => {
  const user = userEvent.setup();
  const api = mockApi({ 'POST /profile': { profile: PROFILE } });
  const navigation = await renderScreen();
  await fillRequired(user);
  await user.type(field('Current Weight'), '82.5');
  await user.press(submit());
  expect(api.calls).toEqual([
    {
      method: 'POST',
      url: '/profile',
      body: {
        first_name: 'John',
        last_name: 'Doe',
        height_value: 71,
        height_unit: 'ft_in',
        current_weight_value: 82.5,
        current_weight_unit: 'lb',
        goal_weight_value: null,
        goal_weight_unit: null,
        date_of_birth: null,
        sex: null,
      },
    },
  ]);
  expect(await screen.findByText('Home reached')).toBeOnTheScreen();
  expect(useProfileStore.getState()).toMatchObject({ profile: PROFILE, profileStatus: 'loaded' });
  const state = navigation.current.getRootState();
  expect(state.routes.map((route) => route.name)).toEqual([routes.Home]);
});

test('return/Go in any input submits', async () => {
  const user = userEvent.setup();
  const api = mockApi({ 'POST /profile': { profile: PROFILE } });
  await renderScreen();
  await fillRequired(user);
  await act(async () => {
    fireEvent(field('Last Name'), 'submitEditing');
  });
  expect(api.calls).toHaveLength(1);
});

test('⚠P7: a 409 shows the message and stays on the screen', async () => {
  const user = userEvent.setup();
  mockApi({ 'POST /profile': httpError(409, { success: false, message: 'Profile already exists' }) });
  const navigation = await renderScreen();
  await fillRequired(user);
  await user.press(submit());
  expect(screen.getByText('Something went wrong')).toBeOnTheScreen();
  expect(screen.getByText('A profile already exists for this account.')).toBeOnTheScreen();
  expect(navigation.current.getCurrentRoute().name).toBe(routes.Onboarding);
  expect(submit()).toBeEnabled();
});

test('⚠P11: 422 shows "Validation failed" plus the server message under the field', async () => {
  const user = userEvent.setup();
  mockApi({
    'POST /profile': httpError(422, {
      success: false,
      message: 'Validation failed',
      errors: { height_value: ['The height value must be between 36 and 108 inches'] },
    }),
  });
  await renderScreen();
  await fillRequired(user);
  await user.press(submit());
  expect(screen.getByText('Validation failed')).toBeOnTheScreen();
  expect(screen.getByText('The height value must be between 36 and 108 inches')).toBeOnTheScreen();
});

test('⚠P4: errors for fields with no slot only show the top message', async () => {
  const user = userEvent.setup();
  mockApi({
    'POST /profile': httpError(422, {
      success: false,
      message: 'Validation failed',
      errors: { date_of_birth: ['The date of birth cannot be in the future'] },
    }),
  });
  await renderScreen();
  await fillRequired(user);
  await user.press(submit());
  expect(screen.getByText('Validation failed')).toBeOnTheScreen();
  expect(screen.queryByText('The date of birth cannot be in the future')).not.toBeOnTheScreen();
});

test('network failure shows the transport message; the form keeps its values', async () => {
  const user = userEvent.setup();
  mockApi({ 'POST /profile': networkError() });
  await renderScreen();
  await fillRequired(user);
  await user.press(submit());
  expect(screen.getByText('Network Error')).toBeOnTheScreen();
  expect(field('First Name')).toHaveDisplayValue('John');
});

test('⚠P9: fields stay editable while submitting; only the button disables', async () => {
  const user = userEvent.setup();
  mockApi({ 'POST /profile': () => new Promise(() => {}) });
  await renderScreen();
  await fillRequired(user);
  await user.press(submit());
  expect(submit()).toBeDisabled();
  expect(submit()).toBeBusy();
  expect(field('First Name')).not.toHaveProp('editable', false);
});

test('number fields keep typed text but store the web value ("5." → "")', async () => {
  const user = userEvent.setup();
  mockApi({});
  await renderScreen();
  await user.type(field('First Name'), 'John');
  await user.type(field('Last Name'), 'Doe');
  await user.type(field('Feet'), '5.');
  expect(field('Feet')).toHaveDisplayValue('5.');
  await user.press(submit());
  expect(screen.getByText('Feet is required')).toBeOnTheScreen();
});

test('O6: ft/in → cm converts to a string that submits normally', async () => {
  const user = userEvent.setup();
  const api = mockApi({ 'POST /profile': { profile: PROFILE } });
  await renderScreen();
  await fillRequired(user);
  await user.press(screen.getByRole('button', { name: 'Height unit' }));
  await act(async () => {
    fireEvent(screen.getByTestId('height-unit-picker'), 'valueChange', 0);
  });
  expect(field('Height')).toHaveDisplayValue('180.34');
  expect(screen.getByText('Enter your height in centimeters.')).toBeOnTheScreen();
  await user.press(submit());
  expect(api.calls[0].body).toMatchObject({ height_value: 180.34, height_unit: 'cm' });
});

test('O6 (replaces ⚠P2): empty ft/in → cm shows the placeholder, and submit shows "Height is required"', async () => {
  const user = userEvent.setup();
  const api = mockApi({ 'POST /profile': { profile: PROFILE } });
  await renderScreen();
  await user.type(field('First Name'), 'John');
  await user.type(field('Last Name'), 'Doe');
  await user.press(screen.getByRole('button', { name: 'Height unit' }));
  await act(async () => {
    fireEvent(screen.getByTestId('height-unit-picker'), 'valueChange', 0);
  });
  expect(field('Height')).toHaveDisplayValue('');
  expect(field('Height')).toHaveProp('placeholder', '180');
  await user.press(submit());
  expect(screen.getByText('Height is required')).toBeOnTheScreen();
  expect(field('Height')).toHaveProp('accessibilityState', { invalid: true });
  expect(api.calls).toEqual([]);
});

test('O5: the one Weight unit selector drives both weights in the payload', async () => {
  const user = userEvent.setup();
  const api = mockApi({ 'POST /profile': { profile: PROFILE } });
  await renderScreen();
  await fillRequired(user);
  await user.type(field('Current Weight'), '82.5');
  await user.type(field('Goal Weight'), '78');
  await user.press(screen.getByRole('button', { name: 'Weight unit' }));
  await act(async () => {
    fireEvent(screen.getByTestId('weight-unit-picker'), 'valueChange', 1);
  });
  expect(screen.getByRole('button', { name: 'Weight unit' })).toHaveAccessibilityValue({ text: 'kg' });
  // No conversion on switch.
  expect(field('Current Weight')).toHaveDisplayValue('82.5');
  await user.press(submit());
  expect(api.calls[0].body).toMatchObject({
    current_weight_value: 82.5,
    current_weight_unit: 'kg',
    goal_weight_value: 78,
    goal_weight_unit: 'kg',
  });
});
