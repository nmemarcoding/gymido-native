// RN-SPEC-v2-foundation §7.2 + the tablet boards (TabletToday / TabletClients,
// tablet-strategy "Rail"): the icon rail's geometry. Pure numbers so logic
// modules and tests can import them. Safe-area insets are added on top.
import { layout, radii, spacing } from '../../shared/theme/tokens';

export const RAIL = Object.freeze({
  // 88 wide (+ the left safe-area inset), fixed, full height, outside the scroll.
  width: layout.railWidth,
  // Items 72 × 64 (min height: the label can grow), radius 20, gap 8.
  itemWidth: 72,
  itemHeight: 64,
  itemRadius: radii.lg,
  itemGap: spacing[2],
  // A 22 icon over an 11 px label, gap 4 (§7.2).
  iconSize: 22,
  labelGap: spacing[1],
  // The solid gold "G" tile at the top (UX U3: solid, never the gradient).
  markSize: 44,
  markRadius: radii.sm,
  markGap: spacing[6],
  // Top/bottom padding inside the safe area.
  paddingVertical: spacing[6],
  // The content's gap to the rail and its right gutter (tablet gutter 24).
  contentGutter: spacing[6],
});
