import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import HubWeekCard from './HubWeekCard';

// L3 (UX ruling for QA, web = native): Y = 0 hides "X of Y done" and the
// bar; the strip and the "Your plan started" caption stay; the card keeps
// its height (the bar's track stays, invisible). Y ≥ 1 unchanged.
const STRIP = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((key) => ({ key, kind: key === 'wed' ? 'notStarted' : 'rest', label: key, a11y: key }));
const hosts = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.type === 'string');
const texts = (tree) => tree.root.findAll((node) => typeof node.type === 'string' && node.type === 'Text').map((node) => [].concat(node.props.children).join(''));

function render(progress) {
  let tree;
  act(() => {
    tree = create(<HubWeekCard strip={STRIP} progress={progress} caption="Your plan started Wednesday." />);
  });
  return tree;
}

describe('HubWeekCard L3', () => {
  it('Y = 0: no count, the bar track invisible (kept), the strip + caption shown', () => {
    const tree = render({ done: 0, total: 0, complete: false });
    expect(hosts(tree, 'workout-week-count')).toHaveLength(0);
    const track = hosts(tree, 'workout-week-track')[0];
    expect(StyleSheet.flatten(track.props.style).opacity).toBe(0);
    expect(hosts(tree, 'workout-week-strip')).toHaveLength(1);
    expect(hosts(tree, 'workout-week-caption')).toHaveLength(1);
    expect(texts(tree).some((text) => / of .* done|^0 of 0/.test(text))).toBe(false);
    act(() => tree.unmount());
  });

  it('Y ≥ 1: "X of Y done" and the bar, unchanged', () => {
    const tree = render({ done: 1, total: 3, complete: false });
    expect(hosts(tree, 'workout-week-count')).toHaveLength(1);
    expect(StyleSheet.flatten(hosts(tree, 'workout-week-track')[0].props.style).opacity).toBeUndefined();
    expect(StyleSheet.flatten(hosts(tree, 'workout-week-bar')[0].props.style).width).toBe('33%');
    act(() => tree.unmount());
  });
});
