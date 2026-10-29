import { AccessibilityInfo, Platform, Share, StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import { colors, shadows } from '../../../shared/theme/tokens';
import { CompletionPopup, DiscardButton, DiscardDialog, ExactAlarmDialog, SpeakIntroDialog } from './RuntimeOverlays';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('react-native-svg', () => {
  const Mock = ({ children }) => children ?? null;
  return { __esModule: true, default: Mock, Circle: Mock, Path: Mock };
});
jest.mock('../../../shared/components/GradientFill', () => () => null);
jest.mock('../../../shared/components/BlurLayer', () => () => null);
jest.mock('../../../shared/components/RemoteImage', () => {
  const { View } = require('react-native');
  return (props) => <View testID="remote-image" {...props} />;
});
let mockReducedMotion = false;
jest.mock('../../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => mockReducedMotion }));
let mockWidth = 390;
let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: mockWidth > 700 ? 1194 : 844, scale: 2, fontScale: mockFontScale }),
}));

const mounted = [];
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
  mockWidth = 390;
  mockFontScale = 1;
  mockReducedMotion = false;
  jest.restoreAllMocks();
});

function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  mounted.push(tree);
  return tree;
}

const host = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.type === 'string')[0];
const all = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.type === 'string');
const pressable = (tree, id) => tree.root.findAll((node) => node.props.testID === id && node.props.onPress)[0];
const text = (node) =>
  []
    .concat(node.props.children)
    .map((child) => (typeof child === 'string' || typeof child === 'number' ? String(child) : child?.props ? text(child) : ''))
    .join('');
const texts = (tree) => tree.root.findAll((node) => node.type === 'Text').map(text);
const flat = (node) => StyleSheet.flatten(node.props.style);

const POPUP = {
  planName: 'Upper / Lower Split',
  durationSeconds: 3130,
  totalVolume: 9820,
  totalReps: 142,
  completedSets: 15,
  totalSets: 15,
  completedExercises: 5,
  totalExercises: 5,
};
const RECORDS = [
  { exercise_id: 1, exercise_name: 'Barbell Bench Press', record_type: 'weight', value: 145, unit: 'lb', previous_value: 140 },
  { exercise_id: 1, exercise_name: 'Barbell Bench Press', record_type: 'reps', value: 12, unit: '', previous_value: 10 },
  { exercise_id: 2, exercise_name: 'Squat', record_type: 'weight', value: 200, unit: 'lb', previous_value: null },
];

