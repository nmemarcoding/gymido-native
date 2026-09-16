import { useEffect } from 'react';
import { AppState } from 'react-native';

import { refreshOnResume, restoreSession } from './authService';

// Restores the stored session on launch and forces a token refresh whenever the
// app comes back to the foreground.
export function useAuthLifecycle() {
  useEffect(() => {
    restoreSession();

    let previousState = AppState.currentState;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (previousState !== 'active' && nextState === 'active') {
        refreshOnResume();
      }
      previousState = nextState;
    });
    return () => subscription.remove();
  }, []);
}
