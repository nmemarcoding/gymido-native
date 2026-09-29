import AppKit
import SwiftUI
import Vision

// O13 (RN-SPEC-time): snapshot check of the Lock Screen card. The iOS simulator
// runs Live Activities but never draws the Lock Screen, so the card
// (RestCountdownCardView.swift, the same file the widget uses) is rendered here
// with ImageRenderer on its gold field, then checked: the field is gold, the
// ink is navy, and the copy reads exactly (OCR through Vision). NOT covered:
// the progress bar's fill (ImageRenderer can't draw the platform-backed
// ProgressView and leaves a placeholder in its slot), System Lock Screen
// compositing and VoiceOver.
// Run through scripts/snapshot-rest-countdown.sh.

let outDir = CommandLine.arguments.dropFirst().first ?? "."
let total: TimeInterval = 60
let width: CGFloat = 360
var failures: [String] = []

func check(_ condition: Bool, _ message: String) {
  if !condition { failures.append(message) }
  print((condition ? "ok   " : "FAIL ") + message)
}

struct RGB { let r: Double, g: Double, b: Double }
func near(_ a: RGB, _ b: RGB, _ tolerance: Double = 0.08) -> Bool {
  abs(a.r - b.r) < tolerance && abs(a.g - b.g) < tolerance && abs(a.b - b.b) < tolerance
}
let gold = RGB(r: 244 / 255, g: 180 / 255, b: 0)
let navy = RGB(r: 17 / 255, g: 24 / 255, b: 39 / 255)

@MainActor
func render(remaining: TimeInterval) -> NSBitmapImageRep? {
  let end = Date().addingTimeInterval(remaining)
  let card = RestCountdownCardView(startDate: end.addingTimeInterval(-total), endDate: end)
    .frame(width: width)
    .background(restCountdownBrand400)
    .environment(\.colorScheme, .light)
  let renderer = ImageRenderer(content: card)
  renderer.scale = 3
  guard let cg = renderer.cgImage else { return nil }
  let bitmap = NSBitmapImageRep(cgImage: cg)
  let path = "\(outDir)/rest-countdown-\(Int(remaining))s.png"
  try? bitmap.representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: path))
  print("wrote \(path) (\(bitmap.pixelsWide)x\(bitmap.pixelsHigh))")
  return bitmap
}

func pixel(_ bitmap: NSBitmapImageRep, _ x: Int, _ y: Int) -> RGB {
  let c = bitmap.colorAt(x: x, y: y)?.usingColorSpace(.sRGB) ?? .clear
  return RGB(r: c.redComponent, g: c.greenComponent, b: c.blueComponent)
}

// The words on the rendered card, read back with Vision OCR.
func recognizedText(_ bitmap: NSBitmapImageRep) -> [String] {
  guard let cg = bitmap.cgImage else { return [] }
  let request = VNRecognizeTextRequest()
  request.recognitionLevel = .accurate
  request.usesLanguageCorrection = false
  try? VNImageRequestHandler(cgImage: cg).perform([request])
  return (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }
}

@MainActor
func runSnapshot() {
  for (remaining, clock) in [(60.0, "1:00"), (30.0, "0:30"), (5.0, "0:05")] {
    guard let bitmap = render(remaining: remaining) else {
      check(false, "render at \(Int(remaining))s")
      continue
    }
    check(near(pixel(bitmap, 6, 6), gold), "\(Int(remaining))s: the field is brand-400 gold")
    var navyInk = 0
    for y in stride(from: 0, to: bitmap.pixelsHigh * 3 / 4, by: 2) {
      for x in stride(from: 0, to: bitmap.pixelsWide, by: 2) where near(pixel(bitmap, x, y), navy, 0.1) {
        navyInk += 1
      }
    }
    check(navyInk > 400, "\(Int(remaining))s: the text is navy ink (\(navyInk) samples)")
    let words = recognizedText(bitmap)
    print("     read: \(words)")
    // The mark in front of it can read as a leading glyph ("O Gymido").
    check(words.contains { $0 == "Gymido" || $0.hasSuffix(" Gymido") }, "\(Int(remaining))s: reads \"Gymido\"")
    check(words.contains("Rest timer"), "\(Int(remaining))s: reads \"Rest timer\"")
    check(words.contains { $0.contains(clock) }, "\(Int(remaining))s: the countdown reads \(clock)")
    check(!words.contains { $0.localizedCaseInsensitiveContains("resting") }, "\(Int(remaining))s: no withdrawn \"Resting\" label")
  }
  if failures.isEmpty {
    print("PASS rest countdown card snapshot")
    exit(0)
  }
  print("FAIL \(failures.count) check(s)")
  exit(1)
}

@main
struct RestCountdownSnapshot {
  @MainActor
  static func main() {
    runSnapshot()
  }
}
