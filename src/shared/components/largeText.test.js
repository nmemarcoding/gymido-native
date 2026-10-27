// UX §9 large text, the shared kit: caps by role, the title rule, no
// truncated actions, minHeight on text containers, and the reflow past
// textScale.reflowAbove, at system font scales 1, 2 and 3.1 (AX5).
// React Native's Jest setup reports fontScale 2, so the window is mocked
// explicitly here.
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { act, create } from 'react-test-renderer';

import { radii, textScale } from '../theme/tokens';
import AppModal, { ModalActions } from './AppModal';
import Banner, { BannerText } from './Banner';
import Card from './Card';
import Chip from './Chip';
import ConfirmDialog from './ConfirmDialog';
import DateInput from './DateInput';
import EmptyState from './EmptyState';
import ErrorAlert, { RetryButton } from './ErrorAlert';
import ErrorBox from './ErrorBox';
import ExerciseImage from './ExerciseImage';
import { InlineError, SuccessState } from './FeedbackBox';
import FormField from './FormField';
import GlassSurface from './GlassSurface';
import { CAP_BODY, CAP_PILL, DISPLAY_TITLE_TEXT, LINE_TEXT, NAME_TEXT, NAME_TITLE_TEXT, TITLE_TEXT, useLargeTextReflow } from './largeText';
import Loader from './Loader';
import PillButton from './PillButton';
import SegmentedSwitch from './SegmentedSwitch';
import Select from './Select';
import StatusPill from './StatusPill';
import TextLink from './TextLink';
import { InlineToast, ToastCard } from './ToastHost';
import { Body, Eyebrow, Heading } from './Typography';

let mockFontScale = 1;
let mockWidth = 390;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 900, scale: 3, fontScale: mockFontScale }),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../hooks/useKeyboardHeight', () => ({ useKeyboardHeight: () => 0 }));
jest.mock('../hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('./BlurLayer', () => () => null);
jest.mock('@react-native-picker/picker', () => {
  const Picker = ({ children }) => children ?? null;
  Picker.Item = () => null;
  return { Picker };
});
jest.mock('@react-native-community/datetimepicker', () => () => null);

const SCALES = [1, 2, 3.1];

const mounted = [];
function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  mounted.push(tree);
  return tree;
}
afterEach(() => {
  mounted.splice(0).forEach((tree) => act(() => tree.unmount()));
  mockFontScale = 1;
  mockWidth = 390;
});

const flat = (node) => StyleSheet.flatten(node.props.style) ?? {};
const textNode = (tree, content) =>
  tree.root.findAll((node) => node.type === Text && [].concat(node.props.children).join('') === content)[0];
const host = (tree, testID) => tree.root.find((node) => node.props.testID === testID && typeof node.type === 'string');

// The text props §9 sets, as a plain object (absent keys stay absent).
function textProps(node) {
  const { maxFontSizeMultiplier, numberOfLines, adjustsFontSizeToFit, minimumFontScale, textBreakStrategy } = node.props;
  return { maxFontSizeMultiplier, numberOfLines, adjustsFontSizeToFit, minimumFontScale, textBreakStrategy };
}

// Every visible Text carries a cap (or is decorative and doesn't scale), and
// none is cut to one line.
// `oneLine`: texts that are one line + an ellipsis by rule (X2 Select value).
function expectAllCapped(tree, oneLine = []) {
  const nodes = tree.root.findAllByType(Text);
  expect(nodes.length).toBeGreaterThan(0);
  nodes.forEach((node) => {
    if (node.props.allowFontScaling === false) {
      return;
    }
    // A nested Text (e.g. "(optional)") inherits its parent's cap.
    let parent = node.parent;
    let insideText = false;
    while (parent) {
      insideText = insideText || parent.type === Text;
      parent = parent.parent;
    }
    if (!insideText) {
      expect(node.props.maxFontSizeMultiplier).toBeGreaterThan(0);
    }
    if (oneLine.includes(node.props.children)) {
      expect(node.props.ellipsizeMode).toBe('tail');
      return;
    }
    expect(node.props.numberOfLines === undefined || node.props.numberOfLines >= 2).toBe(true);
  });
}

