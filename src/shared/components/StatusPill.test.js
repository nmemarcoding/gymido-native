import { StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import { colors, font } from '../theme/tokens';
import StatusPill, { STATUS_PILL_TONES, resolveTone } from './StatusPill';

// RN-SPEC-v2-foundation §4.3 status pill.

const flat = (style) => StyleSheet.flatten(style) ?? {};

function render(props) {
  let tree;
  act(() => {
    tree = create(<StatusPill testID="pill" {...props} />);
  });
  return tree;
}
const pill = (tree) => flat(tree.root.find((node) => node.props.testID === 'pill' && node.type === 'View').props.style);
const label = (tree, text) => tree.root.findAll((node) => node.type === Text && node.props.children === text)[0];
const mark = (tree) => tree.root.findAll((node) => typeof node.props.testID === 'string' && node.props.testID.startsWith('status-pill-'));

const CASES = [
  // tone, label, fill, ink, mark
  ['active', 'Active', colors.tealTint, colors.teal, 'status-pill-check'],
  ['completed', 'Completed', colors.successTint, colors.success, 'status-pill-check'],
  ['warning', 'Missed', colors.warningTint, colors.warning, 'status-pill-alert'],
  ['gold', "Today's workout", colors.goldTint, colors.gold, 'status-pill-dot'],
  ['danger', 'Failed', colors.dangerTextTint, colors.dangerText, 'status-pill-cross'],
  ['inactive', 'Inactive', colors.fillButton, colors.textStrong2, 'status-pill-minus'],
];

describe('StatusPill', () => {
  it.each(CASES)('%s: tinted fill, ink text and its icon/dot FIRST (never colour alone)', (tone, text, fill, ink, markID) => {
    const tree = render({ tone, label: text });
    expect(pill(tree).backgroundColor).toBe(fill);
    expect(flat(label(tree, text).props.style).color).toBe(ink);
    const marks = mark(tree);
    expect(marks.length).toBeGreaterThan(0);
    expect(marks[0].props.testID).toBe(markID);
    // The mark comes before the label.
    const row = tree.root.find((node) => node.props.testID === 'pill' && node.type === 'View');
    const kids = row.children;
    expect(kids[kids.length - 1].findAll((node) => node.type === Text).length).toBeGreaterThan(0);
    expect(kids[0].props.accessibilityElementsHidden).toBe(true);
  });

  it('neutral ("Rest day"): 0.07 white fill + text-secondary, no icon (as §4.3 draws it)', () => {
    const tree = render({ tone: 'neutral', label: 'Rest day' });
    expect(pill(tree).backgroundColor).toBe(colors.fillSkeleton);
    expect(flat(label(tree, 'Rest day').props.style).color).toBe(colors.textSecondary);
    expect(mark(tree)).toHaveLength(0);
  });

  it('size: 28 tall, padding 0 12, gap 6, radius full, 13/600; compact = 24 / 12 px / padding 0 10', () => {
    const tree = render({ tone: 'active', label: 'Active' });
    const style = pill(tree);
    expect(style.minHeight).toBe(28);
    expect(style.paddingHorizontal).toBe(12);
    expect(style.gap).toBe(6);
    expect(style.borderRadius).toBe(999);
    const text = flat(label(tree, 'Active').props.style);
    expect(text.fontSize).toBe(13);
    expect(text.fontFamily).toBe(font(600).fontFamily);
    expect(text.fontWeight).toBeUndefined();

    const small = render({ tone: 'active', label: 'Active', compact: true });
    expect(pill(small).minHeight).toBe(24);
    expect(pill(small).paddingHorizontal).toBe(10);
    expect(flat(label(small, 'Active').props.style).fontSize).toBe(12);
  });

  it('aliases: teal = active, success = completed, missed = warning, today = gold, failed = danger; unknown = neutral', () => {
    expect(resolveTone('teal')).toBe('active');
    expect(resolveTone('success')).toBe('completed');
    expect(resolveTone('missed')).toBe('warning');
    expect(resolveTone('today')).toBe('gold');
    expect(resolveTone('failed')).toBe('danger');
    expect(resolveTone('nope')).toBe('neutral');
    expect(STATUS_PILL_TONES).toEqual(expect.arrayContaining(['gold', 'active', 'completed', 'warning', 'danger', 'neutral']));
  });

  it('the label is the accessible text; the mark is hidden from screen readers', () => {
    const tree = render({ tone: 'warning', label: 'Missed' });
    expect(label(tree, 'Missed')).toBeTruthy();
    const hidden = tree.root.findAll((node) => node.props.importantForAccessibility === 'no-hide-descendants');
    expect(hidden.length).toBeGreaterThan(0);
  });
});
