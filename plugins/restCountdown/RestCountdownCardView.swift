import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

// O13 (RN-SPEC-time): the rest countdown's Lock Screen card, as a plain SwiftUI
// view with no ActivityKit types, so it can also be rendered outside a Live
// Activity. RestCountdownWidget.swift wraps it (accessibility, the Lock Screen
// field) and scripts/snapshot-rest-countdown.sh renders it to PNGs to check
// colours, layout, copy and the bar automatically — the simulator runs Live
// Activities but never draws the Lock Screen.
//
// O13.2: no system defaults anywhere — every colour explicit, and no dark-mode
// variant (semantic colours flip to white on a dark Lock Screen).

let restCountdownBrand400 = Color(red: 244 / 255, green: 180 / 255, blue: 0 / 255)
let restCountdownNavy = Color(red: 17 / 255, green: 24 / 255, blue: 39 / 255)

struct RestCountdownCardView: View {
  let startDate: Date
  let endDate: Date

  // A closed range with end < start traps, hence the min().
  var interval: ClosedRange<Date> {
    min(startDate, endDate)...endDate
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      // 1. Identity: which app.
      HStack(spacing: 6) {
        RestCountdownAppMark()
        Text("Gymido")
          .font(.system(size: 13, weight: .semibold))
          .foregroundStyle(restCountdownNavy.opacity(0.7))
          .lineLimit(1)
      }
      // 2. Purpose and the countdown, baseline-aligned. The timer is ticked by
      // the OS with no app running; a fixed width, or it claims its widest
      // possible width and shoves the label.
      HStack(alignment: .firstTextBaseline, spacing: 12) {
        Text("Rest timer")
          .font(.system(size: 17, weight: .bold))
          .foregroundStyle(restCountdownNavy)
          .lineLimit(1)
        Spacer(minLength: 8)
        Text(timerInterval: interval, countsDown: true)
          .font(.system(size: 40, weight: .black))
          .monospacedDigit()
          .foregroundStyle(restCountdownNavy)
          .multilineTextAlignment(.trailing)
          .frame(width: 112, alignment: .trailing)
      }
      .padding(.top, 4)
      // 3. The bar, like the in-app ring. Tint on the ProgressView itself; the
      // system style hides its track colour, so the navy-15% track is drawn
      // underneath (a custom ProgressViewStyle would stop the OS animating it).
      ProgressView(
        timerInterval: interval,
        countsDown: true,
        label: { EmptyView() },
        currentValueLabel: { EmptyView() }
      )
      .tint(restCountdownNavy)
      .background(Capsule().fill(restCountdownNavy.opacity(0.15)).frame(height: 4))
      .padding(.top, 10)
    }
    .padding(16)
  }
}

// O13.2 app mark: the extension's OWN asset catalog (it can't see the app's).
// Until that image set holds artwork, the spec's fallback: SF Symbol `timer`.
struct RestCountdownAppMark: View {
  var body: some View {
    if hasMark {
      Image("GymidoMark")
        .resizable()
        .interpolation(.high)
        .frame(width: 16, height: 16)
        .clipShape(RoundedRectangle(cornerRadius: 4))
        .overlay(RoundedRectangle(cornerRadius: 4).stroke(restCountdownNavy.opacity(0.15), lineWidth: 0.5))
    } else {
      Image(systemName: "timer")
        .font(.system(size: 16))
        .foregroundStyle(restCountdownNavy)
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
