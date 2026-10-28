import { Dimensions, Keyboard } from 'react-native';
import { act, create } from 'react-test-renderer';

import { useKeyboardOverlap } from './useKeyboardHeight';

// Reviewer LOW (T-62 panel, 27 Oct): the panel shrinks by how much the
// keyboard OVERLAPS the window (window height − the keyboard's screenY,
// clamped ≥ 0), not by the keyboard's full height: a floating keyboard, or a
// short window, doesn't cover the panel.
describe('useKeyboardOverlap', () => {
  let listeners;
  let value;
  function Probe() {
    value = useKeyboardOverlap();
    return null;
  }
  beforeEach(() => {
    listeners = {};
    jest.spyOn(Keyboard, 'addListener').mockImplementation((event, handler) => {
      listeners[event] = handler;
      return { remove: jest.fn() };
    });
  });
  afterEach(() => jest.restoreAllMocks());

  const show = (endCoordinates) => act(() => (listeners.keyboardWillShow ?? listeners.keyboardDidShow)({ endCoordinates }));
  const hide = () => act(() => (listeners.keyboardWillHide ?? listeners.keyboardDidHide)());

  it.each([
    ['a docked keyboard', 800, { height: 300, screenY: 500 }, 300],
    ['a floating keyboard (below the window)', 800, { height: 250, screenY: 900 }, 0],
    ['a short window above the keyboard', 400, { height: 300, screenY: 500 }, 0],
    ['a keyboard taller than the part it covers', 800, { height: 420, screenY: 600 }, 200],
  ])('%s → overlap %s', (_name, windowHeight, endCoordinates, expected) => {
    jest.spyOn(Dimensions, 'get').mockReturnValue({ width: 1280, height: windowHeight, scale: 2, fontScale: 1 });
    act(() => {
      create(<Probe />);
    });
    expect(value).toBe(0);
    show(endCoordinates);
    expect(value).toBe(expected);
    hide();
    expect(value).toBe(0);
  });
});
