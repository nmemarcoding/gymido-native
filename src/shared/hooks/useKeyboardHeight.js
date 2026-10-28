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

export function useKeyboardOverlap() {
  const [overlap, setOverlap] = useState(0);
  const frame = useRef(null);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (event) => {
      frame.current = event.endCoordinates;
      setOverlap(overlapOf(frame.current, Dimensions.get('window').height));
    });
    const hide = Keyboard.addListener(hideEvent, () => {
      frame.current = null;
      setOverlap(0);
    });
    const resize = Dimensions.addEventListener('change', ({ window }) => setOverlap(overlapOf(frame.current, window.height)));
    return () => {
      show.remove();
      hide.remove();
      resize.remove();
    };
  }, []);

  return overlap;
}
