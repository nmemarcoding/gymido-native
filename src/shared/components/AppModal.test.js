const ReactNative = require('react-native');
import { Animated, Modal, StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import { useEffect } from 'react';

import { blur, colors, motion, shadows, typography } from '../theme/tokens';
import BlurLayer from './BlurLayer';
import AppModal, { ModalActions, TABLET_WIDTHS, isTabletWidth } from './AppModal';

let mockInsets;
let mockKeyboard;
let mockReduced;
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => mockInsets }));
jest.mock('../hooks/useKeyboardHeight', () => ({ useKeyboardHeight: () => mockKeyboard }));
jest.mock('../hooks/useReducedMotion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('./BlurLayer', () => () => null);

const PHONE = 390;
const TABLET = 1024;
const HEIGHT = 900;

let timing;
beforeEach(() => {
  mockInsets = { top: 40, bottom: 30, left: 0, right: 0 };
  mockKeyboard = 0;
  mockReduced = false;
  timing = jest.spyOn(Animated, 'timing');
});
afterEach(() => jest.restoreAllMocks());

function atWidth(width, fontScale = 1) {
  jest.spyOn(ReactNative, 'useWindowDimensions', 'get').mockReturnValue(() => ({ width, height: HEIGHT, scale: 2, fontScale }));
}

function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  return tree;
}

const flat = (node) => StyleSheet.flatten(node.props.style);
const host = (tree, testID) => tree.root.findAll((n) => n.props.testID === testID && typeof n.type === 'string')[0];
const hasHost = (tree, testID) => host(tree, testID) !== undefined;
const textNode = (tree, value) => tree.root.findAll((n) => n.type === Text && n.props.children === value)[0];
const scrimPressable = (tree) => tree.root.findAll((n) => n.props.accessibilityLabel === 'Close' && typeof n.props.onPress === 'function')[0];
const scrimView = (tree) => host(tree, 'app-modal-overlay');

function modal(props = {}) {
  return (
    <AppModal testID="dlg" isOpen onClose={jest.fn()} title="Discard this workout?" description="Logged sets will be lost." {...props} />
  );
}

describe('isTabletWidth (phone < 768, tablet ≥ 768)', () => {
  it('splits at 768', () => {
    expect(isTabletWidth(767)).toBe(false);
    expect(isTabletWidth(768)).toBe(true);
  });
});

