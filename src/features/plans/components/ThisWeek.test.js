jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 834, height: 1194, scale: 2, fontScale: 1 }),
}));

import { act, create } from 'react-test-renderer';

import { thisWeekCards } from '../libraryFormat';
import ThisWeek from './ThisWeek';

// Review 26fc4a8 M6 + lead ruling (spec 75e618d9 "This week"): the days NOT
// done (missed, today, upcoming) keep the API's Monday-start order, nothing
// moves to the front; ALL done days fold into ONE "Done" card at the END.
// LOW: the upcoming / missed / done a11y labels.

const wd = (id, name) => ({ id, name });
const day = (id, title) => ({ id, title });
const WEEK = [
  { weekday: wd(1, 'Monday'), is_workout_day: true, plan_day: day(11, 'Upper A'), date: '2026-10-26', status: 'done' },
  { weekday: wd(2, 'Tuesday'), is_workout_day: true, plan_day: day(12, 'Lower A'), date: '2026-10-27', status: 'missed' },
  { weekday: wd(3, 'Wednesday'), is_workout_day: true, plan_day: day(13, 'Upper B'), date: '2026-10-28', status: 'today' },
  { weekday: wd(4, 'Thursday'), is_workout_day: false, date: '2026-10-29', status: 'rest' },
  { weekday: wd(5, 'Friday'), is_workout_day: true, plan_day: day(14, 'Lower B'), date: '2026-10-30', status: 'upcoming' },
];

const cardIds = (tree) =>
  tree.root
    .findAll((node) => typeof node.type === 'string' && /^plan-week-(today$|missed-\d|upcoming-|done$)/.test(node.props.testID ?? ''))
    .map((node) => node.props.testID);

function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  return tree;
}

describe('This week order (review M6)', () => {
  it('thisWeekCards: open = missed Tue, today Wed, upcoming Fri (week order); one Done card holding Mon', () => {
    const cards = thisWeekCards(WEEK);
    expect(cards.open.map((card) => [card.status, card.weekday.name])).toEqual([
      ['missed', 'Tuesday'],
      ['today', 'Wednesday'],
      ['upcoming', 'Friday'],
    ]);
    expect(cards.done).toEqual({ titles: 'Upper A', label: 'Done Mon' });
  });

  it('renders missed Tue, today Wed, upcoming Fri, then the Done card (Today is NOT pinned first)', () => {
    const tree = render(<ThisWeek cards={thisWeekCards(WEEK)} onStart={jest.fn()} onOpenExercise={jest.fn()} />);
    const ids = cardIds(tree);
    expect(ids).toEqual(['plan-week-missed-2-12', 'plan-week-today', 'plan-week-upcoming-5-14', 'plan-week-done']);
  });

  it('the tablet grid keeps the same order', () => {
    const tree = render(<ThisWeek tablet cards={thisWeekCards(WEEK)} onStart={jest.fn()} onOpenExercise={jest.fn()} />);
    expect(tree.root.findAll((node) => node.props.testID === 'plan-this-week-grid').length).toBeGreaterThan(0);
    expect(cardIds(tree)).toEqual(['plan-week-missed-2-12', 'plan-week-today', 'plan-week-upcoming-5-14', 'plan-week-done']);
  });

  it('a11y labels: missed "{weekday}, {title}, Missed, {meta}"; upcoming without Missed; done "{titles}, {label}"', () => {
    const tree = render(<ThisWeek cards={thisWeekCards(WEEK)} onStart={jest.fn()} onOpenExercise={jest.fn()} />);
    const label = (id) => tree.root.find((node) => typeof node.type === 'string' && node.props.testID === id).props.accessibilityLabel;
    expect(label('plan-week-missed-2-12')).toBe('Tuesday, Lower A, Missed, 0 exercises');
    expect(label('plan-week-upcoming-5-14')).toBe('Friday, Lower B, 0 exercises');
    expect(label('plan-week-done')).toBe('Upper A, Done Mon');
  });
});