describe('Workout complete, phone (UX F2 Workout complete)', () => {
  it('full-screen dialog: badge, copy, the 4 stats, sets line, Awesome + Share summary', () => {
    const tree = render(<CompletionPopup popup={POPUP} onClose={() => {}} />);
    const popup = host(tree, 'completion-popup');
    expect(popup.props.role).toBe('dialog');
    expect(popup.props.accessibilityLabel).toBe('Workout complete');
    expect(flat(popup).backgroundColor).toBe(colors.ground);
    expect(host(tree, 'completion-ring').props.accessibilityLabel).toBe('15 of 15 sets completed');
    expect(texts(tree)).toEqual(
      expect.arrayContaining([
        'Workout complete',
        'Great job!',
        'You finished Upper / Lower Split and kept your momentum today.',
        '52m 10s',
        '9,820 kg', // DECLARED (batch 3 (a)): no unit → kg, was v1 '9,820 lb'
        '142',
        '5/5 ex',
        '15/15 sets done. Consistency wins.',
        'Awesome',
        'Share summary',
      ])
    );
    expect(flat(host(tree, 'completion-stats')).flexDirection).toBe('row');
    expect(all(tree, 'completion-pb')).toHaveLength(0);
  });

  it('Awesome is the one gold primary (60) and closes', () => {
    const onClose = jest.fn();
    const tree = render(<CompletionPopup popup={POPUP} onClose={onClose} />);
    expect(flat(host(tree, 'completion-awesome'))).toEqual(expect.objectContaining({ backgroundColor: colors.gold, minHeight: 60 }));
    expect(flat(host(tree, 'completion-share')).backgroundColor).toBe(colors.fillButton);
    act(() => pressable(tree, 'completion-awesome').props.onPress());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('cannot be dismissed by Android back', () => {
    const onClose = jest.fn();
    const tree = render(<CompletionPopup popup={POPUP} onClose={onClose} />);
    const modal = tree.root.findAll((node) => node.props.onRequestClose && node.props.transparent)[0];
    modal.props.onRequestClose();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows the New personal best card with beaten bests only, weight first, read as one item', () => {
    const tree = render(<CompletionPopup popup={{ ...POPUP, personalRecords: RECORDS }} onClose={() => {}} />);
    const card = host(tree, 'completion-pb');
    expect(card.props.accessibilityLabel).toBe('New personal best, Barbell Bench Press, 145 pounds times 12');
    expect(all(tree, 'completion-pb-line').map(text)).toEqual(['Barbell Bench Press · 145 lb × 12']);
    expect(flat(card).borderColor).toBe(colors.goldLine);
  });

  it('no qualifying record → no card (never an empty card)', () => {
    const tree = render(<CompletionPopup popup={{ ...POPUP, personalRecords: [RECORDS[2]] }} onClose={() => {}} />);
    expect(all(tree, 'completion-pb')).toHaveLength(0);
  });

  it('volume in the snapshot unit when SessionRuntime sends one', () => {
    const tree = render(<CompletionPopup popup={{ ...POPUP, totalVolume: 4454, volumeUnit: 'kg' }} onClose={() => {}} />);
    expect(texts(tree)).toContain('4,454 kg');
  });

  it('volume in lb when the member unit is lb (batch 3 (a))', () => {
    const tree = render(<CompletionPopup popup={{ ...POPUP, volumeUnit: 'lb' }} onClose={() => {}} />);
    expect(texts(tree)).toContain('9,820 lb');
    expect(texts(tree)).not.toContain('9,820 kg');
  });

  it('Share summary opens the share sheet with the text summary (PB lines included)', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    const tree = render(<CompletionPopup popup={{ ...POPUP, personalRecords: RECORDS }} onClose={() => {}} />);
    await act(async () => pressable(tree, 'completion-share').props.onPress());
    expect(share).toHaveBeenCalledWith({
      message: 'Workout complete: Upper / Lower Split\nTime: 52m 10s\nVolume: 9,820 kg\nReps: 142\nSets: 15/15\nNew personal best: Barbell Bench Press · 145 lb × 12',
    });
    expect(all(tree, 'completion-share-error')).toHaveLength(0);
  });

  it('a dismissed share sheet is silent', async () => {
    jest.spyOn(Share, 'share').mockResolvedValue({ action: 'dismissedAction' });
    const tree = render(<CompletionPopup popup={POPUP} onClose={() => {}} />);
    await act(async () => pressable(tree, 'completion-share').props.onPress());
    expect(all(tree, 'completion-share-error')).toHaveLength(0);
  });

  it('a share failure shows the inline alert and announces it; a retry clears it', async () => {
    const share = jest.spyOn(Share, 'share').mockRejectedValueOnce(new Error('no'));
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    const tree = render(<CompletionPopup popup={POPUP} onClose={() => {}} />);
    await act(async () => pressable(tree, 'completion-share').props.onPress());
    const error = host(tree, 'completion-share-error');
    expect(text(error)).toBe('Could not open sharing. Please try again.');
    expect(error.props.accessibilityRole).toBe('alert');
    expect(flat(error).color).toBe(colors.dangerText);
    expect(announce).toHaveBeenCalledWith('Could not open sharing. Please try again.');
    share.mockResolvedValueOnce({ action: 'sharedAction' });
    await act(async () => pressable(tree, 'completion-share').props.onPress());
    expect(all(tree, 'completion-share-error')).toHaveLength(0);
  });

  it('renders nothing without a popup', () => {
    const tree = render(<CompletionPopup popup={null} onClose={() => {}} />);
    expect(tree.toJSON()).toBeNull();
  });

  it('reduced motion: no pop-in (opacity 1 at once)', () => {
    mockReducedMotion = true;
    const tree = render(<CompletionPopup popup={POPUP} onClose={() => {}} />);
    const opacity = flat(host(tree, 'completion-popup')).opacity;
    expect(typeof opacity === 'number' ? opacity : opacity.__getValue()).toBe(1);
  });
});

describe('Workout complete, tablet (UX F2 Tablet: Workout complete)', () => {
  it('a centred 448 card, 2×2 stats with the gold Progress tile, the PB card, no Share', () => {
    mockWidth = 834;
    const tree = render(<CompletionPopup popup={{ ...POPUP, personalRecords: RECORDS }} onClose={() => {}} />);
    expect(flat(host(tree, 'completion-popup')).maxWidth).toBe(448);
    expect(flat(host(tree, 'completion-stats')).flexWrap).toBe('wrap');
    expect(flat(host(tree, 'completion-stat-progress')).backgroundColor).toBe(colors.goldTint);
    expect(all(tree, 'completion-pb')).toHaveLength(1);
    expect(all(tree, 'completion-share')).toHaveLength(0);
    expect(flat(host(tree, 'completion-awesome')).minHeight).toBe(62);
  });
});

describe('Workout complete large text (UX §9)', () => {
  for (const scale of [1, 2, 3.1]) {
    for (const width of [390, 834]) {
      it(`fontScale ${scale}, width ${width}: title capped 1.3 + shrink rule; stats reflow above 1.3; no truncated action`, () => {
        mockFontScale = scale;
        mockWidth = width;
        const tree = render(<CompletionPopup popup={{ ...POPUP, personalRecords: RECORDS }} onClose={() => {}} />);
        const title = tree.root.findAll((n) => n.type === 'Text' && text(n) === 'Great job!')[0];
        expect(title.props.maxFontSizeMultiplier).toBe(1.3);
        expect(title.props.adjustsFontSizeToFit).toBe(true);
        expect(title.props.minimumFontScale).toBe(0.7);
        const stats = flat(host(tree, 'completion-stats'));
        expect(stats.flexDirection === 'column').toBe(scale > 1.3);
        const awesome = tree.root.findAll((n) => n.type === 'Text' && text(n) === 'Awesome')[0];
        expect(awesome.props.numberOfLines).toBeUndefined();
        expect(flat(host(tree, 'completion-awesome')).height).toBeUndefined();
      });
    }
  }
});

describe('Discard dialog (UX F1 Discard workout?)', () => {
  it('phone: bottom sheet, the verb first (Discard over Keep going), danger tile; Back = Keep going; scrim does nothing', () => {
    const onKeep = jest.fn();
    const onDiscard = jest.fn();
    const tree = render(<DiscardDialog open onKeep={onKeep} onDiscard={onDiscard} />);
    expect(texts(tree)).toEqual(expect.arrayContaining(['Discard this workout?', "Your progress won't be saved and this session will be discarded.", 'Keep going', 'Discard']));
    const actions = host(tree, 'sheet-actions');
    const order = actions.findAll((n) => n.props.testID === 'discard-confirm' || n.props.testID === 'discard-keep').filter((n) => typeof n.type === 'string').map((n) => n.props.testID);
    expect(order).toEqual(['discard-confirm', 'discard-keep']);
    expect(all(tree, 'discard-dialog-handle')).toHaveLength(1);
    expect(flat(host(tree, 'discard-dialog-tile')).backgroundColor).toBe(colors.dangerTint);
    expect(flat(host(tree, 'discard-confirm')).backgroundColor).toBe(colors.danger);
    const modal = tree.root.findAll((n) => n.props.onRequestClose && n.props.transparent)[0];
    modal.props.onRequestClose();
    expect(onKeep).toHaveBeenCalledTimes(1);
    expect(host(tree, 'discard-dialog-scrim').props.onPress).toBeUndefined();
    act(() => pressable(tree, 'discard-confirm').props.onPress());
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it('tablet: centred card, Keep going then Discard in a row, no handle', () => {
    mockWidth = 834;
    const tree = render(<DiscardDialog open onKeep={() => {}} onDiscard={() => {}} />);
    expect(flat(host(tree, 'sheet-actions')).flexDirection).toBe('row');
    const order = host(tree, 'sheet-actions')
      .findAll((n) => typeof n.type === 'string' && (n.props.testID === 'discard-confirm' || n.props.testID === 'discard-keep'))
      .map((n) => n.props.testID);
    expect(order).toEqual(['discard-keep', 'discard-confirm']);
    expect(all(tree, 'discard-dialog-handle')).toHaveLength(0);
    expect(flat(host(tree, 'discard-dialog')).maxWidth).toBe(520);
  });

  it('closed → nothing visible', () => {
    const tree = render(<DiscardDialog open={false} onKeep={() => {}} onDiscard={() => {}} />);
    const modal = tree.root.findAll((n) => n.props.onRequestClose && n.props.transparent)[0];
    expect(modal.props.visible).toBe(false);
  });
});

describe('Rest alerts on time, A2 (UX F2 Exact alarm)', () => {
  it('copy, teal alarm tile, the hidden settings preview; Not now / scrim / Back = Not now; Open settings', () => {
    const onNotNow = jest.fn();
    const onOpenSettings = jest.fn();
    const tree = render(<ExactAlarmDialog open onNotNow={onNotNow} onOpenSettings={onOpenSettings} />);
    expect(texts(tree)).toEqual(
      expect.arrayContaining([
        'Get rest alerts on time?',
        'Android can hold back your rest alert, sometimes by minutes. Allow "Alarms & reminders" for Gymido so it arrives the moment your rest ends.',
        'Alarms & reminders',
        'Not now',
        'Open settings',
      ])
    );
    expect(flat(host(tree, 'exact-alarm-dialog-tile')).backgroundColor).toBe(colors.tealTint);
    expect(host(tree, 'exact-alarm-preview').props.importantForAccessibility).toBe('no-hide-descendants');
    expect(host(tree, 'exact-alarm-dialog').props.accessibilityLabel).toBe('Get rest alerts on time?');
    act(() => pressable(tree, 'exact-alarm-dialog-scrim').props.onPress());
    act(() => pressable(tree, 'exact-alarm-not-now').props.onPress());
    tree.root.findAll((n) => n.props.onRequestClose && n.props.transparent)[0].props.onRequestClose();
    expect(onNotNow).toHaveBeenCalledTimes(3);
    act(() => pressable(tree, 'exact-alarm-open-settings').props.onPress());
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    // Open settings is the gold primary, on the right (flex 1.3).
    expect(flat(host(tree, 'exact-alarm-open-settings')).backgroundColor).toBe(colors.gold);
  });

  it('moves screen-reader focus to "Open settings"', () => {
    jest.useFakeTimers();
    const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus').mockImplementation(() => {});
    const RN = require('react-native');
    jest.spyOn(RN, 'findNodeHandle').mockImplementation((ref) => (ref ? 7 : null));
    render(<ExactAlarmDialog open onNotNow={() => {}} onOpenSettings={() => {}} />);
    act(() => jest.advanceTimersByTime(300));
    expect(focus).toHaveBeenCalledWith(7);
    jest.useRealTimers();
  });

  it('large text (> 1.3) stacks the pair, primary on top', () => {
    mockFontScale = 3.1;
    const tree = render(<ExactAlarmDialog open onNotNow={() => {}} onOpenSettings={() => {}} />);
    const order = host(tree, 'sheet-actions')
      .findAll((n) => typeof n.type === 'string' && ['exact-alarm-not-now', 'exact-alarm-open-settings'].includes(n.props.testID))
      .map((n) => n.props.testID);
    expect(order).toEqual(['exact-alarm-open-settings', 'exact-alarm-not-now']);
  });
});

describe('Hear your rest timer, A3 (UX F2)', () => {
  const originalOS = Platform.OS;
  afterEach(() => {
    Platform.OS = originalOS;
  });

  it('iOS: Siri line + "Set up Siri announcements"; Keep it on / Turn off / Back / scrim', () => {
    Platform.OS = 'ios';
    const onKeepOn = jest.fn();
    const onTurnOff = jest.fn();
    const onOpenAnnounceSettings = jest.fn();
    const tree = render(<SpeakIntroDialog open onKeepOn={onKeepOn} onTurnOff={onTurnOff} onOpenAnnounceSettings={onOpenAnnounceSettings} />);
    expect(texts(tree)).toEqual(
      expect.arrayContaining([
        'Hear your rest timer',
        'We\'ll say "Rest complete" out loud when your rest ends. You can change this anytime in Profile.',
        'With AirPods, Siri can also read it out if Announce Notifications is on.',
        'Set up Siri announcements',
        'Turn off',
        'Keep it on',
      ])
    );
    expect(flat(host(tree, 'speak-intro-dialog-tile')).backgroundColor).toBe(colors.goldTint);
    act(() => pressable(tree, 'speak-intro-siri').props.onPress());
    expect(onOpenAnnounceSettings).toHaveBeenCalledTimes(1);
    act(() => pressable(tree, 'speak-intro-keep-on').props.onPress());
    act(() => pressable(tree, 'speak-intro-dialog-scrim').props.onPress());
    tree.root.findAll((n) => n.props.onRequestClose && n.props.transparent)[0].props.onRequestClose();
    expect(onKeepOn).toHaveBeenCalledTimes(3);
    act(() => pressable(tree, 'speak-intro-turn-off').props.onPress());
    expect(onTurnOff).toHaveBeenCalledTimes(1);
  });

  it('Android: no Siri elements', () => {
    Platform.OS = 'android';
    const tree = render(<SpeakIntroDialog open onKeepOn={() => {}} onTurnOff={() => {}} onOpenAnnounceSettings={() => {}} />);
    expect(texts(tree)).not.toContain('Set up Siri announcements');
    expect(all(tree, 'speak-intro-siri')).toHaveLength(0);
  });

  it('tablet: centred 520 card', () => {
    mockWidth = 834;
    const tree = render(<SpeakIntroDialog open onKeepOn={() => {}} onTurnOff={() => {}} onOpenAnnounceSettings={() => {}} />);
    expect(flat(host(tree, 'speak-intro-dialog')).maxWidth).toBe(520);
    expect(all(tree, 'speak-intro-dialog-handle')).toHaveLength(0);
  });

  for (const scale of [1, 2, 3.1]) {
    it(`fontScale ${scale}: the title keeps the shrink rule; button labels never truncate`, () => {
      mockFontScale = scale;
      const tree = render(<SpeakIntroDialog open onKeepOn={() => {}} onTurnOff={() => {}} onOpenAnnounceSettings={() => {}} />);
      const title = tree.root.findAll((n) => n.type === 'Text' && text(n) === 'Hear your rest timer')[0];
      expect(title.props.adjustsFontSizeToFit).toBe(true);
      const keep = tree.root.findAll((n) => n.type === 'Text' && text(n) === 'Keep it on')[0];
      expect(keep.props.numberOfLines).toBeUndefined();
    });
  }
});

describe('page buttons (UX F1 ND4)', () => {
  // DECLARED (T-105, PM OK 29 Oct): "Complete workout: gold primary by default, glass when a live set is left, spinner
  // while completing" tested CompleteWorkoutButton, removed with the end-of-column button. The same checks (gold,
  // glass, busy spinner) now run on the header's Complete in RuntimeParts.test.js (SessionChrome T-105).

  it('Discard workout: ghost with danger text; danger-faint when pressed; "Exiting…" while abandoning', () => {
    const tree = render(<DiscardButton abandoning={false} onPress={() => {}} />);
    const button = pressable(tree, 'discard-workout');
    expect(StyleSheet.flatten(button.props.style({ pressed: false })).backgroundColor).toBeUndefined();
    expect(StyleSheet.flatten(button.props.style({ pressed: true })).backgroundColor).toBe(colors.dangerFaint);
    expect(flat(tree.root.findAll((n) => n.type === 'Text')[0]).color).toBe(colors.dangerText);
    expect(StyleSheet.flatten(button.props.style({ pressed: false })).minHeight).toBe(52);
    const busy = render(<DiscardButton abandoning onPress={() => {}} />);
    expect(texts(busy)).toContain('Exiting…');
    expect(pressable(busy, 'discard-workout').props.disabled).toBe(true);
  });
});

describe('T-86: the gold glow only on a screen\'s one gold primary', () => {
  it('phone: the full-screen completion Awesome glows with the one token; the gold badge does not', () => {
    mockWidth = 390;
    const tree = render(<CompletionPopup popup={POPUP} onClose={() => {}} />);
    expect(flat(host(tree, 'completion-awesome')).boxShadow).toBe(shadows.goldGlow);
    expect(shadows.goldGlow).toBe('0px 10px 24px -12px rgba(255, 194, 26, 0.4)');
    tree.root
      .findAll((node) => typeof node.type === 'string' && node.props.testID !== 'completion-awesome' && node.props.style)
      .forEach((node) => expect(StyleSheet.flatten(node.props.style)?.boxShadow ?? null).not.toBe(shadows.goldGlow));
  });

  it('tablet: the completion card is a dialog, so Awesome has no glow', () => {
    mockWidth = 834;
    const tree = render(<CompletionPopup popup={POPUP} onClose={() => {}} />);
    expect(flat(host(tree, 'completion-awesome')).backgroundColor).toBe(colors.gold);
    expect(flat(host(tree, 'completion-awesome')).boxShadow).toBeUndefined();
  });

  it.each([390, 834])('a sheet / dialog gold primary (Open settings) has no glow at %i', (width) => {
    mockWidth = width;
    const tree = render(<ExactAlarmDialog open onNotNow={() => {}} onOpenSettings={() => {}} />);
    expect(flat(host(tree, 'exact-alarm-open-settings')).backgroundColor).toBe(colors.gold);
    expect(flat(host(tree, 'exact-alarm-open-settings')).boxShadow).toBeUndefined();
  });
});
