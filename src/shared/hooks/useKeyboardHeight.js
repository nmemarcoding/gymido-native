import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, Platform } from 'react-native';

// Height of the on-screen keyboard (0 when hidden). Edge-to-edge Modals are
// not resized by the OS, so sheets use this to stay above the keyboard.
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
// keyboard or a short window doesn't count (T-62 panel, reviewer LOW).
export function useKeyboardOverlap() {
  const [overlap, setOverlap] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (event) =>
      setOverlap(Math.max(0, Dimensions.get('window').height - event.endCoordinates.screenY))
    );
    const hide = Keyboard.addListener(hideEvent, () => setOverlap(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return overlap;
}
