import ActivityKit
import Foundation

// O13 (RN-SPEC-time): the rest countdown's data — the ONE definition. ActivityKit
// matches the app's and the widget extension's copies by type, so the config
// plugin (plugins/withRestCountdownWidget.js) copies this exact file into the
// extension at prebuild. Edit it here only.
//
// Only the two instants: no exercise or set data goes to the system for a card
// that doesn't show it (O13.1, the owner's privacy ruling). Nothing is shared
// through an App Group, which a free Apple team cannot sign.
public struct RestCountdownAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    // = endDate − totalSeconds, so the bar matches the in-app ring (O13.1).
    public var startDate: Date
    // The rest's end instant, and the .after(...) dismissal instant.
    public var endDate: Date

    public init(startDate: Date, endDate: Date) {
      self.startDate = startDate
      self.endDate = endDate
    }
  }

  public init() {}
}
