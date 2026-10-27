import { useEffect, useRef } from 'react';
import { AccessibilityInfo, findNodeHandle } from 'react-native';

// PM Phase 2 parity rule (26 Oct): a sheet / picker moves screen-reader focus
// in when it opens and gives it back when it closes. The trap itself is the
// RN <Modal> + `accessibilityViewIsModal`; Android back closes through
// `onRequestClose`. On open (including mounting already open), `initialRef`
// gets focus; on the open → closed edge, `returnRef` (the control that opened
// it) gets it back. The delay lets the modal mount / unmount first (the app's
// 300 ms pattern).
export const SHEET_FOCUS_DELAY_MS = 300;

export function focusNode(ref) {
  const node = ref?.current ? findNodeHandle(ref.current) : null;
  if (node) {
    AccessibilityInfo.setAccessibilityFocus(node);
    return true;
  }
  return false;
}

export function useSheetFocus(open, { initialRef, returnRef } = {}) {
  const wasOpen = useRef(false);
  useEffect(() => {
    const previous = wasOpen.current;
    wasOpen.current = open;
    let target = null;
    if (open && !previous) {
      target = initialRef;
    } else if (!open && previous) {
      target = returnRef;
    }
    if (!target) {
      return undefined;
    }
    const timer = setTimeout(() => focusNode(target), SHEET_FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [open, initialRef, returnRef]);
}
