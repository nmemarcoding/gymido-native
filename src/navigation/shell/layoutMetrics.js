import { useWindowDimensions } from 'react-native';

// RN-SPEC-plans §2.8 breakpoints, in window points, re-evaluated on resize and
// rotation like the web's media queries.
export const DESKTOP_MIN_WIDTH = 768;
export const WIDE_GUTTER_MIN_WIDTH = 640;
export const MOBILE_COLUMN_MAX_WIDTH = 430;
export const SIDEBAR_WIDTH = 256;
export const DESKTOP_ROW_MAX_WIDTH = 1152;
export const MOBILE_CONTENT_BOTTOM_PADDING = 112;
export const DESKTOP_CONTENT_BOTTOM_PADDING = 40;

export function layoutFor(width) {
  const isDesktop = width >= DESKTOP_MIN_WIDTH;
  return {
    isDesktop,
    gutter: width >= WIDE_GUTTER_MIN_WIDTH ? 20 : 16,
  };
}

export function useLayoutMetrics() {
  const { width } = useWindowDimensions();
  return layoutFor(width);
}
