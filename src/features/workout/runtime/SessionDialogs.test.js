import { Modal, StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import { colors } from '../../../shared/theme/tokens';
import { AppState } from 'react-native';

import PillButton from '../../../shared/components/PillButton';
import { PROMPT_SCRIM_BLUR } from './AlertSheet';
import { DiscardDialog } from './RuntimeOverlays';
import * as SessionDialogs from './SessionDialogs';
import { LeaveWorkoutDialog, SESSION_DIALOG_TABLET_WIDTH } from './SessionDialogs';

// Review M4/M5 (DECLARED move): the Discard tests below ran on 3b's DiscardWorkoutDialog (SessionDialogs), which was
// the one SessionRuntime rendered while 3c's AlertSheet DiscardDialog was the tested one; now ONE shell ships: the
// AlertSheet DiscardDialog (RuntimeOverlays). Every assertion is kept and pointed at it; changed values are marked.
const DiscardWorkoutDialog = DiscardDialog;

jest.mock('react-native-svg', () => {
  const Mock = ({ children }) => children ?? null;
  return { __esModule: true, default: Mock, Path: Mock, Rect: Mock, Circle: Mock, Defs: Mock, LinearGradient: Mock, Stop: Mock, G: Mock };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 20, bottom: 34, left: 0, right: 0 }) }));
jest.mock('../../../shared/components/GradientFill', () => () => null);
jest.mock('../../../shared/components/BlurLayer', () => {
  const { View } = require('react-native');
  return (props) => <View testID="blur-layer" {...props} />;
});
let mockWidth = 390;
let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 844, scale: 3, fontScale: mockFontScale }),
}));

const trees = [];
afterEach(() => {
  mockWidth = 390;
  mockFontScale = 1;
  act(() => trees.splice(0).forEach((tree) => tree.unmount()));
});

function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  trees.push(tree);
  return tree;
}
const button = (tree, id) => tree.root.findAll((node) => node.props.testID === id && node.props.title !== undefined)[0];
const host = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.type === 'string')[0];
// The action buttons in render order (PillButtons only: AlertSheet also takes `title` / `variant`).
const order = (tree) => tree.root.findAllByType(PillButton).map((node) => node.props.title);
const texts = (tree) => tree.root.findAll((node) => node.type === 'Text').map((node) => [].concat(node.props.children).join(''));

describe('Discard workout? (F1, ND6)', () => {
  it('phone: the copy, verb first (Discard, then Keep going), danger + glass', () => {
    const onKeep = jest.fn();
    const onDiscard = jest.fn();
    const tree = render(<DiscardWorkoutDialog open onKeep={onKeep} onDiscard={onDiscard} />);
    expect(texts(tree)).toEqual(expect.arrayContaining(['Discard this workout?', "Your progress won't be saved and this session will be discarded."]));
    expect(order(tree)).toEqual(['Discard', 'Keep going']);
    expect(button(tree, 'discard-confirm').props.variant).toBe('danger');
    expect(button(tree, 'discard-keep').props.variant).toBe('secondary');
    act(() => button(tree, 'discard-confirm').props.onPress());
    expect(onDiscard).toHaveBeenCalledTimes(1);
    act(() => button(tree, 'discard-keep').props.onPress());
    expect(onKeep).toHaveBeenCalledTimes(1);
  });

  it('the scrim does nothing; Android Back = Keep going', () => {
    const onKeep = jest.fn();
    const tree = render(<DiscardWorkoutDialog open onKeep={onKeep} onDiscard={jest.fn()} />);
    expect(tree.root.findAll((node) => node.props.testID === 'discard-dialog-scrim')[0].props.onPress).toBeUndefined();
    act(() => tree.root.findByType(Modal).props.onRequestClose());
    expect(onKeep).toHaveBeenCalledTimes(1);
  });

  it('phone sheet: floating, radius 32, surface-card-2, the grab handle and the phone scrim blur', () => {
    const tree = render(<DiscardWorkoutDialog open onKeep={jest.fn()} onDiscard={jest.fn()} />);
    const card = StyleSheet.flatten(host(tree, 'discard-dialog').props.style);
    expect(card).toMatchObject({ borderRadius: 32, backgroundColor: colors.surfaceCard2 });
    expect(host(tree, 'discard-dialog-handle')).toBeDefined();
    // DECLARED: was 4 (blur.scrim); the one prompt blur is 8 (F1:337 "one blur across dialogs", F2).
    expect(tree.root.findAll((node) => node.props.testID === 'blur-layer')[0].props.blurPx).toBe(PROMPT_SCRIM_BLUR);
    expect(PROMPT_SCRIM_BLUR).toBe(8);
  });

  it('tablet: a 520 card, Keep going LEFT · Discard RIGHT, the danger edge and the tablet blur', () => {
    mockWidth = 834;
    const tree = render(<DiscardWorkoutDialog open onKeep={jest.fn()} onDiscard={jest.fn()} />);
    const card = StyleSheet.flatten(host(tree, 'discard-dialog').props.style);
    expect(card).toMatchObject({ maxWidth: SESSION_DIALOG_TABLET_WIDTH, borderColor: colors.dangerLine });
    expect(SESSION_DIALOG_TABLET_WIDTH).toBe(520);
    expect(order(tree)).toEqual(['Keep going', 'Discard']);
    expect(host(tree, 'discard-dialog-handle')).toBeUndefined();
    // DECLARED: was 6 (blur.scrimTablet); the one prompt blur is 8.
    expect(tree.root.findAll((node) => node.props.testID === 'blur-layer')[0].props.blurPx).toBe(PROMPT_SCRIM_BLUR);
  });

  it.each([1, 2, 3.1])('at %sx the tablet pair stacks past 1.3× (verb on top) and the title keeps the title rule', (scale) => {
    mockWidth = 834;
    mockFontScale = scale;
    const tree = render(<DiscardWorkoutDialog open onKeep={jest.fn()} onDiscard={jest.fn()} />);
    expect(order(tree)).toEqual(scale > 1.3 ? ['Discard', 'Keep going'] : ['Keep going', 'Discard']);
    const title = tree.root.findAll((node) => node.type === 'Text' && node.props.children === 'Discard this workout?')[0];
    expect(title.props).toMatchObject({ adjustsFontSizeToFit: true, textBreakStrategy: 'simple', accessibilityRole: 'header' });
  });

  it('closed: nothing visible', () => {
    const tree = render(<DiscardWorkoutDialog open={false} onKeep={jest.fn()} onDiscard={jest.fn()} />);
    expect(tree.root.findByType(Modal).props.visible).toBe(false);
  });

  it('M4: the dead duplicate shell is gone (SessionDialogs exports no Discard dialog)', () => {
    expect(SessionDialogs.DiscardWorkoutDialog).toBeUndefined();
  });
});

