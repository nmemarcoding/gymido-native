import { StyleSheet, Text, useWindowDimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import { TAB_BAR, TAB_BAR_CLEARANCE } from '../../features/shell/tabBarMetrics';
import { colors, gradients } from '../theme/tokens';
import GradientFill from './GradientFill';
import PinnedDock, { DOCK_FADE_HEIGHT, DOCK_STACK_BELOW, DOCK_TAB_BAR_GAP, dockBottomPadding, dockButtonsHeight, dockKeyboardLift, dockStacks } from './PinnedDock';

// UX native final audit 27 Oct 2026, ruling 1 (+ the GENERATOR-FADE ruling):
// ONE dock layer for every pinned footer. It runs from 32 above the top button
// to the bottom edge of the screen: a 32 fade (ground at 0 → ground at 1),
// then solid ground behind the buttons, the tab bar and the home indicator.
// Phones keep 12 between the lowest button and the tab bar's top.

let mockInsets = { top: 0, bottom: 34, left: 0, right: 0 };
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => mockInsets }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));
let mockOverlap = 0;
jest.mock('../hooks/useKeyboardHeight', () => ({ useKeyboardOverlap: () => mockOverlap }));

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
  mockOverlap = 0;
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

  // Reviewer carry (final batch, 27 Oct 2026): before the first onLayout a
  // frame could show content under the dock (the screen's dockHeight was
  // null). The dock seeds it with an estimate (fade 32 + the body's top
  // padding + the buttons + dockBottomPadding) until it is measured.
  it('before the first onLayout it reports an estimate: fade 32 + one 52 button + the bottom room', () => {
    const onHeight = jest.fn();
    render({ onHeight });
    expect(onHeight).toHaveBeenCalledTimes(1);
    expect(onHeight).toHaveBeenCalledWith(DOCK_FADE_HEIGHT + 52 + dockBottomPadding({ width: 390, insetBottom: 34 }));
  });

  it('the estimate takes the screen’s buttons and the body’s top padding (here a stacked pair, 12 on top, no tab bar)', () => {
    const onHeight = jest.fn();
    render({ onHeight, estimate: dockButtonsHeight({ rows: 2 }), contentStyle: { paddingTop: 12 }, overTabBar: false, bottomGap: 28 });
    expect(dockButtonsHeight({ rows: 2 })).toBe(52 + 10 + 52);
    expect(dockButtonsHeight({ buttonHeight: 60 })).toBe(60);
    expect(onHeight).toHaveBeenCalledWith(DOCK_FADE_HEIGHT + 12 + 114 + 34 + 28);
  });

  it('once measured, the measured height wins and a re-render does not re-seed the estimate', () => {
    const onHeight = jest.fn();
    const tree = render({ onHeight });
    act(() => host(tree, 'dock').props.onLayout({ nativeEvent: { layout: { height: 254 } } }));
    onHeight.mockClear();
    act(() => tree.update(<PinnedDock testID="dock" onHeight={onHeight} estimate={120}><Text>Buttons</Text></PinnedDock>));
    expect(onHeight).not.toHaveBeenCalled();
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

// T-74 (QA L1, candidate 2941880): the trainer Create plan keyboard covered
// the docked Cancel / "Create and add days". `liftWithKeyboard` (opt-in) puts
// the buttons 12 above the keyboard's top edge (its overlap with the window).
describe('PinnedDock liftWithKeyboard (T-74, QA L1)', () => {
  it('keyboard open (overlap 336): the buttons end 12 above its top; closed: back over the tab bar', () => {
    mockOverlap = 336;
    expect(flat(host(render({ liftWithKeyboard: true }), 'dock-body')).paddingBottom).toBe(336 + 12);
    mockOverlap = 0;
    expect(flat(host(render({ liftWithKeyboard: true }), 'dock-body')).paddingBottom).toBe(34 + TAB_BAR_CLEARANCE + 12);
  });

  it('opt-in: without the prop an open keyboard changes nothing (the session dock and the others)', () => {
    mockOverlap = 336;
    expect(flat(host(render(), 'dock-body')).paddingBottom).toBe(34 + TAB_BAR_CLEARANCE + 12);
    expect(flat(host(render({ overTabBar: false, bottomGap: 28 }), 'dock-body')).paddingBottom).toBe(34 + 28);
  });

  it('the page scroll room leaves the lift out (iOS insets the scroll, Android ShellPage pads by the overlap); the toasts get the full height', () => {
    mockOverlap = 336;
    const onHeight = jest.fn();
    const tree = render({ onHeight, liftWithKeyboard: true });
    // The seed is the un-lifted estimate.
    expect(onHeight).toHaveBeenLastCalledWith(DOCK_FADE_HEIGHT + 52 + dockBottomPadding({ width: 390, insetBottom: 34 }));
    const lift = 336 + 12 - dockBottomPadding({ width: 390, insetBottom: 34 });
    act(() => host(tree, 'dock').props.onLayout({ nativeEvent: { layout: { height: 254 + lift } } }));
    expect(onHeight).toHaveBeenLastCalledWith(254);
  });

  it('pure helper: the lift is the overlap + 12 past the normal padding, never negative, 0 when closed', () => {
    expect(dockKeyboardLift({ keyboardOverlap: 0, paddingBottom: 132 })).toBe(0);
    expect(dockKeyboardLift({ keyboardOverlap: 336, paddingBottom: 132 })).toBe(216);
    expect(dockKeyboardLift({ keyboardOverlap: 100, paddingBottom: 132 })).toBe(0);
    expect(dockKeyboardLift({ keyboardOverlap: 120, paddingBottom: 132 })).toBe(0);
    expect(dockKeyboardLift({ keyboardOverlap: 121, paddingBottom: 132 })).toBe(1);
  });
});
