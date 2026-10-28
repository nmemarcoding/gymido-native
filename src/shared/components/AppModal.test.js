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
jest.mock('../hooks/useKeyboardHeight', () => ({ useKeyboardHeight: () => mockKeyboard, useKeyboardOverlap: () => mockKeyboard }));
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

  // FINAL-AUDIT batch-1 ruling: phone sheet titles are 26/30 700.
  it('uses the 26/30 700 sheet title (a header) and body 15/22 secondary for the description', () => {
    const tree = render(modal());
    const title = textNode(tree, 'Discard this workout?');
    expect(title.props.accessibilityRole).toBe('header');
    expect(flat(title)).toMatchObject({ ...typography.titleSheet, color: colors.textPrimary });
    expect(flat(title)).toMatchObject({ fontSize: 26, lineHeight: 30, fontFamily: 'Geist-Bold' });
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

});

// FINAL-AUDIT "Rulings for FE batch 1": every TITLED phone sheet shows a 36
// glass × (44 hit) on the title row, beside the title (not floating).
describe('AppModal phone title-row Close (FINAL-AUDIT batch 1)', () => {
  beforeEach(() => atWidth(PHONE));
  const closeButton = (tree) => host(tree, 'app-modal-close');

  it('a titled sheet shows the 36 glass × (44 hit) in a row with the title', () => {
    const tree = render(modal());
    const close = closeButton(tree);
    expect(close.props).toMatchObject({ accessibilityRole: 'button', accessibilityLabel: 'Close', hitSlop: 4 });
    expect(flat(close)).toMatchObject({ width: 36, height: 36, borderRadius: 999, borderWidth: 1, backgroundColor: colors.fillSkeleton, borderColor: colors.hairlineStrong });
    expect(flat(close).position).toBeUndefined();
    expect(36 + 2 * close.props.hitSlop).toBe(44);
    const row = host(tree, 'app-modal-title-row');
    expect(flat(row)).toMatchObject({ flexDirection: 'row' });
    expect(row.findAll((n) => n.type === Text && n.props.children === 'Discard this workout?')).toHaveLength(1);
    expect(row.findAll((n) => n.props.testID === 'app-modal-close' && typeof n.type === 'string')).toHaveLength(1);
    // The title gives the × its room in the row (no 48 pad as on tablet).
    expect(flat(textNode(tree, 'Discard this workout?')).paddingRight).toBeUndefined();
  });

  it('pressing the × closes the sheet; the scrim still does too', () => {
    const onClose = jest.fn();
    const tree = render(modal({ onClose }));
    act(() => tree.root.findAll((n) => n.props.testID === 'app-modal-close' && typeof n.props.onPress === 'function')[0].props.onPress());
    act(() => scrimPressable(tree).props.onPress());
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('hideClose hides it on phones too; an untitled sheet has none', () => {
    expect(closeButton(render(modal({ hideClose: true })))).toBeUndefined();
    expect(closeButton(render(modal({ title: undefined })))).toBeUndefined();
  });

  it('keeps the grab handle above the title row', () => {
    expect(hasHost(render(modal()), 'app-modal-grab-handle')).toBe(true);
  });

  // FINAL-AUDIT batch 1 (5): one way out. A sheet whose footer already has a
  // Cancel / Close / Done passes `footerDismiss` and shows no phone ×.
  it('footerDismiss drops the phone × (the footer is the one way out); default false keeps it', () => {
    expect(closeButton(render(modal({ footerDismiss: true, footer: <Text>Cancel</Text> })))).toBeUndefined();
    expect(closeButton(render(modal({ footer: <Text>Save</Text> })))).toBeTruthy();
  });

  it('footerDismiss leaves the tablet header Close as it is', () => {
    atWidth(TABLET);
    expect(closeButton(render(modal({ footerDismiss: true, footer: <Text>Cancel</Text> })))).toBeTruthy();
  });
});

// FINAL-AUDIT batch 1 (3): the phone title row is a FIXED header (the × is
// always reachable); the content scrolls under it. Order: handle, title, ×,
// the scrolling content, then the footer.
describe('AppModal phone pinned header (FINAL-AUDIT batch 1)', () => {
  beforeEach(() => atWidth(PHONE));
  const inScroll = (tree, pred) => tree.root.findByType(ReactNative.ScrollView).findAll(pred).length > 0;

  // Host nodes a screen reader stops on, in tree order: texts and buttons
  // (a button's own texts are part of it); hidden subtrees are skipped.
  function accessibleOrder(tree) {
    const out = [];
    const walk = (node) => {
      if (typeof node !== 'object' || node === null) {
        return;
      }
      if (typeof node.type === 'string') {
        if (node.props.accessibilityElementsHidden) {
          return;
        }
        if (node.props.accessibilityRole === 'button') {
          out.push(`button:${node.props.accessibilityLabel}`);
          return;
        }
        if (node.type === 'Text') {
          out.push(`text:${[].concat(node.props.children).join('')}`);
          return;
        }
      }
      node.children.forEach(walk);
    };
    walk(host(tree, 'dlg'));
    return out;
  }

  it('the title row (title + ×) sits outside the ScrollView; the description and children scroll', () => {
    const tree = render(modal({ children: <Text>Body</Text> }));
    expect(host(tree, 'app-modal-header')).toBeTruthy();
    expect(host(tree, 'app-modal-header').findAll((n) => n.props.testID === 'app-modal-title-row' && typeof n.type === 'string')).toHaveLength(1);
    expect(inScroll(tree, (n) => n.props.testID === 'app-modal-title-row')).toBe(false);
    expect(inScroll(tree, (n) => n.props.testID === 'app-modal-close')).toBe(false);
    expect(inScroll(tree, (n) => n.type === Text && n.props.children === 'Discard this workout?')).toBe(false);
    expect(inScroll(tree, (n) => n.type === Text && n.props.children === 'Logged sets will be lost.')).toBe(true);
    expect(inScroll(tree, (n) => n.type === Text && n.props.children === 'Body')).toBe(true);
  });

  it('the eyebrow stays above the title in the fixed header', () => {
    const tree = render(modal({ eyebrow: 'Clients' }));
    expect(host(tree, 'app-modal-header').findAll((n) => n.props.testID === 'app-modal-eyebrow' && typeof n.type === 'string')).toHaveLength(1);
  });

  it('a sheet without the × still pins its title (footerDismiss / hideClose)', () => {
    const tree = render(modal({ footerDismiss: true, footer: <Text>Cancel</Text> }));
    expect(inScroll(tree, (n) => n.type === Text && n.props.children === 'Discard this workout?')).toBe(false);
  });

  it('accessibility order: handle (hidden), title, then the × right after it, then the content, then the footer', () => {
    const tree = render(modal({ children: <Text>Body</Text>, footer: <Text>Save</Text> }));
    const order = accessibleOrder(tree);
    const at = (item) => order.indexOf(item);
    expect(at('text:Discard this workout?')).toBeGreaterThanOrEqual(0);
    expect(at('button:Close')).toBe(at('text:Discard this workout?') + 1);
    expect(at('text:Logged sets will be lost.')).toBeGreaterThan(at('button:Close'));
    expect(at('text:Body')).toBeGreaterThan(at('text:Logged sets will be lost.'));
    expect(at('text:Save')).toBe(order.length - 1);
    // The handle comes first in the tree (hidden from AT).
    const card = host(tree, 'dlg');
    const ids = card.findAll((n) => typeof n.type === 'string' && ['app-modal-grab-handle', 'app-modal-header'].includes(n.props.testID)).map((n) => n.props.testID);
    expect(ids).toEqual(['app-modal-grab-handle', 'app-modal-header']);
  });

  // UX native final audit 27 Oct 2026, ruling 12 (A142, A151): was "tablet
  // unchanged: no fixed header, the title scrolls". A landscape tablet dialog
  // scrolls under a PINNED title, so the tablet title sits in the fixed header
  // too; the description still scrolls.
  it('tablet: the title sits in a fixed header; the description scrolls', () => {
    atWidth(TABLET);
    const tree = render(modal());
    expect(host(tree, 'app-modal-header')).toBeTruthy();
    expect(inScroll(tree, (n) => n.type === Text && n.props.children === 'Discard this workout?')).toBe(false);
    expect(inScroll(tree, (n) => n.type === Text && n.props.children === 'Logged sets will be lost.')).toBe(true);
  });
});

// T-62 (27 Oct 2026): `pinnedHeader` (optional) renders right after the
// title (row) and outside the ScrollView: a find field stays put while the
// content scrolls. Without it, nothing changes (tests above).
describe('AppModal pinnedHeader (T-62)', () => {
  const inScroll = (tree, pred) => tree.root.findByType(ReactNative.ScrollView).findAll(pred).length > 0;
  const pinned = <Text testID="find">Find</Text>;

  it('phone: inside the fixed header, after the title row; the children still scroll', () => {
    atWidth(PHONE);
    const tree = render(modal({ pinnedHeader: pinned, children: <Text>Body</Text> }));
    const header = host(tree, 'app-modal-header');
    const ids = header.findAll((n) => typeof n.type === 'string' && ['app-modal-title-row', 'app-modal-pinned-header'].includes(n.props.testID)).map((n) => n.props.testID);
    expect(ids).toEqual(['app-modal-title-row', 'app-modal-pinned-header']);
    expect(inScroll(tree, (n) => n.props.testID === 'find')).toBe(false);
    expect(inScroll(tree, (n) => n.type === Text && n.props.children === 'Body')).toBe(true);
  });

  it('tablet: the title and the pinned header sit in a fixed header above the scroll; the description scrolls', () => {
    atWidth(TABLET);
    const tree = render(modal({ pinnedHeader: pinned, children: <Text>Body</Text> }));
    const header = host(tree, 'app-modal-header');
    expect(header).toBeTruthy();
    expect(inScroll(tree, (n) => n.props.testID === 'find')).toBe(false);
    expect(inScroll(tree, (n) => n.type === Text && n.props.children === 'Discard this workout?')).toBe(false);
    expect(flat(textNode(tree, 'Discard this workout?'))).toMatchObject({ fontSize: 34, lineHeight: 38 });
    expect(inScroll(tree, (n) => n.type === Text && n.props.children === 'Logged sets will be lost.')).toBe(true);
    expect(inScroll(tree, (n) => n.type === Text && n.props.children === 'Body')).toBe(true);
    // The tablet Close stays pinned in the corner.
    expect(hasHost(tree, 'app-modal-close')).toBe(true);
  });

  // Final device audit (iOS, 27 Oct 2026): a row scrolled up under the pinned
  // find field must not show there, nor take a tap meant for the field: the
  // fixed header paints and hit-tests ABOVE the scroll (zIndex) on the card's
  // opaque fill. The tablet Close stays above both.
  it.each([
    ['phone', PHONE],
    ['tablet', TABLET],
  ])('%s: the fixed header sits above the scroll content, opaque', (_, width) => {
    atWidth(width);
    const tree = render(modal({ pinnedHeader: pinned, children: <Text>Body</Text> }));
    const header = flat(host(tree, 'app-modal-header'));
    const scroll = StyleSheet.flatten(tree.root.findByType(ReactNative.ScrollView).props.style);
    expect(header.zIndex).toBeGreaterThan(scroll.zIndex ?? 0);
    expect(header.backgroundColor).toBe(colors.surfaceRaised);
    expect(flat(host(tree, 'dlg')).backgroundColor).toBe(colors.surfaceRaised);
    if (width === TABLET) {
      expect(flat(host(tree, 'app-modal-close')).zIndex).toBeGreaterThan(header.zIndex);
    }
  });

  it('phone, keyboard open: the sheet rides above it and the pinned header stays fixed over the scrolling content', () => {
    atWidth(PHONE);
    mockKeyboard = 336;
    const tree = render(modal({ pinnedHeader: pinned, children: <Text>Body</Text>, footer: <Text>Show</Text> }));
    expect(flat(scrimView(tree)).paddingBottom).toBe(336);
    expect(flat(host(tree, 'dlg')).maxHeight).toBe(HEIGHT - 16 - 40 - 336);
    expect(inScroll(tree, (n) => n.props.testID === 'find')).toBe(false);
    expect(inScroll(tree, (n) => n.type === Text && n.props.children === 'Body')).toBe(true);
  });

  // v2 fix (iOS row-label peek, 27 Oct 2026): the gap between the pinned
  // field and the first scrolled block was a top margin INSIDE the scroll, so
  // once scrolled a row's bottom edge showed right under the field. The gap
  // is now the pinned header's own (opaque) bottom padding: the header's fill
  // runs to the scroll's top edge and the scroll content starts at 0.
  it.each([
    ['phone', PHONE, undefined, 12],
    ['tablet', TABLET, undefined, 12],
    ['phone + description', PHONE, 'Logged sets will be lost.', 6],
    ['tablet + description', TABLET, 'Logged sets will be lost.', 10],
  ])('%s: the gap under the pinned field is opaque header, not scroll content', (_, width, description, gap) => {
    atWidth(width);
    const tree = render(modal({ pinnedHeader: pinned, description, children: <Text>Body</Text> }));
    const header = host(tree, 'app-modal-header');
    // The pinned box is the header's last block and owns the gap.
    expect(flat(host(tree, 'app-modal-pinned-header')).paddingBottom).toBe(gap);
    expect(flat(header)).toMatchObject({ backgroundColor: colors.surfaceRaised, zIndex: 1 });
    expect(flat(header).paddingBottom ?? 0).toBe(0);
    expect(flat(header).marginBottom ?? 0).toBe(0);
    // Nothing between the header's bottom and the scroll's top…
    const scroll = tree.root.findByType(ReactNative.ScrollView);
    expect(StyleSheet.flatten(scroll.props.style).marginTop ?? 0).toBe(0);
    expect(StyleSheet.flatten(scroll.props.contentContainerStyle)?.paddingTop ?? 0).toBe(0);
    // …and the first scrolled block starts at the scroll's top edge.
    const first = description
      ? scroll.findAll((n) => n.type === 'Text' && [].concat(n.props.children).join('') === description)[0]
      : scroll.findAll((n) => n.type === 'View' && n.findAll((c) => c.type === 'Text' && c.props.children === 'Body').length > 0).pop();
    expect(first).toBeDefined();
    expect(StyleSheet.flatten(first.props.style).marginTop ?? 0).toBe(0);
  });

  it('accessibility order: title, ×, pinned header, then the content', () => {
    atWidth(PHONE);
    const tree = render(modal({ pinnedHeader: pinned, children: <Text>Body</Text> }));
    const order = tree.root
      .findAll((n) => typeof n.type === 'string' && (n.type === 'Text' || n.props.testID === 'app-modal-close'))
      .map((n) => (n.props.testID === 'app-modal-close' ? 'close' : [].concat(n.props.children).join('')))
      .filter((item) => ['Discard this workout?', 'close', 'Find', 'Body'].includes(item));
    expect(order).toEqual(['Discard this workout?', 'close', 'Find', 'Body']);
  });
});

// FINAL-AUDIT batch 1 (5) guard: every AppModal caller whose footer has a
// dismiss (Cancel / Close / Done, or a cancelLabel) passes footerDismiss; a
// caller without one (PlanOverflowSheet: a titled menu) does not.
describe('Guard: footer dismiss ⇒ footerDismiss (FINAL-AUDIT batch 1)', () => {
  const fs = require('fs');
  const path = require('path');
  const src = path.resolve(__dirname, '../..');
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return walk(full);
      }
      return entry.name.endsWith('.js') && !entry.name.endsWith('.test.js') ? [full] : [];
    });
  const callers = walk(src)
    .filter((file) => !file.endsWith(`${path.sep}AppModal.js`))
    .map((file) => ({ file: path.relative(src, file).split(path.sep).join('/'), text: fs.readFileSync(file, 'utf8') }))
    .filter(({ text }) => /<AppModal\b/.test(text));
  const DISMISS = /title=(["'`])(Cancel|Close|Done)\1|title=\{cancelLabel\}/;

  it('finds the callers', () => {
    expect(callers.length).toBeGreaterThanOrEqual(14);
  });

  // UX refinement (28 Oct, web + native): a sheet shows the × when its BOARD
  // draws one, so these keep BOTH the pinned × and their footer Close/Cancel.
  // 27 Oct 2026 (MEMBER-PLANS + TRAINER-PLANS audit b2, UX R2-3): the set editor and Edit plan details show
  // the × at every width for both actors (phone: title row + footer Cancel).
  const BOARD_DRAWS_CLOSE = [
    'features/home/WeightLogModal.js',
    'features/trainer/clients/components/WeightHistoryModal.js',
    'features/trainer/clients/components/WorkoutDetailModal.js',
    'features/trainer/plans/components/AddSetModal.js',
    'features/trainer/plans/components/EditPlanDetailsModal.js',
  ];

  it('every caller with a footer dismiss passes footerDismiss (except where the board draws a ×); callers without one do not', () => {
    const wrong = callers
      .filter(({ file }) => !BOARD_DRAWS_CLOSE.includes(file))
      .filter(({ text }) => DISMISS.test(text) !== /\bfooterDismiss\b/.test(text))
      .map(({ file }) => file);
    expect(wrong).toEqual([]);
  });

  it('the sheets whose board draws a × keep it next to their footer dismiss (no footerDismiss)', () => {
    BOARD_DRAWS_CLOSE.forEach((file) => {
      const caller = callers.find((entry) => entry.file === file);
      expect(caller).toBeTruthy();
      expect(DISMISS.test(caller.text)).toBe(true);
      expect(/\bfooterDismiss\b/.test(caller.text)).toBe(false);
    });
  });

  // 27 Oct 2026 (audit b2): Add / Edit day's phone × depends on the actor: the member board draws it, the
  // trainer's does not (footer Cancel only). Rendered per width in builderDialogs.test.js.
  it('AddDayModal: footerDismiss only for the trainer look', () => {
    const day = callers.find(({ file }) => file.endsWith('AddDayModal.js'));
    expect(day).toBeTruthy();
    expect(DISMISS.test(day.text)).toBe(true);
    expect(day.text).toMatch(/footerDismiss=\{look === 'trainer'\}/);
  });

  // 27 Oct 2026 (UX R2-3 / R2-5): the dialogs whose boards draw NO × at any width hide the tablet header Close
  // too (hideClose), not just the phone one: Invite a client, member End coaching (and the trainer's), the
  // generator confirm. Busy-only hideClose (Change password, Delete account) is a different rule.
  const NO_CLOSE_ANY_WIDTH = {
    'features/trainer/clients/components/InviteClientModal.js': /\bhideClose\b(?!=)/,
    'features/trainers/components/EndCoachingDialog.js': /\bhideClose\b(?!=)/,
  };
  it('the dialogs with no × at any width pass a plain hideClose', () => {
    Object.entries(NO_CLOSE_ANY_WIDTH).forEach(([file, pattern]) => {
      const caller = callers.find((entry) => entry.file === file);
      expect(caller).toBeTruthy();
      expect(caller.text).toMatch(pattern);
    });
  });
  // DECLARED (T-80, UX T80-start-confirm-copy "Footer Cancel → no ×"): + the hub's start confirm.
  const CONFIRM_NO_CLOSE = ['features/planGenerator/screens/PlanGeneratorPreviewScreen.js', 'features/workout/screens/WorkoutScreen.js'];
  it('only the ConfirmDialogs whose boards draw no × at any width pass hideClose', () => {
    const withHide = walk(src)
      .map((file) => ({ file: path.relative(src, file).split(path.sep).join('/'), text: fs.readFileSync(file, 'utf8') }))
      .filter(({ text }) => (text.match(/<ConfirmDialog\b[\s\S]*?\/>/g) ?? []).some((block) => /\bhideClose\b/.test(block)))
      .map(({ file }) => file);
    expect(withHide).toEqual(CONFIRM_NO_CLOSE);
  });

  // UX R2-4 (web round 2): "More plan actions" is a Menu, footer Cancel, no ×.
  it('PlanOverflowSheet is a Menu: a footer Cancel and footerDismiss (no ×)', () => {
    const overflow = callers.find(({ file }) => file.endsWith('PlanOverflowSheet.js'));
    expect(overflow).toBeTruthy();
    expect(DISMISS.test(overflow.text)).toBe(true);
    expect(/\bfooterDismiss\b/.test(overflow.text)).toBe(true);
  });

  // UX R2-2: ConfirmDialog drops the phone × unless its board draws one.
  const CONFIRM_BOARD_DRAWS_CLOSE = ['features/trainers/screens/TrainerDetailScreen.js'];
  it('only the ConfirmDialogs whose board draws a × pass boardClose', () => {
    const withBoardClose = walk(src)
      .map((file) => ({ file: path.relative(src, file).split(path.sep).join('/'), text: fs.readFileSync(file, 'utf8') }))
      .filter(({ text }) => (text.match(/<ConfirmDialog\b[\s\S]*?\/>/g) ?? []).some((block) => /\bboardClose\b/.test(block)))
      .map(({ file }) => file);
    expect(withBoardClose).toEqual(CONFIRM_BOARD_DRAWS_CLOSE);
  });
});

// FINAL-AUDIT batch 1: phone = ONE attached bottom sheet, no floating variant.
describe('Guard: no floating sheet variant (FINAL-AUDIT batch 1)', () => {
  beforeEach(() => atWidth(PHONE));
  const sheetStyle = (props) => flat(host(render(modal(props)), 'dlg'));

  it('the phone sheet is attached: full width, square bottom corners, no side/bottom gap, scrim padding 0 at the bottom', () => {
    const tree = render(modal());
    const sheet = flat(host(tree, 'dlg'));
    expect(sheet).toMatchObject({ width: '100%', borderTopLeftRadius: 28, borderTopRightRadius: 28 });
    ['margin', 'marginHorizontal', 'marginBottom', 'left', 'right', 'bottom', 'borderRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius', 'maxWidth'].forEach((key) =>
      expect(sheet[key]).toBeUndefined(),
    );
    const scrim = flat(scrimView(tree));
    expect(scrim).toMatchObject({ justifyContent: 'flex-end', paddingBottom: 0 });
    expect(scrim.paddingHorizontal).toBeUndefined();
  });

  it('a floating / variant prop changes nothing (no such variant exists)', () => {
    const base = sheetStyle();
    expect(sheetStyle({ variant: 'floating' })).toEqual(base);
    expect(sheetStyle({ floating: true })).toEqual(base);
    expect(sheetStyle({ entrance: 'pop' })).toEqual(expect.objectContaining({ borderTopLeftRadius: 28, width: '100%' }));
  });

  it('no file in the shared kit draws a floating sheet', () => {
    const fs = require('fs');
    const path = require('path');
    const dir = __dirname;
    const offenders = fs
      .readdirSync(dir)
      .filter((name) => name.endsWith('.js') && !name.endsWith('.test.js'))
      .filter((name) => /floating\s+(bottom\s+)?sheet|variant\s*=\s*["']floating|floating\s*[:=]\s*(true|\{)/i.test(fs.readFileSync(path.join(dir, name), 'utf8')));
    expect(offenders).toEqual([]);
  });

  // App-wide: the only floating phone sheets left are the two workout
  // prompt shells below (screen-owned, outside the kit batch; flagged to the
  // PM). The list must match exactly, so a new one fails here and a fixed one
  // must be removed from it.
  // Batch-1 merge: the workout AlertSheet and Leave-workout dialog are now
  // attached too, so NO file in src may draw a floating phone sheet.
  const KNOWN_FLOATING_PENDING = [];
  it('no file in src draws a floating phone sheet', () => {
    const fs = require('fs');
    const path = require('path');
    const src = path.resolve(__dirname, '../..');
    const walk = (dir) =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          return entry.name === 'node_modules' ? [] : walk(full);
        }
        return entry.name.endsWith('.js') && !entry.name.endsWith('.test.js') ? [full] : [];
      });
    const offenders = walk(src)
      .filter((file) => /floating\s+(bottom\s+)?sheet|variant\s*=\s*["']floating|floating\s*[:=]\s*(true|\{)/i.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(src, file).split(path.sep).join('/'))
      .sort();
    expect(offenders).toEqual(KNOWN_FLOATING_PENDING);
  });
});

describe('AppModal footer and the keyboard (UX Phase 1 review)', () => {
  const footerModal = () =>
    modal({ footer: <Text>Save weight</Text>, children: <Text>Unit</Text> });
  const footerInScroll = (tree) => {
    const scroll = tree.root.findByType(ReactNative.ScrollView);
    return scroll.findAll((n) => n.type === Text && n.props.children === 'Save weight').length > 0;
  };

  // UX native final audit 27 Oct 2026, ruling 12 (A141, A150, B225, B250):
  // was "the footer scrolls with the content". In the scroll the buttons
  // scrolled out of sight above the keyboard; they now stay fixed (the fields
  // scroll in the room left).
  it('phone, keyboard open: the footer stays fixed under the content, always visible', () => {
    atWidth(PHONE);
    mockKeyboard = 320;
    const tree = render(footerModal());
    expect(footerInScroll(tree)).toBe(false);
    expect(tree.root.findAll((n) => n.type === Text && n.props.children === 'Save weight')).toHaveLength(1);
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

// P5 review M6 (Invite sheet): a phone sheet can ask for a larger top gap.
describe('AppModal sheetTopGap (phone sheet)', () => {
  it('moves the scrim padding and the sheet cap; the default stays 16', () => {
    atWidth(PHONE);
    const tree = render(modal({ sheetTopGap: 50 }));
    expect(flat(scrimView(tree)).paddingTop).toBe(50 + 40);
    expect(flat(host(tree, 'dlg')).maxHeight).toBe(HEIGHT - 50 - 40);
    const plain = render(modal());
    expect(flat(host(plain, 'dlg')).maxHeight).toBe(HEIGHT - 16 - 40);
  });
});

// UX native final audit 27 Oct 2026, "Batch (d)/(g) confirms" 4: the tablet
// dialog title stays pinned and looks the same at rest; while the body is
// scrolled a 0.07 hairline sits under the header (no layout shift).
describe('tablet pinned title hairline (Batch (d)/(g) confirms 4)', () => {
  const scrollOf = (tree) => tree.root.findAllByType(ReactNative.ScrollView)[0];
  const scrollTo = (tree, y) => act(() => scrollOf(tree).props.onScroll({ nativeEvent: { contentOffset: { x: 0, y } } }));
  const dialog = () => (
    <AppModal isOpen title="Log weight" testID="dlg" onClose={jest.fn()}>
      <Text>Body</Text>
    </AppModal>
  );

  it('none at rest; the 0.07 hairline under the header while scrolled; gone back at the top', () => {
    atWidth(TABLET);
    const tree = render(dialog());
    expect(hasHost(tree, 'app-modal-header-hairline')).toBe(false);
    scrollTo(tree, 12);
    const line = host(tree, 'app-modal-header-hairline');
    expect(host(tree, 'app-modal-header').findAll((n) => n === line)).toHaveLength(1);
    expect(flat(line)).toEqual(expect.objectContaining({ position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, backgroundColor: colors.hairline }));
    expect(colors.hairline).toBe('rgba(255, 255, 255, 0.07)');
    scrollTo(tree, 0);
    expect(hasHost(tree, 'app-modal-header-hairline')).toBe(false);
  });

  it('phones keep their header as is', () => {
    atWidth(PHONE);
    const tree = render(dialog());
    expect(scrollOf(tree).props.onScroll).toBeUndefined();
    expect(hasHost(tree, 'app-modal-header-hairline')).toBe(false);
  });
});
