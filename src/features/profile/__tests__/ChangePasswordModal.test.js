import { render, screen, userEvent } from '@testing-library/react-native';
import { Keyboard } from 'react-native';

import ChangePasswordModal from '../ChangePasswordModal';

afterEach(() => {
  jest.restoreAllMocks();
});

// Web parity: a button click moves focus off the input, so the keyboard closes.
// The Settings page keeps taps while the keyboard is up (PageLayout), so the
// shared Button has to close it.
test('"Change password" with a validation error dismisses the keyboard', async () => {
  const dismiss = jest.spyOn(Keyboard, 'dismiss');
  const user = userEvent.setup();
  await render(<ChangePasswordModal visible onClose={jest.fn()} />);
  await user.type(screen.getByTestId('change-password-new'), 'short');
  await user.press(screen.getByTestId('change-password-submit'));
  expect(screen.getByText('Password must be at least 8 characters.')).toBeOnTheScreen();
  expect(dismiss).toHaveBeenCalledTimes(1);
});

test('Cancel dismisses the keyboard and closes', async () => {
  const dismiss = jest.spyOn(Keyboard, 'dismiss');
  const onClose = jest.fn();
  const user = userEvent.setup();
  await render(<ChangePasswordModal visible onClose={onClose} />);
  await user.press(screen.getByTestId('change-password-cancel'));
  expect(dismiss).toHaveBeenCalledTimes(1);
  expect(onClose).toHaveBeenCalledTimes(1);
});
