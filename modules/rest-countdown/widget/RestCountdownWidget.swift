import ActivityKit
import SwiftUI
import WidgetKit

// RN-SPEC-time O13 + T-101 (UX ruling, amends F2): the Lock Screen card and
// the Dynamic Island show the same rest countdown. The OS ticks every timer;
// no buttons (tapping opens the app); the activity ends at zero as before.
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
        .activityBackgroundTint(RestCountdownColors.card)
        .activitySystemActionForegroundColor(RestCountdownColors.textPrimary)
    } dynamicIsland: { context in
      let interval = RestIsland.interval(context.state)
      return DynamicIsland {
        // Expanded (long press): G mark + "Rest timer" · the large countdown ·
        // the lock card's bar (remaining, no glow). Center empty.
        DynamicIslandExpandedRegion(.leading) {
          HStack(spacing: 8) {
            RestCountdownAppMark()
            Text("Rest timer")
              .font(.system(size: 15, weight: .semibold))
              .foregroundStyle(RestCountdownColors.textSecondary)
              .lineLimit(1)
          }
          .padding(.leading, 4)
          .accessibilityElement(children: .ignore)
          .accessibilityLabel("Gymido rest timer")
          .accessibilityValue(Text(timerInterval: interval, countsDown: true) + Text(" remaining"))
        }
        DynamicIslandExpandedRegion(.trailing) {
          Text(timerInterval: interval, countsDown: true)
            .font(.system(size: 34, weight: .bold))
            .monospacedDigit()
            .foregroundStyle(RestCountdownColors.gold)
            .multilineTextAlignment(.trailing)
            .lineLimit(1)
            .frame(maxWidth: .infinity, alignment: .trailing)
            .accessibilityHidden(true)
        }
        DynamicIslandExpandedRegion(.bottom) {
          RestIslandBar(interval: interval)
            .padding(.horizontal, 4)
            .padding(.top, 6)
            .accessibilityHidden(true)
        }
      } compactLeading: {
        RestCountdownAppMark(size: 20, radius: 6, fontSize: 12)
      } compactTrailing: {
        // Fixed to the widest value so the pill never jitters (m:ss, or
        // h:mm:ss from 1 h).
        Text(timerInterval: interval, countsDown: true)
          .font(.system(size: 15, weight: .semibold))
          .monospacedDigit()
          .foregroundStyle(RestCountdownColors.gold)
          .multilineTextAlignment(.trailing)
          .lineLimit(1)
          .frame(width: RestIsland.compactWidth(interval))
          // Reviewer L1: VoiceOver says the time, as the lock card (no visible "remaining").
          .accessibilityLabel("Gymido rest timer")
          .accessibilityValue(Text(timerInterval: interval, countsDown: true) + Text(" remaining"))
      } minimal: {
        // A gold ring of the REMAINING time (no digits): the OS animates it.
        ProgressView(timerInterval: interval, countsDown: true, label: { EmptyView() }, currentValueLabel: { EmptyView() })
          .progressViewStyle(.circular)
          .tint(RestCountdownColors.gold)
          .accessibilityLabel("Gymido rest timer")
          .accessibilityValue(Text(timerInterval: interval, countsDown: true) + Text(" remaining"))
      }
      .keylineTint(RestCountdownColors.gold)
    }
  }
}

enum RestIsland {
  static func interval(_ state: RestCountdownAttributes.ContentState) -> ClosedRange<Date> {
    state.startDate...max(state.startDate, state.endDate)
  }

  static func compactWidth(_ interval: ClosedRange<Date>) -> CGFloat {
    interval.upperBound.timeIntervalSince(interval.lowerBound) >= 3600 ? 64 : 42
  }
}

// The lock card's bar without the glow: 6 tall, radius-full, track 0.12,
// fill gold = remaining.
struct RestIslandBar: View {
  let interval: ClosedRange<Date>

  var body: some View {
    ProgressView(timerInterval: interval, countsDown: true, label: { EmptyView() }, currentValueLabel: { EmptyView() })
      .progressViewStyle(.linear)
      .tint(RestCountdownColors.gold)
      .scaleEffect(x: 1, y: 1.5, anchor: .center)
      .background(Capsule().fill(RestCountdownColors.track).frame(height: 6))
      .frame(height: 6)
  }
}
