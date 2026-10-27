import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { createRestAlertController } from './restAlerts';
import { setSpeakRestAlerts } from './speakRestAlerts';
import { sessionEntry } from './workoutSessionStore';

// Owns the rest-alert controller for one Workout session and feeds it
// AppState (O4 rules 1b, 3 and 5). Also holds A2's one-time offer dialog
// and A3's one-time "Hear your rest timer" pop-up. `hasNextSet(setId)` picks
// the spoken copy; it is read through a ref, so it sees the latest session.
// With a `sessionId` (T-59 follow-up) the controller lives in the session
// store: a remount of the screen keeps it, with its one scheduled alert and
// lock-screen countdown, and the dialogs follow the mounted screen; the
// session's end disposes it (workoutSessionStore).
export default function useRestAlerts(platform, hasNextSet = () => true, sessionId) {
  const [offerOpen, setOfferOpen] = useState(false);
  const [introOpen, setIntroOpen] = useState(false);
  const hasNextSetRef = useRef(hasNextSet);
  hasNextSetRef.current = hasNextSet;
  const [stored] = useState(() => (sessionId ? sessionEntry(sessionId) : null));
  const [controller] = useState(() => {
    if (stored?.controller) {
      return stored.controller;
    }
    // Without a session the setters are this mount's own (stable) ones.
    const listeners = stored?.listeners ?? { offer: () => setOfferOpen(true), intro: () => setIntroOpen(true) };
    const created = createRestAlertController({
      platform,
      appState: AppState.currentState,
      onOfferExactAlarm: () => listeners.offer?.(),
      onSpeakIntro: () => listeners.intro?.(),
      hasNextSet: (setId) => (listeners.hasNextSet ?? hasNextSetRef.current)(setId),
    });
    if (stored) {
      // The AppState feed lives as long as the controller, not the screen.
      const subscription = AppState.addEventListener('change', (next) => created.appStateChanged(next));
      stored.controller = created;
      stored.unsubscribe = () => subscription.remove();
    }
    return created;
  });

  useEffect(() => {
    controller.activate();
    if (stored) {
      const listeners = stored.listeners;
      const owner = {};
      Object.assign(listeners, {
        owner,
        offer: () => setOfferOpen(true),
        intro: () => setIntroOpen(true),
        hasNextSet: (setId) => hasNextSetRef.current(setId),
      });
      // Only the mount that still owns them lets go (a newer mount keeps its own).
      return () => {
        if (listeners.owner === owner) {
          Object.assign(listeners, { owner: null, offer: null, intro: null, hasNextSet: null });
        }
      };
    }
    const subscription = AppState.addEventListener('change', (next) => controller.appStateChanged(next));
    return () => {
      subscription.remove();
      controller.dispose();
    };
  }, [controller, stored]);

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
