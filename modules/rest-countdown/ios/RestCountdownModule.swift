import ActivityKit
import ExpoModulesCore

// RN-SPEC-time O13 (iOS): a self-ending Live Activity. Requested at rest
// start, then ended at once with .after(endDate), so iOS removes it at zero
// whatever the app's state. An ended activity can't be updated, so ±5s
// replaces it.
struct CountdownOptions: Record {
  @Field var barStartMs: Double = 0
  @Field var endMs: Double = 0
  @Field var setId: String? = nil
  @Field var token: String = ""
}

public class RestCountdownModule: Module {
  // Only the id is kept; the activity is looked up again when used, so a card
  // the system removed without a .dismissed state is detected too.
  private var currentId: String?
  private var enablementTask: Task<Void, Never>?

  public func definition() -> ModuleDefinition {
    Name("RestCountdown")

    // O13.4: turned off mid-rest ends the card; turned on starts nothing
    // for the running rest.
    OnCreate {
      self.enablementTask = Task { [weak self] in
        for await enabled in ActivityAuthorizationInfo().activityEnablementUpdates where !enabled {
          await self?.endAll()
        }
      }
    }

    OnDestroy {
      self.enablementTask?.cancel()
    }

    // O13.4: and re-checked on resume.
    OnAppEntersForeground {
      if !ActivityAuthorizationInfo().areActivitiesEnabled {
        Task { await self.endAll() }
      }
    }

    AsyncFunction("isEnabled") { () -> Bool in
      ActivityAuthorizationInfo().areActivitiesEnabled
    }

    // O13.5 D: end every Gymido rest activity first, awaited.
    AsyncFunction("start") { (options: CountdownOptions) async in
      await self.endAll()
      await self.request(options)
    }

    // O13.3 ±5s: end .immediate → request → end .after. Not if the user
    // swiped the card away, or it is otherwise gone from the system's list;
    // it stays gone for that rest. (Re-looked-up by id, ported from the
    // 28 Sep build.)
    AsyncFunction("update") { (options: CountdownOptions) async in
      guard
        let id = self.currentId,
        let activity = Activity<RestCountdownAttributes>.activities.first(where: { $0.id == id }),
        activity.activityState != .dismissed
      else {
        self.currentId = nil
        return
      }
      await activity.end(nil, dismissalPolicy: .immediate)
      self.currentId = nil
      await self.request(options)
    }

    // Every rest-clearing event and the launch sweep. Safe when none exist.
    AsyncFunction("end") { () async in
      await self.endAll()
    }

    // A2 is Android-only; iOS delivers date triggers on time.
    AsyncFunction("canScheduleExactAlarms") { () -> Bool in
      true
    }

    Function("openExactAlarmSettings") {}
  }

  private func request(_ options: CountdownOptions) async {
    // O13.4: skip silently when Live Activities are off.
    guard ActivityAuthorizationInfo().areActivitiesEnabled else {
      return
    }
    let endDate = Date(timeIntervalSince1970: options.endMs / 1000)
    // startDate <= endDate always: a ClosedRange start...end with start > end
    // traps in the card's timerInterval/ProgressView. (ported from the 28 Sep build)
    let state = RestCountdownAttributes.ContentState(
      startDate: min(Date(timeIntervalSince1970: options.barStartMs / 1000), endDate),
      endDate: endDate
    )
    let content = ActivityContent(state: state, staleDate: nil)
    do {
      let activity = try Activity.request(attributes: RestCountdownAttributes(), content: content, pushType: nil)
      await activity.end(content, dismissalPolicy: .after(endDate))
      currentId = activity.id
    } catch {
      // Best effort: O4's notification still delivers the alert.
    }
  }

  private func endAll() async {
    for activity in Activity<RestCountdownAttributes>.activities {
      await activity.end(nil, dismissalPolicy: .immediate)
    }
    currentId = nil
  }
}
