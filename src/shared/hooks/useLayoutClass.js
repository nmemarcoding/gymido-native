import { useWindowDimensions } from 'react-native';

import { breakpoints } from '../theme/tokens';

// RN-SPEC-v2-foundation §3 breakpoints + tablet-strategy §3: the shell's size
// class from the WINDOW width (split view / Slide Over windows of phone width
// get the phone layout). phone < 768 · tablet 768–1279 · wide ≥ 1280. Native
// draws the tablet layout at `wide` too (rail kept, content capped at 1120).
export const LayoutClass = Object.freeze({ phone: 'phone', tablet: 'tablet', wide: 'wide' });

export function layoutClassFor(width) {
  if (width >= breakpoints.xl) {
    return LayoutClass.wide;
  }
  return width >= breakpoints.md ? LayoutClass.tablet : LayoutClass.phone;
}

// True when the shell draws the icon rail (tablet and wide).
export function usesRail(width) {
  return layoutClassFor(width) !== LayoutClass.phone;
}

export function useLayoutClass() {
  const { width } = useWindowDimensions();
  return layoutClassFor(width);
}
