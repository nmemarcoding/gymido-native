import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { createRestAlertController } from './restAlerts';

// Owns the rest-alert controller for one Workout session and feeds it
// AppState (O4 rules 1b, 3 and 5). Also holds A2's one-time offer dialog.
export default function useRestAlerts(platform) {
  const [offerOpen, setOfferOpen] = useState(false);
  const [controller] = useState(() =>
    createRestAlertController({ platform, appState: AppState.currentState, onOfferExactAlarm: () => setOfferOpen(true) })
  );

  useEffect(() => {
    controller.activate();
    const subscription = AppState.addEventListener('change', (next) => controller.appStateChanged(next));
    return () => {
      subscription.remove();
      controller.dispose();
    };
  }, [controller]);

  return {
    alerts: controller,
    offerOpen,
    // A2 rule 3: "Not now", Android back and the scrim just close it.
    closeOffer: () => setOfferOpen(false),
    openSettings: () => {
      setOfferOpen(false);
      try {
        platform.openExactAlarmSettings();
      } catch {
        // C1: never let a missing settings screen crash the onPress.
      }
    },
  };
}