describe('AppModal on a phone: bottom sheet (§6)', () => {
  beforeEach(() => atWidth(PHONE));

  it('draws the sheet: surface-raised, radius 28 28 0 0, top hairline, padding 12 22 24 + safe area, shadow-sheet-up, full width', () => {
    const tree = render(modal({ size: '2xl' }));
    const sheet = flat(host(tree, 'dlg'));
    expect(sheet).toMatchObject({
      width: '100%',
      backgroundColor: colors.surfaceRaised,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      borderTopWidth: 1,
      borderColor: colors.hairlineStrong,
      paddingTop: 12,
      paddingHorizontal: 22,
      paddingBottom: 24 + 30,
      // UX §8.7 U11: every bottom sheet casts shadow-sheet-up.
      boxShadow: shadows.sheetUp,
      maxHeight: HEIGHT - 16 - 40,
    });
    expect(sheet.maxWidth).toBeUndefined();
    expect(sheet.borderBottomLeftRadius).toBeUndefined();
  });

  it('sits on the bottom edge over the scrim', () => {
    const tree = render(modal());
    expect(flat(scrimView(tree))).toMatchObject({ justifyContent: 'flex-end', paddingTop: 16 + 40, paddingBottom: 0 });
    expect(flat(scrimPressable(tree))).toMatchObject({ backgroundColor: colors.scrim, position: 'absolute' });
  });

  it('shows a 36 × 5 grab handle, centred and hidden from screen readers', () => {
    const tree = render(modal());
    const handle = host(tree, 'app-modal-grab-handle');
    expect(flat(handle)).toMatchObject({ width: 36, height: 5, alignSelf: 'center', backgroundColor: colors.grabHandle, borderRadius: 999 });
    expect(handle.props.accessibilityElementsHidden).toBe(true);
    expect(handle.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('uses title-sm for the title (a header) and body 15/22 secondary for the description', () => {
    const tree = render(modal());
    const title = textNode(tree, 'Discard this workout?');
    expect(title.props.accessibilityRole).toBe('header');
    expect(flat(title)).toMatchObject({ ...typography.titleSm, color: colors.textPrimary });
    expect(flat(textNode(tree, 'Logged sets will be lost.'))).toMatchObject({ ...typography.body, color: colors.textSecondary });
  });

  it('renders no description and no children block when none are given', () => {
    const tree = render(modal({ description: undefined }));
    expect(textNode(tree, 'Logged sets will be lost.')).toBeUndefined();
    expect(tree.root.findAll((n) => n.type === Text)).toHaveLength(1);
  });

  it('renders children and the footer', () => {
    const tree = render(modal({ children: <Text>Body child</Text>, footer: <Text>Footer child</Text> }));
    expect(textNode(tree, 'Body child')).toBeDefined();
    expect(flat(textNode(tree, 'Footer child').parent)).toMatchObject({ paddingTop: 20 });
  });

  it('keeps the dialog accessibility (modal, labelled by the title)', () => {
    const tree = render(modal());
    const sheet = host(tree, 'dlg');
    expect(sheet.props.accessibilityViewIsModal).toBe(true);
    expect(sheet.props.accessibilityLabel).toBe('Discard this workout?');
  });

  it('closes from the scrim and from Android back', () => {
    const onClose = jest.fn();
    const tree = render(modal({ onClose }));
    act(() => scrimPressable(tree).props.onPress());
    act(() => tree.root.findByType(Modal).props.onRequestClose());
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('is hidden when closed', () => {
    const tree = render(modal({ isOpen: false }));
    expect(tree.root.findByType(Modal).props.visible).toBe(false);
    expect(timing).not.toHaveBeenCalled();
  });

  it('slides up 300 ms ease-spring from below the window', () => {
    const tree = render(modal());
    expect(timing).toHaveBeenCalledTimes(1);
    expect(timing.mock.calls[0][1]).toMatchObject({ toValue: 1, duration: motion.durationSlow, useNativeDriver: true });
    const sheet = flat(host(tree, 'dlg'));
    expect(sheet.opacity).toBeUndefined();
    expect(sheet.transform).toEqual([{ translateY: HEIGHT }]);
  });

  it('still slides (no pop) when entrance="pop"', () => {
    render(modal({ entrance: 'pop' }));
    expect(timing.mock.calls[0][1].duration).toBe(motion.durationSlow);
    const sheetEasing = timing.mock.calls[0][1].easing;
    timing.mockClear();
    render(modal());
    expect(timing.mock.calls[0][1].easing(0.5)).toBeCloseTo(sheetEasing(0.5));
  });

  it('does not slide under reduced motion', () => {
    mockReduced = true;
    const tree = render(modal());
    expect(timing).not.toHaveBeenCalled();
    expect(flat(host(tree, 'dlg')).transform).toEqual([{ translateY: 0 }]);
  });

  it('rides above an open keyboard and drops the bottom inset', () => {
    mockKeyboard = 300;
    const tree = render(modal());
    expect(flat(scrimView(tree)).paddingBottom).toBe(300);
    expect(flat(host(tree, 'dlg'))).toMatchObject({ paddingBottom: 24, maxHeight: HEIGHT - 16 - 40 - 300 });
  });

  it('ModalActions stacks the actions, the verb on top, gap 8', () => {
    const tree = render(
      <ModalActions>
        <Text>Cancel</Text>
        <Text>Discard</Text>
      </ModalActions>,
    );
    expect(flat(textNode(tree, 'Cancel').parent)).toEqual({ flexDirection: 'column-reverse', gap: 8 });
  });
});

describe('AppModal on a tablet: centred card (§6 + UX ruling)', () => {
  beforeEach(() => atWidth(TABLET));

  it('draws a centred card: surface-raised, radius 28, hairline border, shadow-sheet, side margin 24', () => {
    const tree = render(modal());
    expect(flat(host(tree, 'dlg'))).toMatchObject({
      backgroundColor: colors.surfaceRaised,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: colors.hairlineStrong,
      // §5 / §8.6: a centred dialog casts shadow-sheet.
      boxShadow: shadows.sheet,
      padding: 32,
      maxHeight: HEIGHT - 48 - 40 - 30,
    });
    expect(flat(scrimView(tree))).toMatchObject({ justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, paddingTop: 24 + 40, paddingBottom: 24 + 30 });
  });

  it.each([
    ['md', 520],
    ['lg', 560],
    ['2xl', 600],
    ['unknown', 600],
  ])('size %s → max width %i', (size, maxWidth) => {
    const tree = render(modal({ size }));
    expect(flat(host(tree, 'dlg')).maxWidth).toBe(maxWidth);
  });

  it('defaults to lg (560) and keeps every UX width in 448 or 520–640', () => {
    const tree = render(modal());
    expect(flat(host(tree, 'dlg')).maxWidth).toBe(560);
    Object.values(TABLET_WIDTHS).forEach((w) => expect(w === 448 || (w >= 520 && w <= 640)).toBe(true));
  });

  it('has no grab handle', () => {
    expect(hasHost(render(modal()), 'app-modal-grab-handle')).toBe(false);
  });

  it('uses the 34/38 title (UX) and body-lg; compact keeps the 15/22 body', () => {
    let tree = render(modal());
    expect(flat(textNode(tree, 'Discard this workout?'))).toMatchObject({ fontFamily: 'Geist-Bold', fontSize: 34, lineHeight: 38, paddingRight: 48 });
    expect(flat(textNode(tree, 'Logged sets will be lost.'))).toMatchObject({ ...typography.bodyLg, marginTop: 10 });
    tree = render(modal({ compact: true }));
    expect(flat(textNode(tree, 'Logged sets will be lost.'))).toMatchObject({ ...typography.body, marginTop: 10 });
  });

  it('fades + rises 300 ms ease-spring by default', () => {
    const tree = render(modal());
    expect(timing.mock.calls[0][1]).toMatchObject({ duration: motion.durationSlow });
    expect(flat(host(tree, 'dlg'))).toMatchObject({ opacity: 0, transform: [{ translateY: motion.cardOffsetY }] });
  });

  it('pops in with ease-pop when entrance="pop"', () => {
    const tree = render(modal({ entrance: 'pop' }));
    const config = timing.mock.calls[0][1];
    expect(config.duration).toBe(260);
    // ease-pop overshoots past 1.
    expect(Math.max(...[0.6, 0.7, 0.8, 0.9].map((t) => config.easing(t)))).toBeGreaterThan(1);
    expect(flat(host(tree, 'dlg'))).toMatchObject({ opacity: 0, transform: [{ scale: 0.95 }] });
  });

  it('shows at rest under reduced motion', () => {
    mockReduced = true;
    const tree = render(modal({ entrance: 'pop' }));
    expect(timing).not.toHaveBeenCalled();
    expect(flat(host(tree, 'dlg'))).toMatchObject({ opacity: 1, transform: [{ scale: 1 }] });
  });

  it('moves up and scrolls inside with the keyboard open', () => {
    mockKeyboard = 400;
    const tree = render(modal());
    expect(flat(scrimView(tree)).paddingBottom).toBe(24 + 400);
    expect(flat(host(tree, 'dlg')).maxHeight).toBe(HEIGHT - 48 - 40 - 400);
    expect(tree.root.findByType(ReactNative.ScrollView).props.keyboardShouldPersistTaps).toBe('handled');
  });

  it('closes from the scrim', () => {
    const onClose = jest.fn();
    const tree = render(modal({ onClose }));
    act(() => scrimPressable(tree).props.onPress());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ModalActions is a row at the right (Cancel left, verb right), gap 12', () => {
    const tree = render(
      <ModalActions>
        <Text>Cancel</Text>
        <Text>Discard</Text>
      </ModalActions>,
    );
    expect(flat(textNode(tree, 'Cancel').parent)).toEqual({ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 });
  });
});

describe('AppModal tablet header Close (UX, 26 Oct)', () => {
  const closeButton = (tree) => host(tree, 'app-modal-close');

  it('shows a 36 glass Close with a 44 hit area on tablets', () => {
    atWidth(TABLET);
    const tree = render(modal());
    const close = closeButton(tree);
    expect(close.props).toMatchObject({ accessibilityRole: 'button', accessibilityLabel: 'Close', hitSlop: 4 });
    expect(flat(close)).toMatchObject({ width: 36, height: 36, borderRadius: 999, borderWidth: 1, position: 'absolute' });
    expect(36 + 2 * close.props.hitSlop).toBe(44);
  });

  it('closes the dialog when pressed, and darkens while pressed', () => {
    atWidth(TABLET);
    const onClose = jest.fn();
    const tree = render(modal({ onClose }));
    const pressable = tree.root.findAll((n) => n.props.testID === 'app-modal-close' && typeof n.props.onPress === 'function')[0];
    act(() => pressable.props.onPress());
    expect(onClose).toHaveBeenCalledTimes(1);
    const pressed = StyleSheet.flatten(pressable.props.style({ pressed: true }));
    expect(pressed.backgroundColor).toBe('rgba(255, 255, 255, 0.12)');
  });

  it('keeps the scrim closing it too', () => {
    atWidth(TABLET);
    const onClose = jest.fn();
    const tree = render(modal({ onClose }));
    act(() => scrimPressable(tree).props.onPress());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has no Close button on phones (the sheet has its grab handle)', () => {
    atWidth(PHONE);
    expect(closeButton(render(modal()))).toBeUndefined();
  });
});

describe('AppModal footer and the keyboard (UX Phase 1 review)', () => {
  const footerModal = () =>
    modal({ footer: <Text>Save weight</Text>, children: <Text>Unit</Text> });
  const footerInScroll = (tree) => {
    const scroll = tree.root.findByType(ReactNative.ScrollView);
    return scroll.findAll((n) => n.type === Text && n.props.children === 'Save weight').length > 0;
  };

  it('phone, keyboard open: the footer scrolls with the content, so the last field keeps its height', () => {
    atWidth(PHONE);
    mockKeyboard = 320;
    expect(footerInScroll(render(footerModal()))).toBe(true);
  });

  it('phone, keyboard closed: the footer stays fixed under the content', () => {
    atWidth(PHONE);
    mockKeyboard = 0;
    const tree = render(footerModal());
    expect(footerInScroll(tree)).toBe(false);
    expect(tree.root.findAll((n) => n.type === Text && n.props.children === 'Save weight')).toHaveLength(1);
  });

  it('tablet: the footer stays fixed even with the keyboard open', () => {
    atWidth(TABLET);
    mockKeyboard = 320;
    expect(footerInScroll(render(footerModal()))).toBe(false);
  });
});

describe('AppModal hideClose (review LOW, web parity)', () => {
  it('hides the tablet Close while busy and shows it otherwise', () => {
    atWidth(TABLET);
    expect(host(render(modal({ hideClose: true })), 'app-modal-close')).toBeUndefined();
    expect(host(render(modal()), 'app-modal-close')).toBeTruthy();
  });
});

describe('AppModal kit 2 (UX §8.7 U11/U12)', () => {
  it('phone: the scrim blurs 4 (blur.scrim) over the app, the sheet casts sheetUp', () => {
    atWidth(PHONE);
    const tree = render(modal());
    expect(tree.root.findByType(BlurLayer).props).toMatchObject({ blurPx: blur.scrim, overApp: true });
    expect(blur.scrim).toBe(4);
    expect(shadows.sheetUp).toBe('0px -10px 50px rgba(0, 0, 0, 0.6)');
    expect(flat(host(tree, 'dlg')).boxShadow).toBe(shadows.sheetUp);
  });

  it('tablet: the scrim blurs 6 (blur.scrimTablet), the card casts sheet', () => {
    atWidth(TABLET);
    const tree = render(modal());
    expect(tree.root.findByType(BlurLayer).props.blurPx).toBe(blur.scrimTablet);
    expect(blur.scrimTablet).toBe(6);
    expect(shadows.sheet).toBe('0px 30px 80px rgba(0, 0, 0, 0.6)');
    expect(flat(host(tree, 'dlg')).boxShadow).toBe(shadows.sheet);
  });
});

describe('AppModal remounts its content on a text-scale change (QA F1, the ShellPage fix)', () => {
  let mounts;
  function Probe() {
    useEffect(() => {
      mounts += 1;
    }, []);
    return <Text>probe</Text>;
  }
  const withProbe = (props = {}) => (
    <AppModal testID="dlg" isOpen onClose={jest.fn()} title="Edit" footer={<Text>footer</Text>} {...props}>
      <Probe />
    </AppModal>
  );
  beforeEach(() => {
    mounts = 0;
  });

  it.each([
    [PHONE, 1, 2],
    [PHONE, 2, 3.1],
    [TABLET, 1, 3.1],
  ])('width %i: fontScale %f → %f remounts the content once; the Modal stays open and the entrance does not replay', (width, from, to) => {
    atWidth(width, from);
    const tree = render(withProbe());
    expect(mounts).toBe(1);
    const modalBefore = tree.root.findByType(Modal);
    const timingCalls = timing.mock.calls.length;
    atWidth(width, to);
    act(() => tree.update(withProbe()));
    expect(mounts).toBe(2);
    const modalAfter = tree.root.findByType(Modal);
    expect(modalAfter).toBe(modalBefore);
    expect(modalAfter.props.visible).toBe(true);
    expect(timing.mock.calls.length).toBe(timingCalls);
    expect(textNode(tree, 'probe')).toBeDefined();
    expect(textNode(tree, 'footer')).toBeDefined();
  });

  it('the same text scale does not remount', () => {
    atWidth(PHONE, 2);
    const tree = render(withProbe());
    act(() => tree.update(withProbe({ title: 'Edit again' })));
    expect(mounts).toBe(1);
  });

  it('a closed modal stays closed across a text-scale change', () => {
    atWidth(PHONE, 1);
    const tree = render(withProbe({ isOpen: false }));
    atWidth(PHONE, 2);
    act(() => tree.update(withProbe({ isOpen: false })));
    expect(tree.root.findByType(Modal).props.visible).toBe(false);
  });
});

describe('ModalActions `fill` (kit 2)', () => {
  const actions = (props) =>
    render(
      <ModalActions {...props}>
        <Text>Cancel</Text>
        <Text>Send</Text>
      </ModalActions>,
    );

  it('tablet at 1×: each action shares the row (flex 1)', () => {
    atWidth(TABLET, 1);
    const tree = actions({ fill: true });
    const cells = tree.root.findAll((n) => typeof n.type === 'string' && n.props.testID === 'modal-actions-fill');
    expect(cells).toHaveLength(2);
    cells.forEach((cell) => expect(flat(cell)).toEqual({ flex: 1 }));
    const row = tree.root.findAll((n) => typeof n.type === 'string' && flat(n)?.flexDirection === 'row');
    expect(row).toHaveLength(1);
    expect(flat(row[0])).toMatchObject({ justifyContent: 'flex-end', gap: 12 });
  });

  it('tablet without fill: the actions keep their own width (no cells)', () => {
    atWidth(TABLET, 1);
    expect(actions({}).root.findAll((n) => n.props.testID === 'modal-actions-fill')).toHaveLength(0);
  });

  it.each([2, 3.1])('tablet at %f×: the row stacks (verb on top) and fill adds no cells', (fontScale) => {
    atWidth(TABLET, fontScale);
    const tree = actions({ fill: true });
    expect(tree.root.findAll((n) => n.props.testID === 'modal-actions-fill')).toHaveLength(0);
    expect(flat(textNode(tree, 'Cancel').parent)).toEqual({ flexDirection: 'column-reverse', gap: 8 });
  });

  it('phone: always the stacked column, fill or not', () => {
    atWidth(PHONE, 1);
    const tree = actions({ fill: true });
    expect(tree.root.findAll((n) => n.props.testID === 'modal-actions-fill')).toHaveLength(0);
    expect(flat(textNode(tree, 'Send').parent)).toEqual({ flexDirection: 'column-reverse', gap: 8 });
  });
});

// Review P4 26fc4a8 M2 (27 Oct a11y ruling): confirms can be alert dialogs.
describe('AppModal role', () => {
  it('passes a given role to the card; without one the card has no role prop (every other dialog unchanged)', () => {
    atWidth(TABLET);
    const card = (tree) => tree.root.findAll((n) => n.props.accessibilityViewIsModal && typeof n.type === 'string')[0];
    expect(card(render(modal({ role: 'alertdialog' }))).props.role).toBe('alertdialog');
    const plain = card(render(modal()));
    expect(plain.props.role).toBeUndefined();
    expect(plain.props.accessibilityRole).toBe('none');
  });
});