describe('largeText roles (UX §9)', () => {
  it('caps come from textScale; the title rule wraps by word, 3 lines, shrinks to 0.7', () => {
    expect(CAP_BODY).toEqual({ maxFontSizeMultiplier: 2 });
    expect(CAP_PILL).toEqual({ maxFontSizeMultiplier: 1.6 });
    expect(TITLE_TEXT).toEqual({
      maxFontSizeMultiplier: textScale.title,
      numberOfLines: 3,
      adjustsFontSizeToFit: true,
      minimumFontScale: 0.7,
      textBreakStrategy: 'simple',
    });
    expect(DISPLAY_TITLE_TEXT).toMatchObject({ maxFontSizeMultiplier: textScale.display, numberOfLines: 3, adjustsFontSizeToFit: true, minimumFontScale: 0.7 });
  });

  // DECLARED change (UX X7 ruling, 27 Oct 2026; this test came in 027b5fe): NAME_RULE was
  // { ..., adjustsFontSizeToFit: true, minimumFontScale: 0.75 }. Names never shrink: 2 lines + a tail ellipsis.
  it('§1.1 long text (UX final audit X7): names 2 lines + ellipsis, no shrink, no mid-word break; lines 1 line', () => {
    const NAME_RULE = { numberOfLines: 2, ellipsizeMode: 'tail', textBreakStrategy: 'simple' };
    expect(NAME_TEXT).toEqual({ ...NAME_RULE, maxFontSizeMultiplier: textScale.body });
    expect(NAME_TITLE_TEXT).toEqual({ ...NAME_RULE, maxFontSizeMultiplier: textScale.title });
    expect(LINE_TEXT).toEqual({ maxFontSizeMultiplier: textScale.body, numberOfLines: 1, ellipsizeMode: 'tail' });
  });

  it.each([
    [1, false],
    [1.3, false],
    [2, true],
    [3.1, true],
  ])('useLargeTextReflow at fontScale %s → %s', (scale, expected) => {
    mockFontScale = scale;
    let seen;
    function Probe() {
      seen = useLargeTextReflow();
      return null;
    }
    render(<Probe />);
    expect(seen).toBe(expected);
  });
});

