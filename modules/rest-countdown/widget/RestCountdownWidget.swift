import ActivityKit
import SwiftUI
import WidgetKit

// RN-SPEC-time O13: Lock Screen only. No Dynamic Island design; the empty
// one exists only because ActivityConfiguration requires it.
@main
struct RestCountdownWidgetBundle: WidgetBundle {
  var body: some Widget {
    RestCountdownLiveActivity()
  }
}

struct RestCountdownLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: RestCountdownAttributes.self) { context in
      RestCountdownCardView(state: context.state)
        .activityBackgroundTint(RestCountdownColors.gold)
        .activitySystemActionForegroundColor(RestCountdownColors.navy)
    } dynamicIsland: { _ in
      DynamicIsland {
        DynamicIslandExpandedRegion(.center) { EmptyView() }
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
