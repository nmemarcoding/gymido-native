import { Text, useWindowDimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import { LINE_TEXT, NAME_TITLE_TEXT } from '../../shared/components/largeText';
import TrainerCard from '../trainers/components/TrainerCard';
import { StatusLine } from './clients/components/ClientsUi';
import PlanCard from './plans/components/PlanCard';

// UX final audit X7 (§1.1 long text) on the coaching cards: a name wraps by
// word to at most 2 lines then an ellipsis, a single long word shrinks (0.75)
// instead of breaking; secondary lines stay 1 line. Phone 390 / tablet 834.

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const LONG = 'Supercalifragilisticexpialidocious Strength And Conditioning Programme';
const textNode = (tree, value) => tree.root.findAll((node) => node.type === Text && [].concat(node.props.children).join('') === value)[0];
const pick = (props, keys) => Object.fromEntries(keys.map((key) => [key, props[key]]));
const expectRole = (node, role) => expect(pick(node.props, Object.keys(role))).toEqual(role);

function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  return tree;
}

describe.each([
  ['phone', 390, false],
  ['tablet', 834, true],
])('X7 coaching cards, %s', (_label, width, tablet) => {
  beforeEach(() => {
    useWindowDimensions.mockReturnValue({ width, height: 900, scale: 2, fontScale: 3.1 });
  });

  it('PlanCard: the plan name 2 lines + shrink, the days line 1 line', () => {
    const tree = render(<PlanCard tablet={tablet} plan={{ id: 7, name: LONG, days_per_week: 4, category: { name: 'Strength' } }} onView={() => {}} />);
    expectRole(textNode(tree, LONG), NAME_TITLE_TEXT);
    const meta = tree.root.findAll((node) => node.type === Text && /day/i.test([].concat(node.props.children).join('')))[0];
    expectRole(meta, LINE_TEXT);
  });

  it('TrainerCard: the trainer name 2 lines + shrink', () => {
    const tree = render(<TrainerCard tablet={tablet} trainer={{ user_id: 3, display_name: LONG, bio: null }} onPress={() => {}} />);
    expectRole(textNode(tree, LONG), NAME_TITLE_TEXT);
  });

  it('StatusLine (the client row status line): 1 line + ellipsis', () => {
    const tree = render(<StatusLine tone="warning" text={LONG} />);
    expectRole(textNode(tree, LONG), LINE_TEXT);
  });
});
