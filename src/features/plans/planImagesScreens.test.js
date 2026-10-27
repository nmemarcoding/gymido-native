jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 834, height: 1194, scale: 2, fontScale: 1 }),
}));
jest.mock('../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));

import { act, create } from 'react-test-renderer';

import ExerciseImage from '../../shared/components/ExerciseImage';
import RemoteImage from '../../shared/components/RemoteImage';
import ExerciseCard from '../trainer/plans/components/ExerciseCard';
import ExerciseThumb from '../trainer/plans/components/ExerciseThumb';
import { thisWeekCards } from './libraryFormat';
import DayRow from './components/DayRow';
import { PlanHero } from './components/PlanSummary';
import ThisWeek from './components/ThisWeek';

// Review 26fc4a8 M4 / M5 on the Phase 4 screens: every exercise / plan
// image goes through the v2 chain (planImages) and a video is not an image.

const ID = 'F1le';
const UC = `https://drive.google.com/uc?export=view&id=${ID}`;
const UC_NO_ID = 'https://drive.google.com/uc?export=view';
const CHAIN_400 = [
  `https://drive.google.com/thumbnail?id=${ID}&sz=w400`,
  `https://drive.google.com/thumbnail?id=${ID}&sz=w1600`,
  `https://lh3.googleusercontent.com/d/${ID}=w1600`,
  `https://lh3.googleusercontent.com/d/${ID}=s1600`,
];
const VIDEO = { url: 'https://x.test/a.mp4', media_type: 'video' };
const exercise = (thumbnail) => ({ id: 5, name: 'Back Squat', primary_muscle_group: { code: 'LEGS', name: 'Legs' }, thumbnail });

function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  return tree;
}
const images = (tree) => tree.root.findAllByType(ExerciseImage);
const remoteSources = (tree) => tree.root.findAllByType(RemoteImage).map((node) => node.props.sources);
const initials = (tree) => tree.root.findAll((node) => typeof node.type === 'string' && /-initials$/.test(node.props.testID ?? ''));

const CASES = [
  ['DayRow (phone row)', (thumb) => <DayRow day={{ id: 1, day_number: 1, title: 'A' }} exercises={[{ id: 9, exercise: exercise(thumb) }]} isOpen onToggle={jest.fn()} onOpenExercise={jest.fn()} />],
  ['ExerciseThumb (builder / picker)', (thumb) => <ExerciseThumb exercise={exercise(thumb)} />],
  [
    'ExerciseCard (builder row)',
    (thumb) => (
      <ExerciseCard exercise={{ id: 9, exercise: exercise(thumb) }} name="Back Squat" index={0} count={1} sets={[]} capabilities={{}} onMove={jest.fn()} />
    ),
  ],
  [
    'ThisWeek (today strip)',
    (thumb) => (
      <ThisWeek
        cards={thisWeekCards([{ weekday: { id: 1, name: 'Monday' }, plan_day: { id: 3, title: 'A' }, date: '2026-10-26', status: 'today' }], {
          3: [{ id: 9, exercise: exercise(thumb) }],
        })}
        onStart={jest.fn()}
        onOpenExercise={jest.fn()}
      />
    ),
  ],
];

describe.each(CASES)('%s', (_, make) => {
  it('a uc link: the chain from its id (the uc link is never tried, the w400 thumbnail first)', () => {
    const tree = render(make({ url: UC, media_type: 'image' }));
    expect(images(tree)[0].props.sources).toEqual(CHAIN_400);
    expect(remoteSources(tree)[0]).toEqual(CHAIN_400);
  });

  it('a uc link with no id → the initials tile immediately (nothing loaded)', () => {
    const tree = render(make({ url: UC_NO_ID }));
    expect(tree.root.findAllByType(RemoteImage)).toHaveLength(0);
    expect(initials(tree).length).toBeGreaterThan(0);
  });

  it('a video thumbnail is not an image → the tile (nothing loaded)', () => {
    const tree = render(make(VIDEO));
    expect(tree.root.findAllByType(RemoteImage)).toHaveLength(0);
    expect(initials(tree).length).toBeGreaterThan(0);
  });
});

describe('PlanHero (tablet plan photo)', () => {
  it('a uc thumbnail: the chain without the uc link, no size asked', () => {
    const tree = render(<PlanHero plan={{ name: 'P', thumbnail: { url: UC, media_type: 'image' } }} dayCount={1} totalExercises={1} />);
    expect(remoteSources(tree)).toEqual([CHAIN_400.slice(1)]);
  });

  it('a uc link with no id → the gradient card at once (no image)', () => {
    const tree = render(<PlanHero plan={{ name: 'P', thumbnail: { url: UC_NO_ID, media_type: 'image' } }} dayCount={1} totalExercises={1} />);
    expect(tree.root.findAllByType(RemoteImage)).toHaveLength(0);
  });
});

// UX final audit X7 ruling (27 Oct 2026, §1.1): every name in a row, card or
// list is at most 2 lines then a tail ellipsis, no font shrink.
describe.each([false, true])('X7 DayRow names (tablet %s)', (tablet) => {
  const expectName = (node) => {
    expect(node.props).toMatchObject({ numberOfLines: 2, ellipsizeMode: 'tail' });
    expect(node.props.adjustsFontSizeToFit).toBeUndefined();
  };
  it('the day title and the exercise card name: 2 lines + ellipsis', () => {
    let tree;
    act(() => {
      tree = create(
        <DayRow tablet={tablet} day={{ id: 1, day_number: 1, title: 'Upper Body Hypertrophy' }} exercises={[{ id: 9, exercise: { id: 4, name: 'Incline Dumbbell Press' } }]} isOpen onToggle={jest.fn()} onOpenExercise={jest.fn()} />
      );
    });
    expectName(tree.root.findAll((node) => node.type === 'Text' && node.props.children === 'Upper Body Hypertrophy')[0]);
    if (tablet) {
      expectName(tree.root.findAll((node) => node.type === 'Text' && node.props.children === 'Incline Dumbbell Press')[0]);
    }
    act(() => tree.unmount());
  });
});
