import { getPreference, setPreference } from '../../../shared/storage/preferences';

// T-105 (owner B, D1–D3; UX ruling §2 + RN-SPEC-workout dated 29 Oct 2026;
// web utils/finishEarly.js): the "Finish early?" messages. {sets} = "1 set"
// or "{n} sets", {n} = the number. The emoji is last and decorative: it is
// kept apart so the screen-reader text leaves it out.
export const FINISH_EARLY_MESSAGES = Object.freeze([
  { text: 'Leaving already? {sets} to go. Future you will thank you.', emoji: '💪' },
  { text: 'Only {sets} left. Finish strong.' },
  { text: 'Strong people finish what they start. {sets} to go.' },
  { text: "You started, and that's the hard part. {sets} left, you've got this." },
  { text: 'Every set counts. {n} more and today is a win.', emoji: '🏆' },
  { text: 'Your goals are watching. {sets} left.', emoji: '👀' },
  { text: "Don't stop now, you're on fire! {sets} to go.", emoji: '🔥' },
  { text: 'One more push. {sets} between you and done.' },
  { text: 'Progress loves consistency. Just {sets} to go.' },
  { text: 'You showed up. Now finish it. {sets} left.' },
]);

export const LAST_MESSAGE_KEY = 'gymido.finishEarly.lastMessage';

export function setsLeftText(n) {
  return n === 1 ? '1 set' : `${n} sets`;
}

// { text, emoji, label }: `text` with the counts filled in, `label` = what a
// screen reader says (the text, no emoji).
export function finishEarlyMessage(index, n) {
  const message = FINISH_EARLY_MESSAGES[index];
  const text = message.text.replace('{sets}', setsLeftText(n)).replace('{n}', String(n));
  return { text, emoji: message.emoji ?? null, label: text };
}

// A random index that is NOT `last` (any index when there is none).
// `random` is injectable so tests are deterministic.
export function pickMessageIndex(last, random = Math.random) {
  const count = FINISH_EARLY_MESSAGES.length;
  const valid = Number.isInteger(last) && last >= 0 && last < count;
  if (!valid) {
    return Math.min(count - 1, Math.floor(random() * count));
  }
  const pick = Math.min(count - 2, Math.floor(random() * (count - 1)));
  return pick >= last ? pick + 1 : pick;
}

// The last shown index on the device; storage failing = memory only.
let memoryLast = null;

export async function readLastMessageIndex() {
  const stored = await getPreference(LAST_MESSAGE_KEY);
  const value = stored == null ? NaN : Number(stored);
  if (Number.isInteger(value)) {
    memoryLast = value;
  }
  return memoryLast;
}

export function saveLastMessageIndex(index) {
  memoryLast = index;
  setPreference(LAST_MESSAGE_KEY, String(index));
}

export function resetFinishEarlyMemory() {
  memoryLast = null;
}
