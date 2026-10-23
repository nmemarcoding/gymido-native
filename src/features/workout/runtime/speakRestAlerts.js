import { create } from 'zustand';

import { getPreference, setPreference } from '../../../shared/storage/preferences';

// "Speak rest alerts" (owner request, 23 Oct 2026; native only): the spoken
// cue at rest end, default ON. Stored on the device only ('1'/'0', missing
// means on); never sent to the server, kept on logout.
export const SPEAK_REST_ALERTS_KEY = 'gymido.speakRestAlerts';

export const useSpeakRestAlerts = create(() => ({ enabled: true }));

export async function loadSpeakRestAlerts() {
  const stored = await getPreference(SPEAK_REST_ALERTS_KEY);
  useSpeakRestAlerts.setState({ enabled: stored !== '0' });
}

export function setSpeakRestAlerts(enabled) {
  useSpeakRestAlerts.setState({ enabled });
  return setPreference(SPEAK_REST_ALERTS_KEY, enabled ? '1' : '0');
}

export function isSpeakRestAlertsOn() {
  return useSpeakRestAlerts.getState().enabled;
}
