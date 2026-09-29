import ActivityKit
import ExpoModulesCore

// O13 (RN-SPEC-time): the live rest countdown on iOS — a SELF-ENDING Lock Screen
// Live Activity. Each rest requests an activity and ends it at once with
// dismissal at endDate, so iOS removes it exactly at zero whatever the app's
// state. An ended activity never appears in the Dynamic Island and can't be
// updated, so ±5s replaces it. Every call arrives through A1's serial queue on
// the JS side, one at a time.
public class RestCountdownModule: Module {
  private var enablementTask: Task<Void, Never>?

  public func definition() -> ModuleDefinition {
    Name("RestCountdown")

    // O13.4: Live Activities switched off mid-rest end the current card. Switched
    // on mid-rest, nothing starts; the next rest gets one.
    OnCreate {
      self.enablementTask = Task {
        for await enabled in ActivityAuthorizationInfo().activityEnablementUpdates where !enabled {
          await RestCountdownActivities.endAll()
        }
      }
    }

    OnDestroy {
      self.enablementTask?.cancel()
    }

    // O13.4: also re-checked on resume, so a Settings change is picked up.
    OnAppEntersForeground {
      if !ActivityAuthorizationInfo().areActivitiesEnabled {
        Task { await RestCountdownActivities.endAll() }
      }
    }

    AsyncFunction("isEnabled") { () -> Bool in
      ActivityAuthorizationInfo().areActivitiesEnabled
    }

    // setId and token are Android bookkeeping; iOS keeps nothing but the times.
    AsyncFunction("start") { (barStartMs: Double, endMs: Double, _: String, _: String) async in
      await RestCountdownActivities.endAll()
      await RestCountdownActivities.request(barStartMs: barStartMs, endMs: endMs)
    }

    AsyncFunction("update") { (barStartMs: Double, endMs: Double, _: String) async in
      await RestCountdownActivities.replace(barStartMs: barStartMs, endMs: endMs)
    }

    AsyncFunction("end") { () async in
      await RestCountdownActivities.endAll()
    }

    // A2 is Android-only: iOS delivers date-triggered notifications on time.
    Function("canScheduleExactAlarms") { () -> Bool in
      true
    }

    Function("openExactAlarmSettings") { () -> Bool in
      false
    }
  }
}

enum RestCountdownActivities {
  // The running rest's card: the only one a ±5s swap may replace.
  private static var currentId: String?

  private static func date(_ ms: Double) -> Date {
    Date(timeIntervalSince1970: ms / 1000)
  }

  // O13.3: request, then end at once with dismissal at endDate. Quietly nothing
  // when Live Activities are off (O13.4): O4's notification still alerts.
  static func request(barStartMs: Double, endMs: Double) async {
    currentId = nil
    guard ActivityAuthorizationInfo().areActivitiesEnabled else {
      return
    }
    let end = date(endMs)
    let state = RestCountdownAttributes.ContentState(startDate: min(date(barStartMs), end), endDate: end)
    let content = ActivityContent(state: state, staleDate: nil)
    do {
      let activity = try Activity.request(attributes: RestCountdownAttributes(), content: content, pushType: nil)
      await activity.end(content, dismissalPolicy: .after(end))
      currentId = activity.id
    } catch {
      // Quiet by design (O13.4).
    }
  }

  // O13.3 ±5s: end the current card immediately, then request its replacement.
  // A card the user swiped away (.dismissed, and gone from the list) stays gone
  // for this rest.
  static func replace(barStartMs: Double, endMs: Double) async {
    guard
      let id = currentId,
      let current = Activity<RestCountdownAttributes>.activities.first(where: { $0.id == id }),
      current.activityState != .dismissed
    else {
      currentId = nil
      return
    }
    await current.end(nil, dismissalPolicy: .immediate)
    await request(barStartMs: barStartMs, endMs: endMs)
  }

  // Every rest-clearing event, the new-rest step and the launch sweep. .immediate
  // also removes a card already ended with .after(endDate) (simulator-verified).
  static func endAll() async {
    for activity in Activity<RestCountdownAttributes>.activities {
      await activity.end(nil, dismissalPolicy: .immediate)
    }
    currentId = nil
  }
}
