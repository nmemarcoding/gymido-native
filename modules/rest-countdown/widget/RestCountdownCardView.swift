import SwiftUI
import WidgetKit
#if canImport(UIKit)
import UIKit
#endif

// RN-SPEC-time O13.2: gold field, navy ink, every colour explicit, no
// dark-mode variant. Strings are the complete set: "Gymido", "Rest timer".
enum RestCountdownColors {
  // brand-400 #f4b400
  static let gold = Color(red: 244 / 255, green: 180 / 255, blue: 0 / 255)
  // navy #111827
  static let navy = Color(red: 17 / 255, green: 24 / 255, blue: 39 / 255)
}

struct RestCountdownCardView: View {
  let state: RestCountdownAttributes.ContentState

  private var interval: ClosedRange<Date> {
    state.startDate...max(state.startDate, state.endDate)
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      HStack(spacing: 6) {
        RestCountdownAppMark()
        Text("Gymido")
          .font(.system(size: 13, weight: .semibold))
          .foregroundStyle(RestCountdownColors.navy.opacity(0.7))
          .lineLimit(1)
      }
      HStack(alignment: .firstTextBaseline, spacing: 12) {
        Text("Rest timer")
          .font(.system(size: 17, weight: .bold))
          .foregroundStyle(RestCountdownColors.navy)
          .lineLimit(1)
        Spacer(minLength: 8)
        // Fixed width: timer text otherwise claims its widest width.
        Text(timerInterval: interval, countsDown: true)
          .font(.system(size: 40, weight: .black))
          .monospacedDigit()
          .foregroundStyle(RestCountdownColors.navy)
          .multilineTextAlignment(.trailing)
          .frame(width: 112, alignment: .trailing)
      }
      .padding(.top, 4)
      // The system linear style hides its track, and a custom style loses the
      // live progress, so the navy-15% track is drawn underneath. Tint goes
      // on the ProgressView itself.
      ProgressView(timerInterval: interval, countsDown: true, label: { EmptyView() }, currentValueLabel: { EmptyView() })
        .progressViewStyle(.linear)
        .tint(RestCountdownColors.navy)
        .background(Capsule().fill(RestCountdownColors.navy.opacity(0.15)).frame(height: 4))
        .padding(.top, 10)
    }
    .padding(16)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("Gymido rest timer")
    .accessibilityValue(Text(timerInterval: interval, countsDown: true) + Text(" remaining"))
  }
}

// The app mark, or the SF Symbol `timer` if the GymidoMark asset is missing
// from the extension bundle (a blank square otherwise). (ported from the
// 28 Sep build)
struct RestCountdownAppMark: View {
  var body: some View {
    if hasMark {
      Image("GymidoMark")
        .resizable()
        .interpolation(.high)
        .frame(width: 16, height: 16)
        .clipShape(RoundedRectangle(cornerRadius: 4))
        .overlay(RoundedRectangle(cornerRadius: 4).stroke(RestCountdownColors.navy.opacity(0.15), lineWidth: 0.5))
    } else {
      Image(systemName: "timer")
        .font(.system(size: 14, weight: .semibold))
        .foregroundStyle(RestCountdownColors.navy)
        .frame(width: 16, height: 16)
    }
  }

  private var hasMark: Bool {
    #if canImport(UIKit)
    return UIImage(named: "GymidoMark") != nil
    #else
    return false
    #endif
  }
}
