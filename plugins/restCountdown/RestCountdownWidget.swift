import ActivityKit
import SwiftUI
import WidgetKit

// O13 (RN-SPEC-time): the rest countdown's Live Activity. The card itself is
// RestCountdownCardView.swift. Both are copied into ios/RestCountdownWidget/ by
// plugins/withRestCountdownWidget.js, with RestCountdownAttributes.swift from
// modules/rest-countdown/ios/.
//
// The activity is ended at request time with dismissal at endDate (the
// self-ending design), so it shows on the Lock Screen only, never in the
// Dynamic Island, and iOS removes it at zero.

@main
struct RestCountdownWidgetBundle: WidgetBundle {
  var body: some Widget {
    RestCountdownLiveActivity()
  }
}

struct RestCountdownLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: RestCountdownAttributes.self) { context in
      RestCountdownCardView(startDate: context.state.startDate, endDate: context.state.endDate)
      // One element: "Gymido rest timer, 1 minute 23 seconds remaining."
      .accessibilityElement(children: .ignore)
      .accessibilityLabel("Gymido rest timer")
      .accessibilityValue(
        Text(
          timerInterval: min(context.state.startDate, context.state.endDate)...context.state.endDate,
          countsDown: true
        ) + Text(" remaining")
      )
      // The Lock Screen presentation's own field: a .background() inside the
      // view would sit under the system material instead.
      .activityBackgroundTint(restCountdownBrand400)
      .activitySystemActionForegroundColor(restCountdownNavy)
    } dynamicIsland: { _ in
      // Required by the API; never shown, since an ended activity doesn't
      // appear in the Dynamic Island (owner-ruled: no island design).
      DynamicIsland {
        DynamicIslandExpandedRegion(.center) {
          EmptyView()
        }
      } compactLeading: {
        EmptyView()
      } compactTrailing: {
        EmptyView()
      } minimal: {
        EmptyView()
      }
    }
  }
}
