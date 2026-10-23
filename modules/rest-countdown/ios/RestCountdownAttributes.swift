import ActivityKit
import Foundation

// RN-SPEC-time O13.1. Compiled into BOTH the app (this pod) and the widget
// extension; the plugin copies this exact file, so the two never drift.
// No static fields, and no workout data: both strings live in the extension.
struct RestCountdownAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    // = endDate − totalSeconds, so the bar matches the in-app ring.
    var startDate: Date
    // The rest's end instant; also the .after(...) dismissal instant.
    var endDate: Date
  }
}
