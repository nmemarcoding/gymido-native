// RN-SPEC-time §7.2 rest engine maths, pure so it can be tested.

export function elapsedWholeSeconds(startMs, now) {
  return Math.floor((now - startMs) / 1000);
}

export function remainingSeconds(total, startMs, now) {
  return Math.max(0, total - elapsedWholeSeconds(startMs, now));
}

// A state change that moved secondsLeft by more than 1 from the wall-clock
// value (the ±5 s buttons) rebases the total.
export function rebasedTotal(secondsLeft, total, startMs, now) {
  const elapsed = elapsedWholeSeconds(startMs, now);
  return Math.abs(secondsLeft - (total - elapsed)) > 1 ? secondsLeft + elapsed : total;
}

// −5 s → max(0, s − 5); +5 s → s + 5 and the total grows to at least it.
export function adjustTimer(timer, delta) {
  const secondsLeft = Math.max(0, timer.secondsLeft + delta);
  return { ...timer, secondsLeft, totalSeconds: Math.max(timer.totalSeconds, secondsLeft) };
}

export function formatClock(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