// UX NATIVE-P4 N3 (a352a2d) + app-shell §1.1: only the NAME gets a second
// line; every secondary line (the meta "5 exercises · Quads, Chest, Back",
// the Done label and the Today strip captions) stays ONE line with an
// ellipsis at the tail.
describe('This week secondary lines: one line + ellipsis (UX N3)', () => {
  const ex = (id, name, muscle) => ({ id, exercise: { id: id + 100, name, muscle_group: { name: muscle } }, sets: [{ reps: 8 }] });
  const BY_DAY = {
    12: [ex(1, 'Back Squat', 'Quads'), ex(2, 'Bench Press', 'Chest'), ex(3, 'Barbell Row', 'Back')],
    13: [ex(4, 'Romanian Deadlift', 'Hamstrings'), ex(5, 'Overhead Press', 'Shoulders')],
    14: [ex(6, 'Lat Pulldown', 'Back')],
  };
  const textIn = (tree, id, value) =>
    tree.root
      .find((node) => typeof node.type === 'string' && node.props.testID === id)
      .findAll((node) => node.type === 'Text' && [].concat(node.props.children).join('') === value)[0];
  const ONE_LINE = { numberOfLines: 1, ellipsizeMode: 'tail' };

  it.each([false, true])('meta lines on Today, missed, upcoming and Done cards (tablet=%s)', (tablet) => {
    const tree = render(<ThisWeek cards={thisWeekCards(WEEK, BY_DAY)} tablet={tablet} onStart={jest.fn()} onOpenExercise={jest.fn()} />);
    // Missed Tue (3 exercises), Today Wed (2), upcoming Fri (1).
    const metaOf = (prefix) =>
      tree.root.findAll((node) => node.type === 'Text' && [].concat(node.props.children).join('').startsWith(prefix))[0];
    ['3 exercises', '2 exercises', '1 exercise'].forEach((prefix) => expect(metaOf(prefix).props).toMatchObject(ONE_LINE));
    expect(textIn(tree, 'plan-week-done', 'Done Mon').props).toMatchObject(ONE_LINE);
  });

  it('the Today strip captions are one line each with an ellipsis', () => {
    const tree = render(<ThisWeek cards={thisWeekCards(WEEK, BY_DAY)} tablet onStart={jest.fn()} onOpenExercise={jest.fn()} />);
    [4, 5].forEach((id) => {
      const cell = tree.root.find((node) => typeof node.props.onPress === 'function' && node.props.testID === `plan-week-exercise-${id}`);
      const caption = cell.findAll((node) => node.type === 'Text' && [].concat(node.props.children).join('').includes(' · '))[0];
      expect(caption.props).toMatchObject(ONE_LINE);
    });
  });

  it('the day NAME is not capped to one line', () => {
    const tree = render(<ThisWeek cards={thisWeekCards(WEEK, BY_DAY)} onStart={jest.fn()} onOpenExercise={jest.fn()} />);
    const name = textIn(tree, 'plan-week-upcoming-5-14', 'Lower B');
    expect(name.props.numberOfLines).not.toBe(1);
  });
});

// UX final audit X7 ruling (27 Oct 2026, §1.1): every name in a row, card or
// list is at most 2 lines then a tail ellipsis, no font shrink.
describe.each([false, true])('X7 This week card titles (tablet %s)', (tablet) => {
  const expectName = (node) => {
    expect(node.props).toMatchObject({ numberOfLines: 2, ellipsizeMode: 'tail' });
    expect(node.props.adjustsFontSizeToFit).toBeUndefined();
  };
  it('the open cards and the Done card: the day title 2 lines + ellipsis', () => {
    const tree = render(<ThisWeek tablet={tablet} cards={thisWeekCards(WEEK)} onStart={jest.fn()} onOpenExercise={jest.fn()} />);
    ['Lower A', 'Upper B', 'Lower B', 'Upper A'].forEach((title) => {
      const nodes = tree.root.findAll((node) => node.type === 'Text' && node.props.children === title);
      expect([title, nodes.length > 0]).toEqual([title, true]);
      nodes.forEach(expectName);
    });
  });
});
