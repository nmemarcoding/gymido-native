import { Dimensions, Keyboard, Platform } from 'react-native';
import { act, create } from 'react-test-renderer';

import { useKeyboardOverlap } from './useKeyboardHeight';

// Reviewer LOW (T-62 panel, 27 Oct): the panel shrinks by how much the
// keyboard OVERLAPS the window (window height − the keyboard's screenY,
// clamped ≥ 0), not by the keyboard's full height: a floating keyboard, or a
// short window, doesn't cover the panel.
describe('useKeyboardOverlap', () => {
  let listeners;
  let dimensionsChange;
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
    dimensionsChange = null;
    jest.spyOn(Dimensions, 'addEventListener').mockImplementation((event, handler) => {
      if (event === 'change') {
        dimensionsChange = handler;
      }
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
  ])('%s (window %s, keyboard %o) → overlap %s', (_name, windowHeight, endCoordinates, expected) => {
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

  // Reviewer (d4dc8bd): a window resize with the keyboard up (Stage Manager /
  // Split View, an Android rotation without a re-sent didShow) recomputes
  // from the last keyboard frame; a zero frame (an undocked / floating iPad
  // keyboard) never shrinks anything.
  it('a resize with the keyboard up recomputes the overlap from the last keyboard frame', () => {
    jest.spyOn(Dimensions, 'get').mockReturnValue({ width: 1280, height: 800, scale: 2, fontScale: 1 });
    act(() => {
      create(<Probe />);
    });
    show({ height: 300, screenY: 500 });
    expect(value).toBe(300);
    act(() => dimensionsChange({ window: { width: 1280, height: 700, scale: 2, fontScale: 1 } }));
    expect(value).toBe(200);
    hide();
    act(() => dimensionsChange({ window: { width: 1280, height: 900, scale: 2, fontScale: 1 } }));
    expect(value).toBe(0);
  });

  it.each([
    ['height 0', { height: 0, screenY: 500 }],
    ['height 0 at screenY 0', { height: 0, screenY: 0 }],
  ])('a zero keyboard frame (%s, a floating iPad keyboard) → no overlap', (_name, endCoordinates) => {
    jest.spyOn(Dimensions, 'get').mockReturnValue({ width: 1024, height: 768, scale: 2, fontScale: 1 });
    act(() => {
      create(<Probe />);
    });
    show(endCoordinates);
    expect(value).toBe(0);
  });

  // T-74 device check (28 Oct, iPad): "Hide keyboard" shrinks the keyboard to
  // its shortcuts bar with only a willChangeFrame (no willHide).
  describe('frameChanges (iOS opt-in)', () => {
    let opts;
    function FrameProbe() {
      value = useKeyboardOverlap(opts);
      return null;
    }
    const mount = () =>
      act(() => {
        create(<FrameProbe />);
      });
    beforeEach(() => jest.spyOn(Dimensions, 'get').mockReturnValue({ width: 1194, height: 834, scale: 2, fontScale: 1 }));

    it('on iOS: a frame change to the shortcuts bar drops the overlap to the bar height', () => {
      jest.replaceProperty(Platform, 'OS', 'ios');
      opts = { frameChanges: true };
      mount();
      act(() => listeners.keyboardWillShow({ endCoordinates: { height: 320, screenY: 514 } }));
      expect(value).toBe(320);
      act(() => listeners.keyboardWillChangeFrame({ endCoordinates: { height: 55, screenY: 779 } }));
      expect(value).toBe(55);
      hide();
      expect(value).toBe(0);
    });

    it('off by default, and never on Android: no frame-change listener', () => {
      jest.replaceProperty(Platform, 'OS', 'ios');
      opts = undefined;
      mount();
      expect(listeners.keyboardWillChangeFrame).toBeUndefined();
      jest.replaceProperty(Platform, 'OS', 'android');
      listeners = {};
      opts = { frameChanges: true };
      mount();
      expect(listeners.keyboardWillChangeFrame).toBeUndefined();
      expect(listeners.keyboardDidShow).toBeDefined();
    });
  });
});
