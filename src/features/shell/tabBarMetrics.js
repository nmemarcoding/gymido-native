// RN-SPEC-v2-foundation §7.1: the floating glass tab bar's geometry (phones,
// < 768). Pure numbers, no React Native, so logic modules and tests can
// import them. The bottom safe-area inset is added on top of every value.
export const TAB_BAR = Object.freeze({
  height: 66,
  padding: 6,
  radius: 33,
  itemRadius: 27,
  itemGap: 2,
  // Inset from the left/right screen edges and the gap above the bottom safe area.
  sideInset: 16,
  bottomGap: 20,
  // The phone content column (430) minus its 16 gutters, so the bar lines up with the content.
  maxWidth: 398,
});

// Sticky page footers and toasts sit this far above the bottom safe area:
// 66 + 20 = 86.
export const TAB_BAR_CLEARANCE = TAB_BAR.height + TAB_BAR.bottomGap;

// Scrolling content keeps this much bottom padding (plus the safe area) so
// nothing ends under the bar.
export const TAB_BAR_CONTENT_PADDING = 104;
