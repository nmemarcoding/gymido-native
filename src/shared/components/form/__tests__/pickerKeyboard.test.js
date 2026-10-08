import { render, screen, userEvent } from '@testing-library/react-native';
import { Keyboard } from 'react-native';

import DateInput from '../DateInput';
import Select from '../Select';

afterEach(() => {
  jest.restoreAllMocks();
});

// Web parity: a select or date click moves focus off a focused input, so the
// keyboard closes when a picker opens (pages keep taps while it is up).
test('opening a Select closes the keyboard', async () => {
  const dismiss = jest.spyOn(Keyboard, 'dismiss');
  const user = userEvent.setup();
  await render(
    <Select
      testID="unit"
      label="Weight unit"
      value="lb"
      options={[
        { label: 'lb', value: 'lb' },
        { label: 'kg', value: 'kg' },
      ]}
      onChangeValue={jest.fn()}
    />
  );
  await user.press(screen.getByTestId('unit'));
  expect(dismiss).toHaveBeenCalledTimes(1);
});

test('opening a DateInput closes the keyboard', async () => {
  const dismiss = jest.spyOn(Keyboard, 'dismiss');
  const user = userEvent.setup();
  await render(<DateInput testID="dob" label="Date of birth" value="" onChangeValue={jest.fn()} />);
  await user.press(screen.getByTestId('dob'));
  expect(dismiss).toHaveBeenCalledTimes(1);
});
