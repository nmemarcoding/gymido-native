const ReactNative = require('react-native');
import { act, create } from 'react-test-renderer';

import { SHEET_FOCUS_DELAY_MS, focusNode, useSheetFocus } from './useSheetFocus';

function Probe({ open, initialRef, returnRef }) {
  useSheetFocus(open, { initialRef, returnRef });
  return null;
}

let focus;
let handle;
beforeEach(() => {
  jest.useFakeTimers();
  focus = jest.spyOn(ReactNative.AccessibilityInfo, 'setAccessibilityFocus').mockImplementation(() => {});
  focus.mockClear();
  handle = jest.fn((node) => node?.tag ?? null);
  jest.spyOn(ReactNative, 'findNodeHandle', 'get').mockReturnValue(handle);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('useSheetFocus', () => {
  const initialRef = { current: { tag: 1 } };
  const returnRef = { current: { tag: 2 } };

  it('focuses the initial target after the delay when it opens, and the opener when it closes', () => {
    let tree;
    act(() => {
      tree = create(<Probe open={false} initialRef={initialRef} returnRef={returnRef} />);
    });
    act(() => jest.advanceTimersByTime(SHEET_FOCUS_DELAY_MS));
    expect(focus).not.toHaveBeenCalled();

    act(() => tree.update(<Probe open initialRef={initialRef} returnRef={returnRef} />));
    act(() => jest.advanceTimersByTime(SHEET_FOCUS_DELAY_MS - 1));
    expect(focus).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(focus).toHaveBeenLastCalledWith(1);

    act(() => tree.update(<Probe open={false} initialRef={initialRef} returnRef={returnRef} />));
    act(() => jest.advanceTimersByTime(SHEET_FOCUS_DELAY_MS));
    expect(focus).toHaveBeenLastCalledWith(2);
    expect(focus).toHaveBeenCalledTimes(2);
    act(() => tree.unmount());
  });

  it('mounting already open counts as opening', () => {
    let tree;
    act(() => {
      tree = create(<Probe open initialRef={initialRef} />);
    });
    act(() => jest.advanceTimersByTime(SHEET_FOCUS_DELAY_MS));
    expect(focus).toHaveBeenCalledWith(1);
    act(() => tree.unmount());
  });

  it('closing without an opener ref moves nothing', () => {
    let tree;
    act(() => {
      tree = create(<Probe open initialRef={initialRef} />);
    });
    act(() => jest.advanceTimersByTime(SHEET_FOCUS_DELAY_MS));
    act(() => tree.update(<Probe open={false} initialRef={initialRef} />));
    act(() => jest.advanceTimersByTime(SHEET_FOCUS_DELAY_MS));
    expect(focus).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it('focusNode is a no-op without a mounted node', () => {
    expect(focusNode(null)).toBe(false);
    expect(focusNode({ current: null })).toBe(false);
    expect(focusNode({ current: { tag: 5 } })).toBe(true);
    expect(handle).toHaveBeenCalled();
  });

  // Gate flake (27 Oct, under full-suite load): the delayed focus ran when
  // findNodeHandle was no longer a function and threw out of the timer.
  // Focus is best effort: a failed lookup is "no focus", never a throw.
  it('focusNode never throws when the node lookup fails', () => {
    jest.spyOn(ReactNative, 'findNodeHandle', 'get').mockReturnValue(undefined);
    expect(() => focusNode({ current: { tag: 5 } })).not.toThrow();
    expect(focusNode({ current: { tag: 5 } })).toBe(false);
    expect(focus).not.toHaveBeenCalled();
  });
});