describe.each(SCALES)('kit at fontScale %s', (scale) => {
  beforeEach(() => {
    mockFontScale = scale;
  });

  it('PillButton: label capped 2.0, wraps (no line cap), centred; default 52 / compact 44 / cta 60 minimums', () => {
    const tree = render(
      <View>
        <PillButton title="Start this week's workout now" onPress={() => {}} />
        <PillButton title="Add" size="compact" onPress={() => {}} />
        <PillButton title="Finish workout" size="cta" onPress={() => {}} />
      </View>
    );
    const label = textNode(tree, "Start this week's workout now");
    expect(textProps(label)).toMatchObject({ maxFontSizeMultiplier: 2, numberOfLines: undefined, textBreakStrategy: 'simple' });
    expect(flat(label)).toMatchObject({ flexShrink: 1, textAlign: 'center' });
    const heights = tree.root.findAll((node) => node.props.accessibilityRole === 'button' && typeof node.type === 'string').map((node) => flat(node).minHeight);
    expect(heights).toEqual([52, 44, 60]);
    expectAllCapped(tree);
  });

  it('TextLink: capped 2.0 and never cut to one line', () => {
    const tree = render(<TextLink label="View the whole plan" arrow onPress={() => {}} />);
    expect(textProps(textNode(tree, 'View the whole plan →'))).toMatchObject({ maxFontSizeMultiplier: 2, numberOfLines: undefined });
    expectAllCapped(tree);
  });

  it('FormField: input, label, helper, error and unit capped 2.0; the input has a minHeight, never a height', () => {
    const tree = render(<FormField testID="w" label="Weight (optional)" helperText="Your current weight" error="Enter a number" unit="kg" value="" onChangeText={() => {}} />);
    const input = tree.root.findByType(TextInput);
    expect(input.props.maxFontSizeMultiplier).toBe(2);
    expect(flat(input).minHeight).toBe(50);
    expect(flat(input).height).toBeUndefined();
    expectAllCapped(tree);
  });

  // DECLARED change (UX final audit X2, 27 Oct 2026): the Select value was asserted to wrap
  // ({ numberOfLines: undefined }); it is now one line + a tail ellipsis at every scale ({ numberOfLines: 1,
  // ellipsizeMode: 'tail' }). DateInput is unchanged.
  it('Select and DateInput: value capped 2.0, Select value one line + ellipsis (X2), the box grows from 52', () => {
    const select = render(<Select testID="s" label="Goal" value="a" options={[{ value: 'a', label: 'Build muscle and strength' }]} onChange={() => {}} />);
    expect(textNode(select, 'Build muscle and strength').props).toMatchObject({ maxFontSizeMultiplier: 2, numberOfLines: 1, ellipsizeMode: 'tail' });
    const selectBox = select.root.find((node) => node.type === 'View' && node.props.pointerEvents === 'none');
    expect(flat(selectBox)).toMatchObject({ minHeight: 52 });
    expect(flat(selectBox).height).toBeUndefined();
    expectAllCapped(select, ['Build muscle and strength']);

    const date = render(<DateInput testID="dob" label="Date of birth" value="1990-04-02" onChange={() => {}} />);
    expect(flat(host(date, 'dob'))).toMatchObject({ minHeight: 52 });
    expect(flat(host(date, 'dob')).height).toBeUndefined();
    expect(textNode(date, 'Clear').props.maxFontSizeMultiplier).toBe(2);
    expectAllCapped(date);
  });

  it('Chip and SegmentedSwitch: labels capped 2.0, never cut to one line; Chip grows from 38', () => {
    const tree = render(
      <View>
        <Chip testID="c" label="Upper body" onPress={() => {}} />
        <SegmentedSwitch segments={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} value="kg" onChange={() => {}} />
      </View>
    );
    expect(textProps(textNode(tree, 'Upper body'))).toMatchObject({ maxFontSizeMultiplier: 2, numberOfLines: undefined });
    expect(flat(host(tree, 'c'))).toMatchObject({ minHeight: 38 });
    expect(textNode(tree, 'kg').props.maxFontSizeMultiplier).toBe(2);
    expectAllCapped(tree);
  });

  it('StatusPill: text capped at the pill role (1.6), wraps instead of truncating', () => {
    const tree = render(<StatusPill testID="p" label="Pending review" tone="warning" />);
    expect(textProps(textNode(tree, 'Pending review'))).toMatchObject({ maxFontSizeMultiplier: textScale.pill, numberOfLines: undefined });
    expect(flat(textNode(tree, 'Pending review')).flexShrink).toBe(1);
    expect(flat(host(tree, 'p'))).toMatchObject({ minHeight: 28, maxWidth: '100%' });
    expect(flat(host(tree, 'p')).height).toBeUndefined();
  });

  it('Card and Typography: titles follow the title rule; body text capped 2.0', () => {
    const card = render(
      <Card title="Weekly volume" subtitle="Last 7 days">
        <Text>x</Text>
      </Card>
    );
    expect(textProps(textNode(card, 'Weekly volume'))).toEqual(TITLE_TEXT);
    expect(textNode(card, 'Last 7 days').props.maxFontSizeMultiplier).toBe(2);

    const type = render(
      <View>
        <Eyebrow>Active plan</Eyebrow>
        <Heading>Supercalifragilistic</Heading>
        <Body>4 days / week</Body>
      </View>
    );
    expect(textProps(textNode(type, 'Supercalifragilistic'))).toEqual(TITLE_TEXT);
    expect(textNode(type, 'Supercalifragilistic').props.accessibilityRole).toBe('header');
    expect(textNode(type, 'Active plan').props.maxFontSizeMultiplier).toBe(2);
    expect(textNode(type, '4 days / week').props.maxFontSizeMultiplier).toBe(2);
  });

  it('EmptyState: title rule; the action is full width only past 1.3', () => {
    const tree = render(<EmptyState title="No plans yet" message="Create one to start." actionLabel="Create a plan" actionTestID="go" onAction={() => {}} />);
    expect(textProps(textNode(tree, 'No plans yet'))).toEqual(TITLE_TEXT);
    const stacked = scale > textScale.reflowAbove;
    expect(tree.root.findByType(PillButton).props.fullWidth).toBe(stacked);
    expect(flat(host(tree, 'empty-state-action')).alignSelf).toBe(stacked ? 'stretch' : undefined);
    expectAllCapped(tree);
  });

  it('InlineError, SuccessState, ErrorBox, Banner and Loader: every text capped 2.0', () => {
    const tree = render(
      <View>
        <InlineError title="Couldn't save" message="Try again." />
        <SuccessState title="Saved" message="All set." />
        <ErrorBox title="Error" message="Something broke." />
        <Banner title="Heads up" warningTitle>
          <BannerText>Your plan ends this week.</BannerText>
        </Banner>
        <Loader />
      </View>
    );
    expectAllCapped(tree);
    expect(textNode(tree, 'Your plan ends this week.').props.maxFontSizeMultiplier).toBe(2);
  });

  // FINAL-AUDIT batch-1 ruling: the Retry is always UNDER the text; past 1.3
  // it also takes the text column's full width (UX §9 rule 4).
  it('ErrorAlert: the Retry sits under the text; past 1.3 full width; label capped 2.0', () => {
    const tree = render(<ErrorAlert testID="ea" title="Couldn't load" description="Check your connection." onRetry={() => {}} retryTestID="retry" />);
    const stacked = scale > textScale.reflowAbove;
    expect(flat(host(tree, 'ea')).flexWrap).toBeUndefined();
    const retry = flat(host(tree, 'retry'));
    if (stacked) {
      expect(retry.width).toBe('100%');
    } else {
      expect(retry).toMatchObject({ alignSelf: 'flex-start' });
      expect(retry.width).toBeUndefined();
    }
    expect(flat(host(tree, 'retry')).minHeight).toBe(38);
    expectAllCapped(tree);
  });

  it('RetryButton: label capped 2.0, not cut', () => {
    const tree = render(<RetryButton onPress={() => {}} />);
    expect(textProps(textNode(tree, 'Retry'))).toMatchObject({ maxFontSizeMultiplier: 2, numberOfLines: undefined });
  });

  it('Toast: one-line pill at ≤ 1.3, the stacked card past it; text capped 2.0', () => {
    const tree = render(<ToastCard tone="success" title="Weight log saved" message="" onClose={() => {}} />);
    const glass = tree.root.findByType(GlassSurface);
    const stacked = scale > textScale.reflowAbove;
    expect(glass.props.radius).toBe(stacked ? radii.lg : radii.full);
    expect(flat(glass)).toMatchObject(stacked ? { alignItems: 'flex-start', paddingVertical: 12 } : { minHeight: 52, alignItems: 'center' });
    expect(textProps(textNode(tree, 'Weight log saved'))).toMatchObject({ maxFontSizeMultiplier: 2, numberOfLines: undefined });

    const two = render(<InlineToast tone="error" title="Couldn't save" message="Try again." />);
    expect(two.root.findByType(GlassSurface).props.radius).toBe(radii.lg);
    expectAllCapped(two);
  });

  it('AppModal phone: title rule at the title cap; description capped 2.0', () => {
    const tree = render(<AppModal isOpen title="Delete this plan permanently?" description="This can't be undone." onClose={() => {}} />);
    expect(textProps(textNode(tree, 'Delete this plan permanently?'))).toEqual(TITLE_TEXT);
    expect(textNode(tree, "This can't be undone.").props.maxFontSizeMultiplier).toBe(2);
  });

  it('AppModal tablet: the 34 px title uses the display cap (1.3)', () => {
    mockWidth = 1024;
    const tree = render(<AppModal isOpen title="Edit plan" onClose={() => {}} />);
    expect(textProps(textNode(tree, 'Edit plan'))).toEqual(DISPLAY_TITLE_TEXT);
  });

  it('ConfirmDialog footer: phone always stacks (verb on top); tablet stacks only past 1.3', () => {
    const footerStyle = (tree) => flat(tree.root.findByType(ModalActions).findByType(View));
    const phone = render(<ConfirmDialog isOpen testID="cd" title="Remove client?" confirmLabel="Remove" onClose={() => {}} onConfirm={() => {}} />);
    expect(footerStyle(phone).flexDirection).toBe('column-reverse');

    mockWidth = 1024;
    const tablet = render(<ConfirmDialog isOpen testID="cd" title="Remove client?" confirmLabel="Remove" onClose={() => {}} onConfirm={() => {}} />);
    const stacked = scale > textScale.reflowAbove;
    expect(footerStyle(tablet).flexDirection).toBe(stacked ? 'column-reverse' : 'row');
    // Cancel first in the tree, so column-reverse puts the verb on top; a
    // column stretches both to full width.
    const titles = tablet.root.findByType(ModalActions).findAllByType(PillButton).map((node) => node.props.title);
    expect(titles).toEqual(['Cancel', 'Remove']);
    expect(footerStyle(tablet).alignItems).toBeUndefined();
  });

  it('ExerciseImage initials stay decorative fixed-size glyphs (no font scaling)', () => {
    const tree = render(<ExerciseImage exercise={{ name: 'Plank', primary_muscle_group: { code: 'core' } }} size={56} />);
    expect(tree.root.findByType(Text).props.allowFontScaling).toBe(false);
  });
});

