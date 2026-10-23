import { create } from 'zustand';

import { getPreference, setPreference } from '../../../shared/storage/preferences';

// "Speak rest alerts" (owner request, 23 Oct 2026; native only): the spoken
// cue at rest end, default ON. Stored on the device only ('1'/'0', missing
// means on); never sent to the server, kept on logout.
export const SPEAK_REST_ALERTS_KEY = 'gymido.speakRestAlerts';

export const useSpeakRestAlerts = create(() => ({ enabled: true }));

// "Vibrate on rest end" (RN-SPEC-time §7.2 step 2, dated change 23 Oct
// 2026): the in-app buzz at the natural end, both platforms, default ON.
export const VIBRATE_REST_ALERTS_KEY = 'gymido.vibrateRestAlerts';

export const useVibrateRestAlerts = create(() => ({ enabled: true }));

// Loads both rest-alert switches ('0' = off; missing = on).
export async function loadSpeakRestAlerts() {
  const [speak, vibrate] = await Promise.all([getPreference(SPEAK_REST_ALERTS_KEY), getPreference(VIBRATE_REST_ALERTS_KEY)]);
  useSpeakRestAlerts.setState({ enabled: speak !== '0' });
  useVibrateRestAlerts.setState({ enabled: vibrate !== '0' });
}

export function setSpeakRestAlerts(enabled) {
  useSpeakRestAlerts.setState({ enabled });
  return setPreference(SPEAK_REST_ALERTS_KEY, enabled ? '1' : '0');
}

export function isSpeakRestAlertsOn() {
  return useSpeakRestAlerts.getState().enabled;
}

export function setVibrateRestAlerts(enabled) {
  useVibrateRestAlerts.setState({ enabled });
  return setPreference(VIBRATE_REST_ALERTS_KEY, enabled ? '1' : '0');
}

export function isVibrateRestAlertsOn() {
  return useVibrateRestAlerts.getState().enabled;
}
