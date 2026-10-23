import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { createRestAlertController } from './restAlerts';
import { setSpeakRestAlerts } from './speakRestAlerts';

// Owns the rest-alert controller for one Workout session and feeds it
// AppState (O4 rules 1b, 3 and 5). Also holds A2's one-time offer dialog
// and A3's one-time "Hear your rest timer" pop-up. `hasNextSet(setId)` picks
// the spoken copy; it is read through a ref, so it sees the latest session.
export default function useRestAlerts(platform, hasNextSet = () => true) {
  const [offerOpen, setOfferOpen] = useState(false);
  const [introOpen, setIntroOpen] = useState(false);
  const hasNextSetRef = useRef(hasNextSet);
  hasNextSetRef.current = hasNextSet;
  const [controller] = useState(() =>
    createRestAlertController({
      platform,
      appState: AppState.currentState,
      onOfferExactAlarm: () => setOfferOpen(true),
      onSpeakIntro: () => setIntroOpen(true),
      hasNextSet: (setId) => hasNextSetRef.current(setId),
    })
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
    // A3: "Keep it on", back and the scrim keep it on; "Turn off" switches
    // it off. The pop-up never asks for notification permission itself.
    introOpen,
    keepSpeaking: () => setIntroOpen(false),
    turnOffSpeaking: () => {
      setIntroOpen(false);
      setSpeakRestAlerts(false);
    },
    openAnnounceSettings: () => {
      try {
        platform.openNotificationSettings?.();
      } catch {
        // C1: never let a missing settings screen crash the onPress.
      }
    },
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