describe('live font-scale change re-lays out (UX §9 rule 5)', () => {
  it('ModalActions, EmptyState, ErrorAlert and the toast follow a new fontScale without a remount', () => {
    mockWidth = 1024;
    const ui = () => (
      <View>
        <ModalActions>
          <PillButton title="Cancel" onPress={() => {}} />
          <PillButton title="Save" onPress={() => {}} />
        </ModalActions>
        <EmptyState title="Empty" actionLabel="Add" onAction={() => {}} />
        <ErrorAlert testID="ea" title="Oops" onRetry={() => {}} retryTestID="retry" />
        <ToastCard tone="info" title="Saved" message="" />
      </View>
    );
    const tree = render(ui());
    const actions = () => flat(tree.root.findByType(ModalActions).findByType(View)).flexDirection;
    expect(actions()).toBe('row');
    expect(tree.root.findAllByType(PillButton)[2].props.fullWidth).toBe(false);
    expect(tree.root.findByType(GlassSurface).props.radius).toBe(radii.full);

    mockFontScale = 3.1;
    act(() => tree.update(ui()));
    expect(actions()).toBe('column-reverse');
    expect(tree.root.findAllByType(PillButton)[2].props.fullWidth).toBe(true);
    expect(flat(host(tree, 'retry')).width).toBe('100%');
    expect(tree.root.findByType(GlassSurface).props.radius).toBe(radii.lg);

    mockFontScale = 1;
    act(() => tree.update(ui()));
    expect(actions()).toBe('row');
  });
});

