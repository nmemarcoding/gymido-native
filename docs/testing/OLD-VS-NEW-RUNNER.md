# Workout runner: OLD vs NEW, behaviour by behaviour

Date: 2026-10-23. Analysis only. Nothing in gymido-native was edited and nothing was run.

**Sources**
- **OLD** is the discarded backup, cloned read-only into `~/gymido-mobile-work/old-ref/repo` at `f0bb881` (fix/w1b-schedule-day-count). STATE.txt shows the uncommitted tgz holds only gradle noise and an agent-memory file, so the latest runner is the committed one. `O:` paths below are relative to `old-ref/repo/src/`.
- **NEW** is `<repo>/src/` (working tree, feature/plan-engine). `N:` paths are relative to that folder.
- **Specs**: `RN-SPEC-workout.md` (W§) and `RN-SPEC-time.md` (T§), including the owner overrides O4/O8–O13 and A1/A2, and the dated changes of 23 Oct 2026. Web code was spot-checked in `gymido/frontend/src/features/workouts/pages/WorkoutPage.jsx` (WP:) wherever the spec names a web variable.

**Verdicts**
- **SAME**: OLD and NEW behave the same.
- **NEW-BETTER**: NEW behaves better than OLD.
- **MISSING**: OLD handled it and NEW does not.
- **BROKEN**: NEW is wrong, against the spec or the web.
- **DIFFERENT-BY-SPEC**: NEW differs from OLD, and the current spec says to.

The known, already-fixed NEW bugs are not re-reported.

