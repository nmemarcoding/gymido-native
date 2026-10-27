import Svg, { Path } from 'react-native-svg';
import { act, create } from 'react-test-renderer';

import { colors } from '../../../../shared/theme/tokens';
import { CheckIcon, ChevronIcon, DumbbellIcon, SearchIcon } from './pickerIcons';

function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  return tree;
}

const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' };

describe('pickerIcons (v2 §3 icon rule)', () => {
  it('dumbbell: the workout glyph at stroke 2.6, round caps and joins, explicit size', () => {
    const tree = render(<DumbbellIcon color={colors.gold} />);
    expect(tree.root.findByType(Svg).props).toMatchObject({ width: 24, height: 24, ...hidden });
    expect(tree.root.findByType(Path).props).toMatchObject({ stroke: colors.gold, strokeWidth: 2.6, strokeLinecap: 'round', strokeLinejoin: 'round' });
    expect(render(<DumbbellIcon color={colors.gold} size={28} />).root.findByType(Svg).props).toMatchObject({ width: 28, height: 28 });
  });

  it('search glass: stroke 2.2, round caps and joins, 15 by default', () => {
    const svg = render(<SearchIcon />).root.findByType(Svg);
    expect(svg.props).toMatchObject({ width: 15, height: 15, strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round', ...hidden });
  });

  it('check: round caps and joins, 11 by default', () => {
    const tree = render(<CheckIcon />);
    expect(tree.root.findByType(Svg).props).toMatchObject({ width: 11, height: 11, ...hidden });
    expect(tree.root.findByType(Path).props).toMatchObject({ strokeLinecap: 'round', strokeLinejoin: 'round' });
  });

  it('chevron: explicit 10×6, round caps and joins', () => {
    const tree = render(<ChevronIcon />);
    expect(tree.root.findByType(Svg).props).toMatchObject({ width: 10, height: 6, ...hidden });
    expect(tree.root.findByType(Path).props).toMatchObject({ strokeLinecap: 'round', strokeLinejoin: 'round' });
  });
});
