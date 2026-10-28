import { StyleSheet, Text, useWindowDimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import { TAB_BAR, TAB_BAR_CLEARANCE } from '../../features/shell/tabBarMetrics';
import { colors, gradients } from '../theme/tokens';
import GradientFill from './GradientFill';
import PinnedDock, { DOCK_FADE_HEIGHT, DOCK_STACK_BELOW, DOCK_TAB_BAR_GAP, dockBottomPadding, dockStacks } from './PinnedDock';

// UX native final audit 27 Oct 2026, ruling 1 (+ the GENERATOR-FADE ruling):
// ONE dock layer for every pinned footer. It runs from 32 above the top button
// to the bottom edge of the screen: a 32 fade (ground at 0 → ground at 1),
// then solid ground behind the buttons, the tab bar and the home indicator.
// Phones keep 12 between the lowest button and the tab bar's top.

let mockInsets = { top: 0, bottom: 34, left: 0, right: 0 };
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => mockInsets }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const host = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.type === 'string')[0];
const flat = (node) => StyleSheet.flatten(node.props.style) ?? {};

function render(props = {}) {
  let tree;
  act(() => {
    tree = create(
      <PinnedDock testID="dock" {...props}>
        <Text>Buttons</Text>
      </PinnedDock>,
    );
  });
  return tree;
}

beforeEach(() => {
  mockInsets = { top: 0, bottom: 34, left: 0, right: 0 };
  useWindowDimensions.mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1 });
});

describe('PinnedDock (UX native final audit 27 Oct 2026, ruling 1)', () => {
  it('is one absolute layer pinned to the bottom edge of the screen, full width', () => {
    expect(flat(host(render(), 'dock'))).toMatchObject({ position: 'absolute', left: 0, right: 0, bottom: 0 });
  });

  it('the top 32 is a vertical fade from clear ground to ground (the ctaBarFade colours), drawn across the whole band', () => {
    const tree = render();
    const band = host(tree, 'dock-fade');
    expect(DOCK_FADE_HEIGHT).toBe(32);
    expect(flat(band).height).toBe(32);
    expect(band.props.pointerEvents).toBe('none');
    const fill = band.findByType(GradientFill);
    expect(fill.props.angle).toBe(180);
    expect(fill.props.colors).toEqual(['rgba(10, 11, 15, 0)', '#0A0B0F']);
    expect(fill.props.colors).toEqual(gradients.ctaBarFade.colors);
    expect(fill.props.stops).toEqual([0, 1]);
  });

  it('from the buttons down to the edge the body is SOLID ground; the buttons start right under the fade', () => {
    const tree = render();
    const body = flat(host(tree, 'dock-body'));
    expect(body.backgroundColor).toBe(colors.ground);
    expect(colors.ground).toBe('#0A0B0F');
    expect(body.paddingTop ?? 0).toBe(0);
    expect(host(tree, 'dock-body').findByType(Text).props.children).toBe('Buttons');
  });

  it('phone (< 768): 12 between the lowest button and the TOP of the floating tab bar (+ the safe area)', () => {
    expect(DOCK_TAB_BAR_GAP).toBe(12);
    expect(TAB_BAR_CLEARANCE).toBe(TAB_BAR.height + TAB_BAR.bottomGap);
    expect(flat(host(render(), 'dock-body')).paddingBottom).toBe(34 + TAB_BAR_CLEARANCE + 12);
    mockInsets = { ...mockInsets, bottom: 0 };
    expect(flat(host(render(), 'dock-body')).paddingBottom).toBe(86 + 12);
  });

  it('≥ 768 (rail, no tab bar): the screen’s own bottom spacing above the safe area', () => {
    useWindowDimensions.mockReturnValue({ width: 834, height: 1194, scale: 2, fontScale: 1 });
    expect(flat(host(render({ bottomGap: 16 }), 'dock-body')).paddingBottom).toBe(34 + 16);
  });

  it('a screen without the tab bar (the workout session) uses its own gap above the safe area on phones too', () => {
    expect(flat(host(render({ overTabBar: false, bottomGap: 28 }), 'dock-body')).paddingBottom).toBe(34 + 28);
  });

  it('reports its measured height (fade + buttons + bottom room) for the scroll padding', () => {
    const onHeight = jest.fn();
    const tree = render({ onHeight });
    act(() => host(tree, 'dock').props.onLayout({ nativeEvent: { layout: { height: 254 } } }));
    expect(onHeight).toHaveBeenCalledWith(254);
  });

  it('taps over the fade go through to the page (box-none root), the body takes them', () => {
    expect(host(render(), 'dock').props.pointerEvents).toBe('box-none');
  });

  it('pure helpers: the bottom room and the < 21rem stack rule', () => {
    expect(dockBottomPadding({ width: 390, insetBottom: 34 })).toBe(132);
    expect(dockBottomPadding({ width: 834, insetBottom: 20, bottomGap: 16 })).toBe(36);
    expect(dockBottomPadding({ width: 390, insetBottom: 34, overTabBar: false, bottomGap: 28 })).toBe(62);
    expect(DOCK_STACK_BELOW).toBe(336);
    expect(dockStacks(320)).toBe(true);
    expect(dockStacks(336)).toBe(false);
    expect(dockStacks(390)).toBe(false);
  });
});
