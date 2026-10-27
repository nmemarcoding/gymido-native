import { AppState, StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import { colors } from '../../../shared/theme/tokens';
import { PROMPT_SCRIM_BLUR } from './AlertSheet';
import { DiscardDialog, ExactAlarmDialog, SpeakIntroDialog } from './RuntimeOverlays';
import { isForeground } from './useForegroundBlur';

// Lead ruling (UX F2 "Rest alerts on time" + tokens §10): the A2 backdrop is a
// DIMMED scrim over the live Rest screen, color-scrim 0.6 + blur 8, the same
// as the Discard dialog, phone and tablet; never opaque, including when it
// opens on return from the background.

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('react-native-svg', () => {
  const Mock = ({ children }) => children ?? null;
  return { __esModule: true, default: Mock, Circle: Mock, Path: Mock };
});
jest.mock('../../../shared/components/GradientFill', () => () => null);
jest.mock('../../../shared/components/BlurLayer', () => {
  const { View } = require('react-native');
  return (props) => <View testID="blur-layer" blurPx={props.blurPx} overApp={props.overApp} />;
});
let mockWidth = 390;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 844, scale: 3, fontScale: 1 }),
}));

let appStateListener = null;
let currentState = 'active';

beforeEach(() => {
  mockWidth = 390;
  currentState = 'active';
  appStateListener = null;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((type, listener) => {
    appStateListener = listener;
    return { remove: jest.fn() };
  });
  Object.defineProperty(AppState, 'currentState', { configurable: true, get: () => currentState });
});

const mounted = [];
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
  jest.restoreAllMocks();
});

const DIALOGS = {
  a2: { element: () => <ExactAlarmDialog open onNotNow={() => {}} onOpenSettings={() => {}} />, id: 'exact-alarm-dialog' },
  discard: { element: () => <DiscardDialog open onKeep={() => {}} onDiscard={() => {}} />, id: 'discard-dialog' },
  speak: { element: () => <SpeakIntroDialog open onKeepOn={() => {}} onTurnOff={() => {}} onOpenAnnounceSettings={() => {}} />, id: 'speak-intro-dialog' },
};

function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  mounted.push(tree);
  return tree;
}

const hosts = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.type === 'string');
const blurs = (tree) => hosts(tree, 'blur-layer');
const scrimStyle = (tree, id) => StyleSheet.flatten(hosts(tree, `${id}-scrim`)[0].props.style);

describe('A2 backdrop: dimmed scrim, never opaque', () => {
  for (const [name, width] of [
    ['phone', 390],
    ['tablet', 834],
  ]) {
    it(`${name}: color-scrim 0.6 + blur 8 over the app (the Discard dialog's backdrop)`, () => {
      mockWidth = width;
      const tree = render(DIALOGS.a2.element());
      expect(scrimStyle(tree, DIALOGS.a2.id).backgroundColor).toBe(colors.scrim);
      expect(colors.scrim).toBe('rgba(10, 11, 15, 0.6)');
      expect(blurs(tree)).toHaveLength(1);
      expect(blurs(tree)[0].props.blurPx).toBe(8);
      expect(PROMPT_SCRIM_BLUR).toBe(8);
      expect(blurs(tree)[0].props.overApp).toBe(true);
    });

    it(`${name}: A2, Discard and A3 share exactly the same backdrop`, () => {
      mockWidth = width;
      const looks = Object.values(DIALOGS).map(({ element, id }) => {
        const tree = render(element());
        return { scrim: scrimStyle(tree, id).backgroundColor, blur: blurs(tree).map((b) => [b.props.blurPx, b.props.overApp]) };
      });
      expect(looks[1]).toEqual(looks[0]);
      expect(looks[2]).toEqual(looks[0]);
    });
  }

  it('nothing between the scrim and the Rest screen paints a solid fill', () => {
    const tree = render(DIALOGS.a2.element());
    const scrim = hosts(tree, `${DIALOGS.a2.id}-scrim`)[0];
    // The scrim's ancestors up to the Modal carry no background.
    let node = scrim.parent;
    while (node && node.type !== 'Modal' && typeof node.type !== 'function') {
      if (typeof node.type === 'string') {
        expect(StyleSheet.flatten(node.props.style)?.backgroundColor).toBeUndefined();
      }
      node = node.parent;
    }
    const modal = tree.root.findAll((n) => n.props.transparent !== undefined && n.props.visible !== undefined)[0];
    expect(modal.props.transparent).toBe(true);
  });

  it('opened while the app is in the background: no blur (no stale capture), the 0.6 scrim alone', () => {
    currentState = 'background';
    const tree = render(DIALOGS.a2.element());
    expect(blurs(tree)).toHaveLength(0);
    expect(scrimStyle(tree, DIALOGS.a2.id).backgroundColor).toBe(colors.scrim);
  });

  it('returning to the foreground mounts a FRESH blur; leaving drops it again', () => {
    const tree = render(DIALOGS.a2.element());
    const first = blurs(tree)[0];
    act(() => appStateListener('background'));
    expect(blurs(tree)).toHaveLength(0);
    expect(scrimStyle(tree, DIALOGS.a2.id).backgroundColor).toBe(colors.scrim);
    act(() => appStateListener('active'));
    expect(blurs(tree)).toHaveLength(1);
    // A new instance, not the one that captured while away.
    expect(blurs(tree)[0]).not.toBe(first);
  });

  it('an inactive app (the permission prompt / settings on top) also drops the blur', () => {
    const tree = render(DIALOGS.a2.element());
    act(() => appStateListener('inactive'));
    expect(blurs(tree)).toHaveLength(0);
    act(() => appStateListener('active'));
    expect(blurs(tree)).toHaveLength(1);
  });

  it('isForeground: active and an unknown launch state draw the blur; background / inactive do not', () => {
    expect(isForeground('active')).toBe(true);
    expect(isForeground(undefined)).toBe(true);
    expect(isForeground('unknown')).toBe(true);
    expect(isForeground('background')).toBe(false);
    expect(isForeground('inactive')).toBe(false);
  });
});