// Review M5: the Leave sheet drops its backdrop blur while the app is away and starts a fresh one on return (the
// A2 "solid backdrop after backgrounding" fix, useForegroundBlur), and uses the one prompt blur (8).
describe('Leave workout? backdrop (M5)', () => {
  it('the blur only in the foreground, a fresh one on return; 8 px on phone and tablet', () => {
    let listener;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
      listener = handler;
      return { remove: jest.fn() };
    });
    [390, 834].forEach((width) => {
      mockWidth = width;
      const tree = render(<LeaveWorkoutDialog open onStay={jest.fn()} onLeave={jest.fn()} />);
      const blurs = () => tree.root.findAll((node) => node.props.testID === 'blur-layer' && typeof node.type === 'string');
      expect(blurs()).toHaveLength(1);
      expect(blurs()[0].props.blurPx).toBe(PROMPT_SCRIM_BLUR);
      act(() => listener('background'));
      expect(blurs()).toHaveLength(0);
      act(() => listener('active'));
      expect(blurs()).toHaveLength(1);
    });
    jest.restoreAllMocks();
  });
});

describe('Leave workout? (native, dated change 23 Oct)', () => {
  it('phone: the copy, Leave (light) on top, Stay (glass); scrim and Back = Stay', () => {
    const onStay = jest.fn();
    const onLeave = jest.fn();
    const tree = render(<LeaveWorkoutDialog open onStay={onStay} onLeave={onLeave} />);
    expect(texts(tree)).toEqual(expect.arrayContaining(['Leave workout?', 'Your workout stays saved. You can pick it up from Today.']));
    expect(order(tree)).toEqual(['Leave', 'Stay']);
    expect(button(tree, 'leave-workout-leave').props.variant).toBe('light');
    act(() => button(tree, 'leave-workout-leave').props.onPress());
    expect(onLeave).toHaveBeenCalledTimes(1);
    act(() => tree.root.findAll((node) => node.props.testID === 'leave-workout-dialog-scrim')[0].props.onPress());
    act(() => tree.root.findByType(Modal).props.onRequestClose());
    expect(onStay).toHaveBeenCalledTimes(2);
  });

  it('tablet: Stay LEFT · Leave RIGHT on the card gradient (no danger edge)', () => {
    mockWidth = 1024;
    const tree = render(<LeaveWorkoutDialog open onStay={jest.fn()} onLeave={jest.fn()} />);
    expect(order(tree)).toEqual(['Stay', 'Leave']);
    expect(StyleSheet.flatten(host(tree, 'leave-workout-dialog').props.style).borderColor).toBe(colors.hairlineStrong);
  });
});
