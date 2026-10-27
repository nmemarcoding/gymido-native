import { StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import { muscle, textScale } from '../../shared/theme/tokens';
import PersonAvatar, { AVATAR_COLORS, AVATAR_FILL_ALPHA, avatarColor, avatarColorIndex, personInitials } from './personAvatar';

const flat = (node) => StyleSheet.flatten(node.props.style);
const host = (tree, id) => tree.root.find((node) => node.props.testID === id && typeof node.type === 'string');

describe('avatar colour rule (RN-SPEC-v2-phase5 §1)', () => {
  it('the fixed list: 0 chest, 1 back, 2 teal, 3 legs, 4 arms, 5 core', () => {
    expect(AVATAR_COLORS).toEqual([muscle.chest, muscle.back, muscle.cardio, muscle.legs, muscle.arms, muscle.core]);
    expect(AVATAR_COLORS).toEqual(['#8FA8FF', '#FFC21A', '#4FD8C4', '#9DB0CF', '#C79BFF', '#FF9A57']);
    expect(AVATAR_FILL_ALPHA).toBe(0.16);
  });

  it('index = user_id mod 6; the same id always gives the same colour (string or number)', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 13].map(avatarColorIndex)).toEqual([0, 1, 2, 3, 4, 5, 0, 1]);
    expect(avatarColor('9')).toBe(avatarColor(9));
    expect(avatarColor(9)).toBe(muscle.legs);
  });

  it('a missing or non-numeric id falls back to index 0; negatives stay in range', () => {
    expect(avatarColorIndex(undefined)).toBe(0);
    expect(avatarColorIndex('abc')).toBe(0);
    expect(avatarColorIndex(-1)).toBe(5);
  });
});

describe('personInitials (§3 a11y rule)', () => {
  it('first and last word; one word keeps two letters; empty → ""', () => {
    expect(personInitials('Sara Lopez')).toBe('SL');
    expect(personInitials('Mary Ann Lee')).toBe('ML');
    expect(personInitials('sara')).toBe('SA');
    expect(personInitials('')).toBe('');
    expect(personInitials(null)).toBe('');
  });

  it('emails: the domain is dropped, the local part splits on . _ -', () => {
    expect(personInitials('sara.lopez@example.com')).toBe('SL');
    expect(personInitials('jordan_reyes-k@x.io')).toBe('JK');
    expect(personInitials('coach@example.com')).toBe('CO');
  });
});

describe('PersonAvatar', () => {
  function render(element) {
    let tree;
    act(() => {
      tree = create(element);
    });
    return tree;
  }

  it('draws the 16 % fill and the initials in the person colour, hidden from accessibility', () => {
    const tree = render(<PersonAvatar userId={4} name="Alex Kim" size={64} />);
    const disc = host(tree, 'person-avatar');
    expect(flat(disc)).toMatchObject({ width: 64, height: 64, borderRadius: 32 });
    expect(disc.props.accessibilityElementsHidden).toBe(true);
    expect(flat(host(tree, 'person-avatar-fill'))).toMatchObject({ backgroundColor: muscle.arms, opacity: 0.16 });
    const initials = tree.root.findByType(Text);
    expect(initials.props.children).toBe('AK');
    expect(flat(initials).color).toBe(muscle.arms);
    expect(initials.props.maxFontSizeMultiplier).toBe(textScale.badge);
  });

  it('a rounded square when a radius is given; no ring by default', () => {
    const tree = render(<PersonAvatar userId={1} name="A B" size={64} radius={22} />);
    expect(flat(host(tree, 'person-avatar')).borderRadius).toBe(22);
    expect(tree.root.findAll((node) => node.props.testID === 'person-avatar-ring')).toHaveLength(0);
  });

  it('the ring: the gap in the gap colour and a 1 px line in the person colour at its alpha', () => {
    const tree = render(<PersonAvatar userId={2} name="A B" size={104} ring={{ gap: 5, alpha: 0.45 }} />);
    expect(flat(host(tree, 'person-avatar-ring'))).toMatchObject({ padding: 5, backgroundColor: '#0A0B0F' });
    expect(flat(host(tree, 'person-avatar-ring-line'))).toMatchObject({ borderWidth: 1, borderColor: muscle.cardio, opacity: 0.45 });
  });
});
