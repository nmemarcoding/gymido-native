import { CommonActions, usePreventRemove } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';

import { routes } from '../../../navigation/routes';

// RN-SPEC-workout dated change (23 Oct 2026, owner ruling, native-only):
// while a session is active, a system Back asks "Leave workout?" first.
// - beforeRemove (usePreventRemove) covers the iOS edge swipe-back, the
//   header back and Android Back when the stack can pop.
// - BackHandler covers Android Back when there is nothing to pop (Workout at
//   the root of its stack), where no beforeRemove would fire.
// Nothing is intercepted without a session. The app's own exits (complete,
// discard) clear the session first, so they are never blocked.
export default function useLeaveWorkoutGuard({ isActive, isFocused, navigation }) {
  const [open, setOpen] = useState(false);
  const pending = useRef(null);

  usePreventRemove(isActive, ({ data }) => {
    pending.current = data.action;
    setOpen(true);
  });

  useEffect(() => {
    if (!isActive || !isFocused) {
      return undefined;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (navigation.canGoBack()) {
        // The pop goes through beforeRemove above, which opens the dialog.
        return false;
      }
      pending.current = CommonActions.navigate(routes.Home);
      setOpen(true);
      return true;
    });
    return () => subscription.remove();
  }, [isActive, isFocused, navigation]);

  // "Stay", the scrim and Android Back on the dialog: close, nothing else.
  const stay = useCallback(() => {
    pending.current = null;
    setOpen(false);
  }, []);

  // "Leave": replay the blocked action (a pop back to Home). Replaying the
  // same action object is not blocked again (React Navigation marks the
  // route as visited on it). The session stays active on the server.
  const leave = useCallback(() => {
    const action = pending.current;
    pending.current = null;
    setOpen(false);
    if (action) {
      navigation.dispatch(action);
    }
  }, [navigation]);

  return { open: open && isActive, stay, leave };
}
