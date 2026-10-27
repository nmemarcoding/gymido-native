import { StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import DesktopSidebar from './DesktopSidebar';
import GymIcon from './GymIcon';

jest.mock('../auth/authService', () => ({ logout: jest.fn() }));
jest.mock('./shellLinks', () => ({ openShellPath: jest.fn() }));

const { logout } = require('../auth/authService');
const { openShellPath } = require('./shellLinks');

function render(props) {
  let tree;
  act(() => {
    tree = create(<DesktopSidebar mode="member" path="/plans" {...props} />);
  });
  return tree;
}

const links = (tree) => tree.root.findAll((node) => node.props.accessibilityRole === 'link' && typeof node.props.style === 'function');
const link = (tree, label) => links(tree).find((node) => renderItem(node, false).label.props.children === label);
function renderItem(node, pressed) {
  let inner;
  act(() => {
    inner = create(<>{node.props.children({ pressed })}</>);
  });
  return { icon: inner.root.findByType(GymIcon), label: inner.root.findByType(Text) };
}
const itemStyle = (node, pressed) => StyleSheet.flatten(node.props.style({ pressed }));
const hostCards = (tree) =>
  tree.root.findAll((node) => typeof node.type === 'string' && StyleSheet.flatten(node.props.style)?.borderRadius === 24);

afterEach(() => jest.clearAllMocks());

describe('DesktopSidebar tablet restyle (v2 tokens; rail deferred to Phase 8)', () => {
  it('draws surface cards with a hairline and no retired shadow', () => {
    const cards = hostCards(render());
    expect(cards.length).toBe(2);
    cards.forEach((card) =>
      expect(StyleSheet.flatten(card.props.style)).toMatchObject({ backgroundColor: '#15171D', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.07)' })
    );
    cards.forEach((card) => expect(StyleSheet.flatten(card.props.style).boxShadow).toBeUndefined());
  });

  it('intro eyebrow: 12/600 gold, sentence case', () => {
    const eyebrow = render().root.findAllByType(Text)[0];
    const style = StyleSheet.flatten(eyebrow.props.style);
    expect(style).toMatchObject({ fontSize: 12, fontFamily: 'Geist-SemiBold', color: '#FFC21A' });
    expect(style.textTransform).toBeUndefined();
  });

  it('active item: gold tint, gold 22 px icon, 14/600 gold label, selected', () => {
    const tree = render();
    const plans = link(tree, 'Plans');
    expect(plans.props.accessibilityState).toEqual({ selected: true });
    expect(itemStyle(plans, false)).toMatchObject({ borderRadius: 12, minHeight: 44, gap: 10, backgroundColor: 'rgba(255, 194, 26, 0.14)' });
    const { icon, label } = renderItem(plans, false);
    expect(icon.props).toMatchObject({ size: 22, color: '#FFC21A' });
    expect(StyleSheet.flatten(label.props.style)).toMatchObject({ fontSize: 14, fontFamily: 'Geist-SemiBold', color: '#FFC21A' });
  });

  it('inactive item: text-secondary 500; pressed: chip fill and primary ink', () => {
    const tree = render();
    const today = link(tree, 'Today');
    expect(today.props.accessibilityState).toEqual({ selected: false });
    expect(itemStyle(today, false).backgroundColor).toBeUndefined();
    expect(StyleSheet.flatten(renderItem(today, false).label.props.style)).toMatchObject({ fontFamily: 'Geist-Medium', color: '#B4B9C3' });
    expect(itemStyle(today, true).backgroundColor).toBe('rgba(255, 255, 255, 0.05)');
    expect(renderItem(today, true).icon.props.color).toBe('#F5F6F8');
  });

  it('trainer mode lists the trainer items', () => {
    const labels = links(render({ mode: 'trainer', path: '/trainer' })).map((node) => renderItem(node, false).label.props.children);
    expect(labels).toEqual(['Today', 'Clients', 'Plans', 'Profile']);
  });

  it('items navigate and Logout logs out (behaviour unchanged)', () => {
    const tree = render();
    const exercises = link(tree, 'Exercises');
    act(() => exercises.props.onPress());
    expect(openShellPath).toHaveBeenCalledWith('/exercises');
    const logoutButton = tree.root.findAll((node) => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function')[0];
    expect(StyleSheet.flatten(logoutButton.props.style({ pressed: false })).minHeight).toBe(44);
    act(() => logoutButton.props.onPress());
    expect(logout).toHaveBeenCalledTimes(1);
  });
});