describe('PillButton wrapped label (UX §9 rule 2)', () => {
  const layoutLines = (tree, title, count) =>
    act(() => textNode(tree, title).props.onTextLayout({ nativeEvent: { lines: Array.from({ length: count }, () => ({})) } }));
  const pill = (tree) => flat(tree.root.find((node) => node.props.accessibilityRole === 'button' && typeof node.type === 'string'));

  it('compact grows to a 52 minimum once its label wraps, and back when it fits', () => {
    mockFontScale = 3.1;
    const tree = render(<PillButton title="Add another exercise" size="compact" onPress={() => {}} />);
    expect(pill(tree).minHeight).toBe(44);
    layoutLines(tree, 'Add another exercise', 2);
    expect(pill(tree).minHeight).toBe(52);
    layoutLines(tree, 'Add another exercise', 1);
    expect(pill(tree).minHeight).toBe(44);
  });

  it('default keeps 52 and cta keeps 60 when wrapped; horizontal padding unchanged', () => {
    mockFontScale = 3.1;
    const def = render(<PillButton title="Start workout now" onPress={() => {}} />);
    layoutLines(def, 'Start workout now', 2);
    expect(pill(def)).toMatchObject({ minHeight: 52, paddingHorizontal: 24 });
    const cta = render(<PillButton title="Finish and save" size="cta" onPress={() => {}} />);
    layoutLines(cta, 'Finish and save', 2);
    expect(pill(cta)).toMatchObject({ minHeight: 60, paddingHorizontal: 24 });
  });

  it('still a 44+ target and still fires at AX5', () => {
    mockFontScale = 3.1;
    const onPress = jest.fn();
    const tree = render(<PillButton title="Go" size="compact" onPress={onPress} />);
    expect(pill(tree).minHeight).toBeGreaterThanOrEqual(44);
    act(() => tree.root.find((node) => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function').props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
