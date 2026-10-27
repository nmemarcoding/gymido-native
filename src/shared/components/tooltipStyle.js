import { colors, shadows } from '../theme/tokens';

// The kit tooltip CONTAINER, one look app-wide (UX ruling, T-61): the rail's
// long-press tip and the weight chart's tooltip. surfaceRaised, 1px
// hairlineStrong, radius 10, padding 8 10, shadow-float.
export const TOOLTIP_BOX = Object.freeze({
  backgroundColor: colors.surfaceRaised,
  borderWidth: 1,
  borderColor: colors.hairlineStrong,
  borderRadius: 10,
  paddingVertical: 8,
  paddingHorizontal: 10,
  boxShadow: shadows.float,
});

