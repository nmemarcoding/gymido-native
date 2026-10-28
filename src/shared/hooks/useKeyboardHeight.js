import { useEffect, useRef, useState } from 'react';
import { Dimensions, Keyboard, Platform } from 'react-native';

// Height of the on-screen keyboard (0 when hidden). Edge-to-edge Modals are
// not resized by the OS. Note: on Android RN reports the IME height MINUS the
// nav bar / taskbar, so anything drawn to the screen bottom (AppModal) lifts
// by useKeyboardOverlap below instead (UX native final audit, ruling 12).
export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (event) => setHeight(event.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}

// How much of the window the keyboard covers (0 when hidden): the window
// height minus the keyboard's top edge, never below 0, so a floating
// keyboard or a short window doesn't count (T-62 panel, reviewer LOW). A zero
// frame (an undocked / floating iPad keyboard) covers nothing, and a window
// resize with the keyboard up (Stage Manager, Split View, an Android rotation
// without a new didShow) recomputes from the last keyboard frame.
export function overlapOf(frame, windowHeight) {
  if (!frame || !(frame.height > 0)) {
    return 0;
  }
  return Math.max(0, windowHeight - frame.screenY);
}

//
// `frameChanges` (opt-in, iOS): also follow keyboardWillChangeFrame. iPad's
// "Hide keyboard" key shrinks the keyboard to its shortcuts bar with the
// field still focused and sends only a frame change, no willHide (T-74
// device check, 28 Oct 2026), so without it the overlap stays the docked
// keyboard's height.
export function useKeyboardOverlap({ frameChanges = false } = {}) {
  const [overlap, setOverlap] = useState(0);
  const frame = useRef(null);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onFrame = (event) => {
      frame.current = event.endCoordinates;
      setOverlap(overlapOf(frame.current, Dimensions.get('window').height));
    };
    const show = Keyboard.addListener(showEvent, onFrame);
    const change = frameChanges && Platform.OS === 'ios' ? Keyboard.addListener('keyboardWillChangeFrame', onFrame) : null;
    const hide = Keyboard.addListener(hideEvent, () => {
      frame.current = null;
      setOverlap(0);
    });
    const resize = Dimensions.addEventListener('change', ({ window }) => setOverlap(overlapOf(frame.current, window.height)));
    return () => {
      show.remove();
      change?.remove();
      hide.remove();
      resize.remove();
    };
  }, [frameChanges]);

  return overlap;
}
