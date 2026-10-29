import SwiftUI
import WidgetKit

// UX F2 "Lock screen (native)" (RN-SPEC-v2-phase3 §4, LOOK per F2): dark
// glass card, gold digits, gold bar = time remaining. Every colour explicit,
// no dark-mode variant. Strings are the complete set: "Gymido", "Rest timer"
// (no visible "remaining": it lives only in the VoiceOver value).
enum RestCountdownColors {
  // color-gold #FFC21A
  static let gold = Color(red: 255 / 255, green: 194 / 255, blue: 26 / 255)
  // color-on-gold #0A0B0F
  static let onGold = Color(red: 10 / 255, green: 11 / 255, blue: 15 / 255)
  // color-text-primary #F5F6F8
  static let textPrimary = Color(red: 245 / 255, green: 246 / 255, blue: 248 / 255)
  // color-text-secondary #B4B9C3
  static let textSecondary = Color(red: 180 / 255, green: 185 / 255, blue: 195 / 255)
  // Card tint rgba(18,20,26,0.9) (F2 code-wins note).
  static let card = Color(red: 18 / 255, green: 20 / 255, blue: 26 / 255).opacity(0.9)
  // Bar track rgba(255,255,255,0.12).
  static let track = Color.white.opacity(0.12)
}

struct RestCountdownCardView: View {
  let state: RestCountdownAttributes.ContentState

  private var interval: ClosedRange<Date> {
    state.startDate...max(state.startDate, state.endDate)
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      HStack(spacing: 10) {
        RestCountdownAppMark()
        Text("Gymido")
          .font(.system(size: 14, weight: .semibold))
          .foregroundStyle(RestCountdownColors.textPrimary)
          .lineLimit(1)
        Spacer(minLength: 8)
        Text("Rest timer")
          .font(.system(size: 13))
          .foregroundStyle(RestCountdownColors.textSecondary)
          .lineLimit(1)
      }
      // 60/60/700 -0.055em, tabular. Stays gold in the last 10 s (the app
      // cannot recolour an OS-ticking timer; UX ruling).
      Text(timerInterval: interval, countsDown: true)
        .font(.system(size: 60, weight: .bold))
        .monospacedDigit()
        .tracking(-3.3)
        .foregroundStyle(RestCountdownColors.gold)
        .lineLimit(1)
        .multilineTextAlignment(.leading)
        .padding(.top, 12)
      // countsDown: the fill shrinks as the rest runs (fill = remaining). The
      // system linear style hides its track, and a custom style loses the
      // live progress, so the track is drawn underneath. Tint goes on the
      // ProgressView itself.
      ProgressView(timerInterval: interval, countsDown: true, label: { EmptyView() }, currentValueLabel: { EmptyView() })
        .progressViewStyle(.linear)
        .tint(RestCountdownColors.gold)
        .scaleEffect(x: 1, y: 2, anchor: .center)
        .shadow(color: RestCountdownColors.gold.opacity(0.7), radius: 6)
        .background(Capsule().fill(RestCountdownColors.track).frame(height: 8))
        .frame(height: 8)
        .padding(.top, 12)
    }
    .padding(18)
    .background(
      // Gold wash: radial(120% 80% at 100% 0%, rgba(255,194,26,0.18)).
      RadialGradient(
        colors: [RestCountdownColors.gold.opacity(0.18), .clear],
        center: .topTrailing,
        startRadius: 0,
        endRadius: 320
      )
    )
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("Gymido rest timer")
    .accessibilityValue(Text(timerInterval: interval, countsDown: true) + Text(" remaining"))
  }
}

// G mark: 28x28, radius 8, solid gold, "G" on-gold 14/700.
struct RestCountdownAppMark: View {
  var body: some View {
    Text("G")
      .font(.system(size: 14, weight: .bold))
      .foregroundStyle(RestCountdownColors.onGold)
      .frame(width: 28, height: 28)
      .background(RoundedRectangle(cornerRadius: 8).fill(RestCountdownColors.gold))
      .accessibilityHidden(true)
  }
}
