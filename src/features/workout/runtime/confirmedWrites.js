// [O12] §1 — the confirmed-write overlay.
//
// Under O10 a post-mutation reload is silent, so nothing covers the window in
// which the PATCH has succeeded but the reload has not yet (or never) landed.
// The web hides that window behind its skeleton or its error screen; native has
// neither, so the screen would show the pre-save row — "Did it" instead of
// "Undo", and two sets looking active at once. The overlay supplies what the app
// already knows: what the server accepted.
//
// It is applied at ONE point (`applyOverlay`) and everything is derived from
// the result, so the header count, the rail, the ring and the rows can never
// disagree with each other.

// What the PATCH sent and the server accepted. Keyed by set id.
export function overlayEntry(payload) {
  return {
    is_completed: Boolean(payload?.is_completed),
    actual_reps: payload?.actual_reps ?? null,
    actual_weight_value: payload?.actual_weight_value ?? null,
    actual_weight_unit: payload?.actual_weight_unit ?? null,
    completed_at: payload?.completed_at ?? null,
  };
}

// `sessionForRender`: each set becomes { ...serverSet, ...overlay }.
export function applyOverlay(session, confirmedSets) {
  if (!session || !confirmedSets || !Object.keys(confirmedSets).length) {
    return session;
  }
  return {
    ...session,
    exercises: (session.exercises || []).map((exercise) => ({
      ...exercise,
      sets: (exercise.sets || []).map((set) =>
        confirmedSets[set.id] ? { ...set, ...confirmedSets[set.id] } : set
      ),
    })),
  };
}

function findSet(session, setId) {
  for (const exercise of session?.exercises || []) {
    for (const set of exercise.sets || []) {
      if (set.id === setId) {
        return set;
      }
    }
  }
  return null;
}

// After a SUCCESSFUL reload. Returns whether any entry DISAGREED; the caller
// then clears the whole overlay.
//
// Clearing everything is correct, not a shortcut: every confirmed write kicks
// off its own reload and bumps the load generation, so a reload that commits is
// always the newest one, issued after the latest write — every entry is resolved
// by it. Compares `is_completed` ONLY: the server may normalise weights or reps,
// and comparing those would strand entries forever.
//   agrees            → resolved: the server has caught up
//   disagrees         → resolved: the server wins, and the caller says so
//   set not returned  → resolved silently: the session ended or moved on
export function overlayDisagrees(confirmedSets, serverSession) {
  return Object.entries(confirmedSets || {}).some(([key, entry]) => {
    const serverSet = findSet(serverSession, Number.isNaN(Number(key)) ? key : Number(key));
    return Boolean(serverSet) && Boolean(serverSet.is_completed) !== entry.is_completed;
  });
}
