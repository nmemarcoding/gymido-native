import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { PressedGradient, PRESSED_GRADIENT } from '../components/hubChrome';

// RN-SPEC-workout §19.10 "Pressed state, computed": the pressed stops are a
// layer created at mount. A press may change its opacity and nothing else —
// above all never the gradient value, which would build a new drawable.

const layer = () => StyleSheet.flatten(screen.getByTestId('pressed-gradient').props.style);

describe('PressedGradient', () => {
  it('is the web hover stops, to bottom: brand-400 → brand-500', () => {
    expect(PRESSED_GRADIENT).toBe('linear-gradient(to bottom, #f4b400, #dda000)');
  });

  it('exists before any press, invisible', async () => {
    await render(<PressedGradient pressed={false} radius={24} />);
    expect(layer()).toMatchObject({ experimental_backgroundImage: PRESSED_GRADIENT, opacity: 0, borderRadius: 24 });
  });

  it('a press flips only the opacity; the gradient is the same value', async () => {
    const { rerender } = await render(<PressedGradient pressed={false} radius={24} />);
    const before = layer();
    await rerender(<PressedGradient pressed radius={24} />);
    const after = layer();
    expect(after.opacity).toBe(1);
    expect({ ...after, opacity: 0 }).toEqual(before);
  });
});