| # | Behaviour | OLD | NEW | Verdict | Fix needed (current spec) |
|---|---|---|---|---|---|
| 1 | Session load (six calls, per-call failure rules) | O:features/workout/WorkoutScreen.js:99-173 is an inline `loadWorkoutPage` that returns `{ok}` and uses a generation guard | N:features/workout/loadWorkoutPage.js:21-46 is a pure loader that never throws. N:screens/WorkoutScreen.js:80-110 adds the generation guard (`mine !== generation.current`) | SAME | — |
| 2 | Silent reload while a session runs (O10) | `silent = Boolean(sessionRef.current?.id)` (O:WorkoutScreen.js:108) | Same rule at the call sites: focus `load({silent: running})` (N:WorkoutScreen.js:123-128); post-PATCH, complete and abandon go through `reload={() => load({silent:true})}` (:206) | SAME | — |
| 3 | Focus behaviour (§26.1, invariants B/C/D) | `useFocusGeneration`. The runtime is not keyed on generation. `isSessionActive` is set on focus and cleared on blur (O:WorkoutScreen.js:216-221, 495-506) | `useFocusEffect`: a refetch, silent when running; blur bumps the generation and clears the flag; `isFocused` effect for B (N:WorkoutScreen.js:121-141) | SAME | — |
| 4 | Failed silent reload → ReloadErrorBar + Retry (O12 §2) | O:WorkoutScreen.js:160-168, 178-185; O:runtime/SessionParts.js:136-152 (role alert, busy state) | N:WorkoutScreen.js:103-104, 188-192; N:runtime/RuntimeParts.js:126-142 | SAME | Minor: add `accessibilityState={{disabled, busy}}` to the Retry pill (OLD had it) |
| 5 | Overlay write and reconcile (O12 §1) | `confirmWrite` is written before the reload (O:WorkoutScreen.js:261-268). Any committed reload clears the whole map; a disagreement shows the toast (:141-146; O:runtime/confirmedWrites.js:63-68) | Entries are `{fields, seq}`. Reconcile drops only entries written before the reload started, and a contradiction raises the toast (N:WorkoutScreen.js:96-102, 112-116; N:runtime/sessionMath.js:15-52) | NEW-BETTER | — (seq keeps a write made during an in-flight reload) |
| 6 | Order: PATCH → rest → overlay → reload (O12 §3) | O:runtime/SessionRuntime.js:184-210 | N:runtime/SessionRuntime.js:155-178 | SAME | — |
| 7 | Set drafts: seeding (§20.2) | Seeded synchronously in the `useState` initialiser, then on every session/stats change (O:SessionRuntime.js:57, 97-99; O:runtime/runtimeRules.js:8-24) | Starts as `{}`, then the effect seeds (N:SessionRuntime.js:71, 95-97; N:sessionMath.js:117-133). Inputs are empty for one frame | SAME | — |
| 8 | Drafts propagate down the exercise (§20.3, ⚠W19) | O:runtimeRules.js:28-39; validation clears on the first keystroke | N:sessionMath.js:137-148; N:SessionRuntime.js:221-224 | SAME | — |
| 9 | Weight input (decimal pad, placeholder, a11y label) | O:runtime/ExerciseStage.js:~100-110; the weight minimum widens at ≥640 | N:runtime/RuntimeParts.js:~266-275 | SAME | — |
| 10 | Decimal comma (locales whose decimal pad types ",") | `Number("12,5")` is NaN, so the user sees "Weight must be greater than 0." | Same (N:sessionMath.js:151-160, 163-166) | BROKEN (both) | The web's `type=number` normalises the decimal separator, so native rejects a valid weight. Normalise `','` → `'.'` before validating and before building the PATCH (§20.5: "any positive number is accepted") |
| 11 | Validation messages (§21.1) | O:runtimeRules.js:42-51, applied on "Did it" only | N:sessionMath.js:151-160; N:SessionRuntime.js:144-150 | SAME | — |
| 12 | PATCH body (§20.4) | O:runtimeRules.js:55-68 | N:sessionMath.js:163-175 | SAME | — |
| 13 | "Did it"/"Undo": pending label, disabled, overlay-read direction (O12 §4) | `pendingSetId` is cleared in the `finally` once the PATCH settles (O:WorkoutScreen.js:236-255) | Cleared on success and on failure (N:SessionRuntime.js:152-183) | SAME | — |
| 14 | Double-tap guard (§27) | Relies only on `disabled={isPending}`, which needs a re-render | Same (N:RuntimeParts.js:239, 294) | SAME | Optional hardening: a `useRef` in-flight guard at the top of `toggleSet`, because two taps in one frame both send |
| 15 | Which set is "next" / unlocked (§19.3, §27, O12 lists `firstPendingSetId`) | The global first pending set across the whole session (O:SessionRuntime.js:129, 359-361) | Global `firstPendingKey` (N:SessionRuntime.js:90, 274-275) | BROKEN (both) | The web uses the first pending set **of the viewed exercise** (WP:576, 653, 659). So browsing to a later exercise unlocks its first set (a busy machine can be skipped), but native locks it with "Finish the previous set first". Compute `isNext` from `exercise.sets.find(s => !s.is_completed)` of the viewed exercise. Keep `nextSetKey` (rest/scroll) global as it is now |
| 16 | Lock reason (tooltip/hint) | "Rest timer running…" on every locked row while a rest runs (O:SessionRuntime.js:372) | The rest copy appears only on the next row during rest, otherwise "Finish the previous set first" (N:SessionRuntime.js:283) | DIFFERENT-BY-SPEC | — (§19.3 wording) |
| 17 | Keyboard closes on "Did it"/"Undo" (web: the button takes focus) | `Keyboard.dismiss()` in the action's onPress (O:ExerciseStage.js:134). Button, WebButton, Select and DateInput also dismiss (commit abd0fdc) | No `Keyboard.dismiss` anywhere in N:src. The keyboard stays up through the toggle, the rest widget expanding and the scroll | MISSING | Call `Keyboard.dismiss()` before `onToggle` in SetRow (N:RuntimeParts.js:295). Restore the same behaviour in the shared Select, which was changed in this branch, and in the brand buttons |
| 18 | Keyboard covering lower rows (iOS) | Not handled in the session ScrollView | Not handled; `keyboardShouldPersistTaps="handled"` only (N:SessionRuntime.js:246-254) | SAME (gap in both) | Add `automaticallyAdjustKeyboardInsets` (iOS) on the session ScrollView, as CreateProfileScreen does. Android already resizes |
| 19 | Auto-scroll to the next set (§22.3) | Fires only when the key changes, and clamps to `[0, contentHeight − visibleHeight]`; null when the viewport isn't measured yet (O:runtime/SessionShell.js:42-80; O:runtimeRules.js:237-243) | The effect depends on `[highlightedSetKey, visibleHeight]`; there is no clamp to the content height and no guard for `visibleHeight === 0` (N:SessionRuntime.js:115-128) | BROKEN (minor) | §22.3: fire only when the key changes. Today an Android keyboard opening (the ScrollView shrinks) re-centres on the highlighted row and can pull a different focused input under the keyboard. Drop `visibleHeight` from the deps (read it from a ref) and clamp to `contentHeight − visibleHeight` |
| 20 | Highlight ring + ⚠W24 (next set in an unmounted exercise does nothing) | O:SessionShell.js:46-50 | N:SessionRuntime.js:119-121 | SAME | — |
| 21 | Rest start: opens expanded, re-expands at ≤10 s | Minimized, then the effect expands once per setId and again at ≤10 (O:runtime/useRestTimer.js:75-86, 186-198) | `start` minimizes, then the effect expands on a new setId and at ≤10 (N:runtime/useRestTimer.js:28-31, 49-68) | SAME | — (T§7.2 dated correction 23 Oct: opens **expanded**; W§22 still says "opens minimized", so the PM should align that text) |
| 22 | Rest engine: 500 ms tick, rebase on ±5, wall clock | O:useRestTimer.js:111-146 | N:useRestTimer.js:39-87; N:runtime/restEngine.js | SAME | — |
| 23 | ±5 s, and −5 s to zero (silent, no `onRestComplete`, ⚠T10) | OLD guesses "natural" from `Date.now() >= endMs − 1000` (O:useRestTimer.js:148-183), which can misclassify | Separate explicit paths: a −5 to 0 → `setTimer(null)` → `restCleared`; natural end only inside the interval (N:useRestTimer.js:57-61, 69-82) | NEW-BETTER | — |
| 24 | Skip rest | Highlight next, then clear (O:useRestTimer.js:103-109) | N:SessionRuntime.js:326-329 | SAME | — |
| 25 | Natural end → alert once per set, then `onRestComplete` | `alertedRef` holds only the last setId | `alerted` is a Set of every setId ever (N:useRestTimer.js:21, 73-77) | DIFFERENT (minor) | Un-doing set A and re-completing it gives no beep, vibration or banner at the end of that second rest, and its O4 schedule is cancelled via `restCleared`. The web keeps one ref (`restAlertedSetIdRef`). Track the last setId only, as OLD did |
| 26 | Rest widget drag (4 pt threshold, 8 pt safe-area clamp, re-clamp per tick, no release animation, controls excluded) | O:runtime/Overlays.js:45-133; O:runtime/timerDrag.js. Uses a control-held lock and the overlay bounds from onLayout | N:runtime/RuntimeOverlays.js:89-201. A stable PanResponder (`useMemo([])` plus a latest ref); expanded size is `min(288, width − 24)` | NEW-BETTER | — |
| 27 | Widget position: survives later rests, resets when the session ends | Reset by an effect on `sessionId` (O:useRestTimer.js:239-245) | Resets because SessionRuntime unmounts at the end of the session | SAME | — |
| 28 | Up-next card (+O11, two lines) | O:SessionRuntime.js:133-142; O:runtime/SessionParts.js:175-206 | N:SessionRuntime.js:230, 296-302; N:RuntimeParts.js:155-182 (RemoteImage) | SAME | — |
| 29 | "Last exercise — finish strong" | Requires `viewing === active` (O:SessionRuntime.js:144-145) | `activeIndex >= 0 && no later incomplete`, with **no viewing check** (N:SessionRuntime.js:231, 303) | BROKEN | The web: `isViewingActive && nextIncomplete === null && activeIdx !== -1` (WP:574). NEW shows the note while browsing an earlier exercise. Add `isActiveView &&` |
| 30 | `isViewingActive` when all sets are done (activeIdx −1) | `activeIdx === -1` counts as viewing active, so the eyebrow says "Current exercise" | `viewing === activeIndex` is false, so the eyebrow says "Exercise n of n" (N:SessionRuntime.js:229, 270) | DIFFERENT (minor) | The web maps −1 → the last index (WP:572). `isActiveView = viewing === (activeIndex === -1 ? exercises.length − 1 : activeIndex)`. It is visible when auto-complete fails or is in flight |
| 31 | Auto-advance to the active exercise (§26) | O:SessionRuntime.js:111-116 | N:SessionRuntime.js:99-104 | SAME | — |
| 32 | Browsing bar + Resume (§19.4) | O:SessionRuntime.js:346-348 | N:SessionRuntime.js:268 | SAME | — |
| 33 | Exercise nav (bottom, §19.8): segments, scaleX fill, swipe up | Segments 44 tall, with a viewed ring and an **active ring (1px brand-300)** and an a11y label "Exercise n: d of t sets done". The PanResponder is created once, with the callback held in a ref (O:SessionRuntime.js:455-509; O:runtime/NavSegment.js) | No active-segment ring; the label is only "Exercise n". The swipe PanResponder is `useMemo([onOpenSheet])`, and `onOpenSheet` is an inline arrow, so it is **recreated on every render**. The runtime re-renders every 1 s (elapsed) and every 500 ms (rest) (N:runtime/ExerciseNavigation.js:40-95; N:SessionRuntime.js:317) | BROKEN (flaky) + MISSING | When the PanResponder is recreated mid-gesture, the new instance's `gestureState.dy` starts from 0, so slow swipes intermittently fail to open the sheet. Create it once (`useRef`) and read `onOpenSheet` from a ref. Restore the web's `ring-1 ring-brand-300` on the active, non-viewed segment, and the done/total a11y label |
| 34 | Exercise sheet: filter persistence (⚠W22), current = ACTIVE, select closes | O:runtime/ExerciseSheet.js (Modal slide, no drag-dismiss) | N:ExerciseNavigation.js:97-206. Adds header drag-to-dismiss, sheetUp/fade and reduced motion | NEW-BETTER, with a caveat | `headerPan` is `useMemo([drag, onClose])` with an inline `onClose`, so it is recreated every second. A drag can jump, and there is no `onPanResponderTerminate`, so if the parent ScrollView takes the gesture the panel is left part-way down. Create it once with ref callbacks and add a terminate handler that springs back to 0 |
| 35 | Muscle filter chips (navy active, "All" first) | SAME | N:ExerciseNavigation.js:170-190 | SAME | — |
| 36 | ExerciseStage image | Plain `Image`; the well is hidden on `onError` (O:ExerciseStage.js:183, 214-223) | Plain `Image`; no error handling and no Drive fallbacks, so a failed or Drive URL leaves an empty 176/224 pt gradient well (N:RuntimeParts.js:208-214) | MISSING | The web stage uses `RemoteImage` (frontend ExerciseStage.jsx:1, 55). Use the shared `RemoteImage` (Drive variants, no referrer) here, as UpNext and the sheet already do |
| 37 | ExerciseStage notes (dated change, 23 Oct) | Not shown | Shown under the name (N:RuntimeParts.js:191, 200) | DIFFERENT-BY-SPEC | — |
| 38 | Reps label "12 reps" when ends equal (23 Oct) | "12–12 reps" (O:runtimeRules.js:184-189) | N:sessionMath.js:178-185 | DIFFERENT-BY-SPEC | — |
| 39 | Singular "set" for counts of 1 (23 Oct) | Always "sets" | `setsWord` everywhere (N:sessionMath.js:196) | DIFFERENT-BY-SPEC | — |
| 40 | Complete workout, manual (§23.1): snapshot first, clear timer and highlight, spinner | O:WorkoutScreen.js:270-285; O:SessionRuntime.js:392-409 | N:SessionRuntime.js:186-202; N:RuntimeOverlays.js:356-380 (spinner) | SAME | — |
| 41 | Auto-complete (⚠W13) | The effect depends on `isCompleting`, so a **failed** completion re-fires it immediately in a POST loop (O:SessionRuntime.js:119-127) | Depends only on the counts, with a ref guard; a failure doesn't re-fire (N:SessionRuntime.js:132-139). Matches the web's deps (WP:526-536) | NEW-BETTER | — |
| 42 | Completion popup survives the session → hub switch (§23.2) | **One** instance at a fixed position beside `body`, so it never remounts. This fixed the iOS "popup flashes about 1 s and vanishes" bug (W2 iOS, 2026-10-08) (O:WorkoutScreen.js:336-341, 453-460) | `popupLayer` is rendered in two different parents: a Fragment beside SessionRuntime (N:WorkoutScreen.js:199-218) and inside `<ShellPage>` on the hub (:222-240). When the session clears, the Modal unmounts and a new one mounts | BROKEN (regression of a fixed iOS bug) | Render the popup once outside both branches (e.g. `return <>{branch}{popupLayer}</>`), so the same Modal instance stays mounted across the switch. Re-verify W2 on iOS |
| 43 | Popup dismissed on blur (§26.1) | O:WorkoutScreen.js:227 | N:WorkoutScreen.js:144-148 | SAME | — |
| 44 | Discard dialog (§24): Android back = Keep going; clears rest and highlight | O:runtime/Overlays.js:332-359; O:SessionRuntime.js:213-218 | N:RuntimeOverlays.js:284-307; N:SessionRuntime.js:204-217 | SAME | Spec polish in both: initial focus on "Keep going", dialog role |
| 45 | Discard clears the previous error first (O9: "cleared by the next action") | `setActionError('')` first (O:WorkoutScreen.js:288) | **Not cleared** in `handleAbandon` (N:SessionRuntime.js:204-217). A stale "Network Error" toast stays during the abandon and then on the hub | MISSING | Add `setActionError('')` at the top of `handleAbandon` |
| 46 | Exit (chrome) → discard dialog | O:SessionRuntime.js:317 | N:SessionRuntime.js:243 | SAME | — |
| 47 | Back / swipe-back during a session | Workout was a tab root, so Back never unmounted the runtime | Workout is pushed on the Today native stack (N:features/shell/AppShell.js:70-97, gestures on, no `beforeRemove`/BackHandler). Android Back or the iOS edge swipe **pops it mid-session**: a genuine unmount kills the rest, the O4 alert, the O13 countdown and the drafts. The session itself stays open server-side | DIFFERENT-BY-SPEC (2.5 nav), **PM decision** | W§ "5-tab nav" sets Back → Home, and T§7.2 D allows teardown on unmount, so this follows the spec. But nothing tells the user their running rest is gone. Options: disable the gesture while `session?.id` (`gestureEnabled:false` + `usePreventRemove`), or route Back to the discard dialog, or accept it |
| 48 | Stale-session banner (O8) | O:runtimeRules.js:166-180; O:SessionParts.js:121-131 | N:sessionMath.js:213-224; N:RuntimeParts.js:114-123 | SAME | — |
| 49 | Server errors (O9) / offline (§11) | `getWebApiErrorMessage` (O:WorkoutScreen.js:55-57) | `getServerMessage` (N:shared/api/apiError.js:24-39), same precedence | SAME | — |
| 50 | Overlay disagreement toast (O12 §1 copy) | O:WorkoutScreen.js:53, 141-143 | N:WorkoutScreen.js:36, 96-101 | SAME | — |
| 51 | AppState: O4 1b re-arm on leaving, cancel on resume | O:useRestTimer.js:211-224 | N:runtime/useRestAlerts.js:14-21; N:runtime/restAlerts.js:286-299 | SAME | — |
| 52 | O4 rule 5: skip the foreground beep if the background alert already fired | `backgroundedAt < endMs <= Date.now()`. It **doesn't depend on the resume event having run** (O:useRestTimer.js:166-176) | `deliveredWhileAway(away, endMs)` needs `away.resumedAtMs`, which is set only in the `'active'` AppState handler (N:restAlerts.js:51-53, 266-272, 295-297) | RISK (verify on device) | If the first rest tick after resume runs before the AppState `change` callback, `away` is stale. The result is a beep, plus a foreground banner that also dismisses the delivered alert, so the user gets a double alert. Decide with `backgroundedAtMs` and `now()` when `restEnded` runs (as OLD did), and keep `granted` from `lastGranted` |
| 53 | Notification permission asked at rest start, only when 'default' | Android "asked once" is tracked in AsyncStorage, because Android reports never-asked as denied+canAskAgain (O:shared/time/restAlerts.js:69-104) | `permissionState` maps `canAskAgain` → 'undetermined' (N:runtime/restAlertPlatform.js:41-46), so after **one denial** Android asks again at the next rest | DIFFERENT (residual of the known mapping fix) | The web asks only while 'default'. Persist "asked" once per install (as OLD did), or treat Android denied+canAskAgain as undetermined only until the first request |
| 54 | Beep sound / iOS silent switch | `setAudioModeAsync({ playsInSilentMode: true })` before playing (O:shared/time/restAlerts.js:224) | No audio-mode call (N:restAlertPlatform.js:60-70), so the beep is muted when the iPhone ring switch is off | MISSING (PM decision) | The spec is silent; OLD chose audible. If kept: call `setAudioModeAsync({playsInSilentMode:true})` once in `initRestAlerts` (it doesn't duck other audio by default; verify) |
| 55 | Vibration (Android `[0,200,100,200]`, iOS none) | O:restAlerts.js | N:restAlerts.js:274-276 | SAME | — |
| 56 | Foreground parity banner (silent, banner-only, `rest-timer-banner` channel) | Posted on the sound channel `rest-timer` | Separate HIGH silent channel (N:restAlertPlatform.js:27-37; N:restAlerts.js:60-73) | DIFFERENT-BY-SPEC (T§7.2 Q4, 23 Oct) | — |
| 57 | A1 remove-then-send queue, token-targeted stale cancel | O:restAlerts.js (queue, `removeRestNotifications`, tokens) | N:restAlerts.js:77-120, 156-167 | SAME | — |
| 58 | A2 exact-alarm offer (once, after the rest starts, never right after the OS prompt) | O:SessionRuntime.js:197-203 | N:restAlerts.js:197-226; dialog at N:RuntimeOverlays.js:309-354 | SAME | — |
| 59 | O13 lock-screen countdown: start/update/end, foreground-zero order, launch sweep | O:shared/time/restCountdown.js; O:useRestTimer.js:42-47, 120-133; O:App.js:29-31 | N:restAlerts.js:169-283; N:shared/time/restCountdown.js; N:App.js:17-21 | SAME | — |
| 60 | Rest torn down only on genuine unmount (D) | O:useRestTimer.js:228-234 | N:useRestTimer.js:90-97; N:useRestAlerts.js:17-20 | SAME | — |
| 61 | Elapsed "Time" tile | Raw `new Date`, clamped ≥0 | `parseTimestamp` (dated change B, UTC end to end); negative values are handled by `formatDuration` (N:runtime/useElapsedTimer.js) | DIFFERENT-BY-SPEC | — |
| 62 | Reduced motion (StatTile popIn, rail, nav fill, countdown pulse, sheet, popup) | All gated | All gated (N:RuntimeParts.js:41-78; N:ExerciseNavigation.js:17-28, 112-115; N:RuntimeOverlays.js:63-86, 207-216) | SAME | — |
| 63 | Tablet / landscape layout | The session column is capped at `MOBILE_COLUMN_MAX_WIDTH` 430 and centred, with `insets.left/right` added (O:SessionShell.js:101-110) | No max width: on an iPad the runtime stretches full width, even though the hub (ShellPage) is capped at 430. No left/right insets (N:SessionRuntime.js:233-267) | MISSING | W§19.6 (deferred): "at every width the runtime uses the phone layout". Wrap the header, scroll content and nav in a centred `maxWidth: 430` column (the nav inner is already 460), and add the side insets for iPad landscape |
| 64 | Gradient crash guards (§19.10, app-shell §1.0) | SVG GradientFill mounted only while "next" or actionable (O:ExerciseStage.js:61-72, 148-157) | Every gradient is always mounted and only revealed by opacity, so no state change creates a drawable (N:RuntimeParts.js:236-305) | NEW-BETTER | — |
| 65 | Route crash boundary | O:shared/components/RouteErrorBoundary.js | Present in N:shared/components/RouteErrorBoundary.js | SAME | — |
| 66 | E2E testIDs | `set-row-{exId}:{setId}`, `nav-segment-{id}`, `completion-dismiss`, `rest-timer-layer/drag` | `set-row-{setId}`, `exercise-nav-segment-{index}`, `completion-awesome`, `rest-timer` | INFO | Any OLD Maestro W1/W2 flow reused against NEW must be updated to the new IDs |

## Short list for the PM

**MISSING / BROKEN in NEW (fix first, most important at the top)**
1. #42: the completion popup is rendered in two parents, so it remounts on the session → hub switch. This brings back the iOS bug OLD had fixed, where the popup flashes and vanishes.
2. #15: "next/unlocked" is computed globally instead of per viewed exercise, which differs from the web (`firstPendingSetId`). You can't log a later exercise out of order. OLD had the same bug.
3. #17: no `Keyboard.dismiss()` on "Did it"/"Undo" (or on Select and buttons), so the keyboard stays up. OLD had it.
4. #33 and #34: the swipe-up nav and the sheet drag recreate their PanResponder on every render (the runtime ticks every 0.5–1 s), so the gestures are flaky. The sheet drag also has no terminate reset. The nav is also missing its active-segment ring and done/total a11y label.
5. #29: "Last exercise — finish strong" shows while browsing other exercises. #30: the eyebrow reads wrong when all sets are done.
6. #45: `handleAbandon` doesn't clear the previous `actionError`.
7. #19: the auto-scroll re-fires when the viewport height changes (keyboard), and it isn't clamped to the content.
8. #36: the stage image has no RemoteImage/Drive fallback and no error handling, so an empty 176 pt well can show.
9. #63: on tablets the runtime is not capped to the phone column (OLD capped it at 430).
10. #25: re-completing the same set never alerts again (a Set of all setIds instead of the last one).
11. #52 (risk): the O4 rule 5 skip depends on the resume event's order and can double-alert. Verify on device.
12. #53: Android re-asks for notification permission after one denial (OLD had an asked-once guard).
13. #10: a decimal-comma weight is rejected (both OLD and NEW).
14. #18: the iOS keyboard covers lower set rows (both OLD and NEW).

**DIFFERENT-BY-SPEC (the PM should know)**
- #47: Back or swipe-back now pops Workout mid-session (2.5 nav), which kills the running rest, its alerts and countdown, and the drafts without warning. **This needs a ruling.**
- #54: NEW's beep obeys the iOS silent switch; OLD forced it audible. The spec is silent, so this needs a ruling.
- #21: the widget opens expanded (T§7.2, 23 Oct correction). W§22 still says "opens minimized", so the spec text should be aligned.
- #37 notes under the exercise name, #38 "12 reps", #39 singular "set" (23 Oct dated changes).
- #16: the lock copy is exact per §19.3. #56: Android uses its own silent banner channel (Q4). #61: elapsed parses as UTC (change B).
- NEW-BETTER over OLD: #5 seq-based reconcile, #23 explicit −5 s path, #26 stable drag with a width clamp, #34 sheet drag/animations, #41 no auto-complete POST loop on failure, #64 always-mounted gradients.

---

# Extra scope: the latest OLD rest implementation, and how it differs from NEW

## Where the latest OLD code lives
- **Bundle.** All three branches hold identical copies of these files. `git diff cd75295 f0bb881` over `modules`, `plugins`, `src/features/workout`, `src/shared/time`, `App.js` and `app.config.js` is empty. The newest commit touching them is **`e221090` (2026-10-21)**: "ask for the notification permission on Android 13+", which changed `restAlerts.js`. The native module, widget and plugin come from **`d334a6d` (2026-09-29)**, which is the 28 Sep device-run state committed the next day. The JS runtime comes from `6bb80fb` (2026-09-29), with later fixes in `5f7c776` and `e221090`.
- **Uncommitted tgz / STATE.txt.** These hold only `.gradle` cache noise and `.claude/agent-memory/mobile.md`. There is no rest code in them.
- **`gymido-native/ios/RestCountdownWidget/` leftovers.** These are **not** the old spike. Every file is dated **Oct 23 08:56–08:57** (today's prebuild). `RestCountdownWidget.swift` and `RestCountdownCardView.swift` are byte-identical to NEW's `modules/rest-countdown/widget/*`, and `RestCountdownAttributes.swift` is identical to NEW's `modules/rest-countdown/ios/` copy. Prebuild overwrote the old spike files, so the bundle is the only source for them.
- **Plain copies (nothing executed)** are in `~/gymido-mobile-work/old-ref/port-candidates/`, with relative paths preserved (29 files). Below, `PC/` = that folder.

## 1. Rest timer logic (start, ±5, skip, end, auto-advance)
**OLD files**
- `PC/src/features/workout/runtime/useRestTimer.js`: the engine plus O4 and O13 wiring in one hook.
- `PC/src/features/workout/runtime/SessionRuntime.js`: `handleToggle` start/clear, auto-complete, discard.
- `PC/src/features/workout/runtime/runtimeRules.js`: `nextSetKeyAfter`, `clampTimerPosition`, `centeredScrollOffset`.
- `PC/src/features/workout/runtime/timerDrag.js` and `Overlays.js`: the widget and its drag.

**Diff vs NEW** (`runtime/useRestTimer.js`, `restEngine.js`, `SessionRuntime.js`, `RuntimeOverlays.js`)
```
- OLD: one hook does the engine AND calls notifications/countdown directly
+ NEW: engine (useRestTimer + pure restEngine) reports restStarted/endMoved/restCleared/restEnded
+      to a controller (restAlerts.createRestAlertController); notifications are not in the hook
- OLD: natural vs −5 end guessed in a separate effect: total>0 && now >= endMs−1000
+ NEW: natural end detected inside the interval; −5→0 is its own branch (no misclassification)
- OLD: alertedRef = last setId only
+ NEW: alerted = Set of every setId (re-completing a set never alerts again; see row #25)
- OLD: skip lives in the hook (skipRestTimer: highlight, then clear)
+ NEW: skip is inline in SessionRuntime (setHighlightedSetKey(nextSetKey); rest.clear())
- OLD: widget position reset by a sessionId effect
+ NEW: reset by SessionRuntime unmounting at the end of the session
- OLD: drag = PanResponder with a control-held lock and overlay bounds from onLayout; 288 fixed
+ NEW: stable PanResponder (useMemo [] + latest ref); size min(288, width−24); controls excluded by responder bubbling
= the same: 500 ms wall-clock tick, rebase when |Δ|>1, ±5 maths, opens expanded and re-expands at ≤10 s,
  ⚠W20 lock, auto-advance effect, nextSetKey across the whole session
```
**Port:** none needed. NEW is equal or better. Only bring back the "last setId" alert ref (#25).

## 2. Rest-end alerts (background/foreground notifications, channels, permission, sound, vibration)
**OLD files**
- `PC/src/shared/time/restAlerts.js`: handler, channel, permission (with an AsyncStorage "asked once"), A1 queue, tokens, `playRestDoneAlert`.
- `PC/src/shared/time/exactAlarmOffer.js`: A2.
- `PC/src/features/workout/runtime/useRestTimer.js`: AppState 1b/3/5.
- `PC/src/App.js`: `configureRestNotifications()` + launch sweep.
- `PC/assets/rest-done.wav`.
- Tests: `PC/src/shared/time/__tests__/{restAlerts,exactAlarmOffer}.test.js`, `PC/src/features/workout/__tests__/restNotifications.test.js`.

**Diff vs NEW** (`runtime/restAlerts.js`, `restAlertPlatform.js`, `useRestAlerts.js`)
```
- OLD: module-level singletons calling expo directly
+ NEW: pure controller + injected platform (restAlertPlatform) → testable, disposable per session
- OLD: setAudioModeAsync({ playsInSilentMode: true }) before every beep
+ NEW: no audio mode set → beep muted by the iOS ring/silent switch                         (row #54)
- OLD: Android "asked once": AsyncStorage gymido.notificationPermissionAsked; never re-asks
+ NEW: permissionState maps denied+canAskAgain → 'undetermined' → re-asks at the next rest after a denial (row #53)
- OLD: O4 rule 5 = backgroundedAt < endMs <= Date.now() (independent of resume-event order)
+ NEW: needs away.resumedAtMs set by the 'active' AppState handler → possible double alert  (row #52)
- OLD: one Android channel 'rest-timer' (HIGH, vibration [0,200,100,200]); the foreground banner also posts on it
+ NEW: 'rest-timer' (HIGH, default sound) + 'rest-timer-banner' (HIGH, silent, no vibration) per T§7.2 Q4 — matches spec
- OLD: scheduled content carries channelId (Android) / sound 'default' (iOS only)
+ NEW: sound 'default' on the scheduled content; channelId on the trigger
- OLD: vibration is part of playRestDoneAlert, always on Android
= NEW: vibration in controller.restEnded (Android only), skipped on the rule-5 path (as OLD)
- OLD: sendRestEndNotification bails if endMs <= now
+ NEW: no such guard in notifier.send (callers only send for a running rest; low risk)
- OLD: rest-done.wav at assets/rest-done.wav
+ NEW: assets/sounds/rest-done.wav — the bytes DIFFER (cmp at byte 49). Re-check it is the T§7.2 recipe
       (880 Hz + 1175 Hz at 0.30 s, 0.26 s each, 16-bit 44.1 kHz mono, 0.56 s)
= the same: REST_NOTIFICATION_ID 'gymido.rest', kind/source/token data, the remove-then-send serial queue,
  token-targeted stale cancel, rule-4 handler keyed on source, A2 gate + key 'gymido.exactAlarmOffered'
```
**Port:** (a) `setAudioModeAsync({playsInSilentMode:true})`, if the PM keeps OLD's audible choice; (b) the asked-once guard; (c) OLD's rule-5 condition.

## 3. iOS Live Activity + widget extension, and the Android ongoing countdown (O13, 28 Sep state)
**OLD files**
- iOS module: `PC/modules/rest-countdown/ios/{RestCountdownModule.swift, RestCountdownAttributes.swift, RestCountdown.podspec}`
- Widget sources: `PC/plugins/restCountdown/{RestCountdownWidget.swift, RestCountdownCardView.swift}`. There is no GymidoMark PNG in the repo, so the old card used the SF Symbol `timer` fallback.
- Config plugin: `PC/plugins/withRestCountdownWidget.js`, plus `PC/plugins/withoutPushCapability.js` (strips `aps-environment` and `remote-notification`).
- Android: `PC/modules/rest-countdown/android/{build.gradle, src/main/java/app/gymido/restcountdown/RestCountdownModule.kt}`
- JS: `PC/modules/rest-countdown/index.js`, `PC/src/shared/time/restCountdown.js` (queue-wrapped wrapper)
- Test: `PC/plugins/__tests__/restCountdownPrebuild.test.js` (pins "no App Group / no aps-environment")
- Config: `PC/app.config.js` (plugin order, `android.permissions: SCHEDULE_EXACT_ALARM`)

**Diff vs NEW** (`modules/rest-countdown/**`, `plugins/withRestCountdownWidget.js`, `src/shared/time/restCountdown.js`)
```
JS bridge
- OLD: native.start(barStartMs, endMs, setId, token) — positional; update(barStartMs, endMs, token)
+ NEW: native.start({barStartMs, endMs, setId, token}) — a Record on both platforms (consistent in NEW; don't mix)
- OLD: wrapper enqueues every call on A1's queue itself; start = removeRestNotifications + end + start
+ NEW: thin wrapper; the controller enqueues (notifier.run), with end → start when rest?.setId still matches
- OLD: canScheduleExactAlarms is a sync Function
+ NEW: an AsyncFunction (both platforms) — the JS awaits it, fine

iOS module
- OLD: ContentState.startDate = min(barStart, end)   (clamped in the module)
+ NEW: not clamped in the module; the card clamps its interval instead (start...max(start,end))
- OLD: ±5 replace looks the card up again in Activity.activities by id (gone → no re-request)
+ NEW: keeps the Activity object; checks activityState != .dismissed (a card removed without
       being dismissed is not detected — minor)
- OLD: public struct + public init() on RestCountdownAttributes
+ NEW: internal struct (fine: each target compiles its own copy)

Widget
- OLD: accessibility (label "Gymido rest timer", value "… remaining") on the Live Activity view
+ NEW: the same, moved into the card view
- OLD: GymidoMark with a UIImage(named:) check → SF Symbol `timer` fallback
+ NEW: Image("GymidoMark") unconditionally; ships PNGs in widget/Assets.xcassets (blank if the asset is missing)
- OLD: colours as globals; NEW: enum RestCountdownColors — the same values

Config plugin
- OLD: bundle id <app>.RestCountdown; NEW: <app>.RestCountdownWidget  (changes the provisioning profile/App ID)
- OLD: hand-built target + explicit "Embed Foundation Extensions" copy phase; APPLICATION_EXTENSION_API_ONLY=YES,
       SKIP_INSTALL=YES, LD_RUNPATH_SEARCH_PATHS @executable_path/../../Frameworks, GENERATE_INFOPLIST_FILE=YES,
       INFOPLIST_KEY_CFBundleDisplayName
+ NEW: project.addTarget('app_extension') (xcode lib creates the embed phase); copies DEVELOPMENT_TEAM and the
       deployment target from the app; GENERATE_INFOPLIST_FILE=NO with a full Info.plist; NO
       APPLICATION_EXTENSION_API_ONLY / SKIP_INSTALL / LD_RUNPATH_SEARCH_PATHS → verify an Archive (SKIP_INSTALL
       missing can produce a "Generic Xcode Archive" instead of an app archive)
- OLD: Info.plist generated by the plugin (NSExtension only)
+ NEW: Info.plist checked into modules/rest-countdown/widget/
- OLD: withoutPushCapability plugin, listed LAST, removes aps-environment + remote-notification
+ NEW: NOT present. ios/Gymido/Gymido.entitlements contains aps-environment today → a FREE Apple
       personal team cannot sign the device build ("Personal development teams … do not support the
       Push Notifications capability"). OLD solved exactly this.
- OLD: restCountdownPrebuild.test.js pins no App Group / no aps-environment on any target
+ NEW: no equivalent test

Android module
- OLD: package app.gymido.restcountdown; NEW: expo.modules.restcountdown (+ androidx.core dep, its own
       AndroidManifest declaring SCHEDULE_EXACT_ALARM; OLD declared it in app.config android.permissions)
- OLD: post() returns early when endMs ≤ now (never posts an expired countdown)
+ NEW: no guard; setTimeoutAfter(max(0, …)) — timeoutAfter 0 means NO timeout, so a countdown posted late
       would count into negative time and stay ongoing until the next end(). The JS guards rest?.setId,
       so this is low risk; restoring OLD's guard costs one line
- OLD: start() cancels its own previous countdown first (belt and braces)
+ NEW: relies on the JS calling end() first (it does)
- OLD: small icon = expo meta-data default_notification_icon, else the app icon
+ NEW: drawable 'notification_icon' (expo-notifications plugin, configured in app.config), else the app icon
= the same: slot tag 'gymido.rest' id 0, channel 'rest-countdown-v2' DEFAULT/silent/public, legacy channel
  deleted, gymido.kind extra, targeted end, chronometer countdown, CATEGORY_STOPWATCH, A2 settings intent
```

## PORT PLAN (smallest safe set, in order)
1. **iOS signing blocker (do first if the owner builds with a free team).** Port `PC/plugins/withoutPushCapability.js` as is, and add it **last** in `app.config.js` plugins. Then run prebuild and confirm `aps-environment` is gone from `ios/Gymido/Gymido.entitlements`. Optionally port `PC/plugins/__tests__/restCountdownPrebuild.test.js`, adapting its paths to `modules/rest-countdown/widget/`.
2. **Widget plugin hardening.** Add `APPLICATION_EXTENSION_API_ONLY: 'YES'`, `SKIP_INSTALL: 'YES'` and OLD's `LD_RUNPATH_SEARCH_PATHS` to NEW's `withWidgetTarget` build settings. Decide the extension bundle suffix (`.RestCountdown` was OLD; `.RestCountdownWidget` is NEW). Changing it means a new App ID/profile, so pick one and keep it.
3. **Android module.** Restore OLD's `if (endMs - now <= 0) return` in `post()` (NEW `RestCountdownModule.kt:120`).
4. **iOS module (optional).** Clamp `startDate = min(barStart, end)` in `request`, and look the card up in `Activity.activities` on update, as OLD did. Restore the SF Symbol fallback in the card if the asset could ever be missing.
5. **JS alerts.** Port three small pieces, not the files: (a) the `playsInSilentMode` audio mode, **pending the PM ruling** (#54); (b) the asked-once guard from `PC/src/shared/time/restAlerts.js:69-104` into `restAlertPlatform.getPermission/requestPermission` (#53); (c) the rule-5 test `backgroundedAtMs < endMs && endMs <= now()` (#52). Check that `assets/sounds/rest-done.wav` matches the T§7.2 recipe, since it differs from OLD's file.
6. **Rest engine.** Only the "last alerted setId" change (#25). Don't port OLD's `useRestTimer`: NEW's split engine/controller is the better base.
7. **Don't port:** OLD's `restCountdown.js` wrapper (NEW's controller already queues), the positional native signatures (NEW's Records are consistent across JS/Swift/Kotlin), or OLD's `Overlays.js`/`timerDrag.js` (NEW's widget is better).
