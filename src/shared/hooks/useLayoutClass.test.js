import { useWindowDimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import { LayoutClass, layoutClassFor, useLayoutClass, usesRail } from './useLayoutClass';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

describe('layout class (RN-SPEC-v2-foundation §3 breakpoints, T-55)', () => {
  it.each([
    [320, LayoutClass.phone],
    [390, LayoutClass.phone],
    [744, LayoutClass.phone],
    [767, LayoutClass.phone],
    [768, LayoutClass.tablet],
    [834, LayoutClass.tablet],
    [1024, LayoutClass.tablet],
    [1194, LayoutClass.tablet],
    [1279, LayoutClass.tablet],
    [1280, LayoutClass.wide],
    [1366, LayoutClass.wide],
  ])('%i → %s', (width, expected) => {
    expect(layoutClassFor(width)).toBe(expected);
  });

  it('the rail shows on tablet and wide, never on phone', () => {
    expect(usesRail(767)).toBe(false);
    expect(usesRail(768)).toBe(true);
    expect(usesRail(1280)).toBe(true);
  });

  it('the hook reads the window width', () => {
    let value;
    function Probe() {
      value = useLayoutClass();
      return null;
    }
    useWindowDimensions.mockReturnValue({ width: 1194, height: 834, scale: 2, fontScale: 1 });
    act(() => {
      create(<Probe />);
    });
    expect(value).toBe(LayoutClass.tablet);
  });
});
