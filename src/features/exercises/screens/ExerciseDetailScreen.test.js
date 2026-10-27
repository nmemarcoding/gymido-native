import { useWindowDimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import { colors, muscle } from '../../../shared/theme/tokens';
import { getExercise, getExerciseProfile } from '../api/exercisesApi';
import ExerciseDetailScreen, { howToSteps, primaryHue, PHONE_HERO, TABLET_HERO } from './ExerciseDetailScreen';

const mockNavigation = {
  push: jest.fn(),
  goBack: jest.fn(),
  canGoBack: jest.fn(() => true),
  addListener: jest.fn(() => () => {}),
};

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ key: 'ExerciseDetail-1', name: 'ExerciseDetail', params: { exerciseId: '7' } }),
}));
jest.mock('../../shell/ShellPage', () => ({ children }) => children);
jest.mock('../../shell/shellLinks', () => ({ openShellPath: jest.fn() }));
jest.mock('../api/exercisesApi', () => ({ getExercise: jest.fn(), getExerciseProfile: jest.fn() }));
jest.mock('../../../shared/components/RemoteImage', () => () => null);

const { openShellPath } = require('../../shell/shellLinks');

const exercise = {
  id: 7,
  name: 'Back Squat',
  primary_muscle_group: { code: 'LEGS', name: 'Legs' },
  thumbnail: { url: 'https://img/squat.jpg' },
  description: 'A squat.',
  instructions: 'Brace.\nSit down.\n\nStand up.',
};
const profile = {
  primary_muscle: { code: 'QUADS', name: 'Quads' },
  secondary_muscles: [{ id: 1, name: 'Glutes' }, { id: 2, name: 'Hamstrings' }],
  stabilizer_muscles: [{ id: 3, name: 'Core' }],
  mechanic: 'compound',
  is_unilateral: false,
  difficulty_level: { name: 'Intermediate' },
  equipment: [[{ code: 'BARBELL', name: 'Barbell' }], [{ code: 'RACK', name: 'Squat rack' }, { code: 'CAGE', name: 'Power cage' }]],
  substitutes: [{ id: 9, name: 'Goblet Squat', primary_muscle_group: { code: 'LEGS', name: 'Quads' }, thumbnail: null }],
};
const notFound = Object.assign(new Error('Not found'), { response: { status: 404 } });
const serverError = Object.assign(new Error('Boom'), { response: { status: 500, data: { message: 'Server down' } } });

const texts = (root) =>
  root.findAll((node) => node.type === 'Text').map((node) => [].concat(node.props.children).join(''));
const byId = (root, id) => root.findAll((node) => node.props.testID === id && typeof node.type === 'string');
const flat = (style) => Object.assign({}, ...[].concat(style).flat(Infinity).filter(Boolean));

function setWidth(width) {
  useWindowDimensions.mockReturnValue({ width, height: 900, scale: 2, fontScale: 1 });
}

const mounted = [];
async function render() {
  let tree;
  await act(async () => {
    tree = create(<ExerciseDetailScreen />);
  });
  mounted.push(tree);
  return tree;
}

beforeEach(() => {
  setWidth(390);
  getExercise.mockResolvedValue(exercise);
  getExerciseProfile.mockResolvedValue(profile);
});
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
  jest.clearAllMocks();
});

describe('howToSteps (ND-4)', () => {
  it('numbers one step per non-empty line only when the text has line breaks', () => {
    expect(howToSteps('Brace.\nSit down.\r\n\n Stand up. ')).toEqual(['Brace.', 'Sit down.', 'Stand up.']);
    expect(howToSteps('One block of text.')).toBeNull();
    expect(howToSteps('Only one line\n')).toBeNull();
    expect(howToSteps(null)).toBeNull();
  });
});

describe('primaryHue', () => {
  it('uses the primary muscle colour, else gold', () => {
    expect(primaryHue(profile, exercise)).toBe(muscle.legs);
    expect(primaryHue(null, { primary_muscle_group: { code: 'CHEST' } })).toBe(muscle.chest);
    expect(primaryHue(null, {})).toBe(colors.gold);
  });
});

describe('Exercise detail v2 look (C1)', () => {
  it('shows the loader while loading', async () => {
    getExercise.mockReturnValue(new Promise(() => {}));
    const tree = await render();
    expect(texts(tree.root)).toContain('Loading exercise');
  });

  it('phone: full-bleed 400 hero with the Back pill, muscle eyebrow, title and fact chips', async () => {
    const tree = await render();
    const hero = byId(tree.root, 'exercise-detail-hero')[0];
    expect(flat(hero.props.style)).toMatchObject({ height: PHONE_HERO, marginHorizontal: -16 });
    // Back lives on the photo on phones.
    expect(hero.findAll((node) => node.props.testID === 'exercise-detail-back').length).toBeGreaterThan(0);
    expect(flat(byId(tree.root, 'exercise-detail-eyebrow')[0].props.style).color).toBe(muscle.legs);
    const shown = texts(tree.root);
    expect(shown).toEqual(expect.arrayContaining(['Quads', 'Back Squat', 'Intermediate', 'Compound', 'Both sides', '← Back']));
    const title = byId(tree.root, 'exercise-detail-title')[0];
    expect(title.props.accessibilityRole).toBe('header');
    expect(flat(title.props.style).fontSize).toBe(52);
  });

  it('phone: the hero photo is ExerciseImage with no label (the h1 is overlaid)', async () => {
    const tree = await render();
    const image = tree.root.find((node) => node.props.testID === 'exercise-detail-image' && typeof node.type !== 'string');
    expect(image.props.url).toBe('https://img/squat.jpg');
    expect(image.props.accessibilityLabel).toBeUndefined();
  });

  it('no photo: the hero falls back to the initials tile, never an empty frame', async () => {
    getExercise.mockResolvedValue({ ...exercise, thumbnail: null });
    const tree = await render();
    expect(byId(tree.root, 'exercise-detail-image-initials')).toHaveLength(1);
  });

  it('phone: Muscles with the coloured Primary value and chip rows; Equipment rows with the gold first tile', async () => {
    const tree = await render();
    expect(flat(byId(tree.root, 'exercise-detail-primary')[0].props.style).color).toBe(muscle.legs);
    const shown = texts(tree.root);
    expect(shown).toEqual(expect.arrayContaining(['Muscles', 'Primary', 'Secondary', 'Glutes', 'Hamstrings', 'Stabilizers', 'Core']));
    expect(shown).toEqual(expect.arrayContaining(['Equipment', 'Barbell', 'Squat rack or Power cage']));
    expect(flat(byId(tree.root, 'exercise-detail-equipment-icon-0')[0].props.style).backgroundColor).toBe(colors.goldTint);
    expect(flat(byId(tree.root, 'exercise-detail-equipment-icon-1')[0].props.style).backgroundColor).toBe(colors.fillSkeleton);
  });

  it('numbers the how-to steps when the instructions have line breaks', async () => {
    const tree = await render();
    expect(byId(tree.root, 'exercise-detail-steps')).toHaveLength(1);
    const shown = texts(tree.root);
    expect(shown).toEqual(expect.arrayContaining(['How to do it', 'A squat.', '1.', 'Brace.', '2.', 'Sit down.', '3.', 'Stand up.']));
  });

  it('keeps the single text block when the instructions have no line breaks', async () => {
    getExercise.mockResolvedValue({ ...exercise, instructions: 'Squat down and stand.' });
    const tree = await render();
    expect(byId(tree.root, 'exercise-detail-steps')).toHaveLength(0);
    expect(texts(tree.root)).toContain('Squat down and stand.');
  });

  it('phone: alternatives are photo tiles; tapping one pushes a new detail', async () => {
    const tree = await render();
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['Alternatives', 'Goblet Squat', 'Quads']));
    expect(byId(tree.root, 'exercise-alternative-9-image-initials')).toHaveLength(1);
    const tile = tree.root.find((node) => node.props.testID === 'exercise-alternative-9' && typeof node.props.onPress === 'function');
    act(() => tile.props.onPress());
    expect(mockNavigation.push).toHaveBeenCalledWith('ExerciseDetail', { exerciseId: '9' });
  });

  it('Back goes back, or to /exercises when there is no history', async () => {
    const tree = await render();
    const back = () => tree.root.find((node) => node.props.testID === 'exercise-detail-back' && typeof node.props.onPress === 'function');
    act(() => back().props.onPress());
    expect(mockNavigation.goBack).toHaveBeenCalled();
    mockNavigation.canGoBack.mockReturnValueOnce(false);
    act(() => back().props.onPress());
    expect(openShellPath).toHaveBeenCalledWith('/exercises');
  });

  it('untagged: the coming-soon note, no Equipment card and no alternatives', async () => {
    getExerciseProfile.mockResolvedValue({ primary_muscle: { code: 'QUADS', name: 'Quads' } });
    const tree = await render();
    expect(texts(tree.root)).toContain('More details for this exercise are coming soon.');
    expect(byId(tree.root, 'exercise-detail-equipment')).toHaveLength(0);
    expect(byId(tree.root, 'exercise-detail-alternatives')).toHaveLength(0);
  });

  it('profile failed (non-404): basics only, no cards beyond Muscles from the exercise, no note', async () => {
    getExerciseProfile.mockRejectedValue(serverError);
    const tree = await render();
    const shown = texts(tree.root);
    expect(shown).toEqual(expect.arrayContaining(['Legs', 'Back Squat', 'How to do it']));
    expect(shown).not.toContain('More details for this exercise are coming soon.');
    expect(byId(tree.root, 'exercise-detail-equipment')).toHaveLength(0);
  });

  it('not found: the EmptyState with "Back to exercises"', async () => {
    getExercise.mockRejectedValue(notFound);
    const tree = await render();
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['Exercise not found', 'This exercise isn’t available.', 'Back to exercises']));
  });

  it('error: the ErrorAlert, and Retry reloads both calls', async () => {
    getExercise.mockRejectedValueOnce(serverError);
    const tree = await render();
    expect(texts(tree.root)).toContain('Could not load this exercise');
    const retry = tree.root.find((node) => node.props.title === 'Retry' && typeof node.props.onPress === 'function');
    await act(async () => retry.props.onPress());
    expect(getExercise).toHaveBeenCalledTimes(2);
    expect(getExerciseProfile).toHaveBeenCalledTimes(2);
    expect(texts(tree.root)).toContain('Back Squat');
  });

  it('tablet: Back pill above a rounded 520 hero, 80 title, pairs and chips, alternatives as rows', async () => {
    setWidth(834);
    const tree = await render();
    const hero = byId(tree.root, 'exercise-detail-hero')[0];
    expect(flat(hero.props.style)).toMatchObject({ height: TABLET_HERO, borderRadius: 36 });
    expect(hero.findAll((node) => node.props.testID === 'exercise-detail-back')).toHaveLength(0);
    expect(byId(tree.root, 'exercise-detail-back')).toHaveLength(1);
    expect(flat(byId(tree.root, 'exercise-detail-title')[0].props.style).fontSize).toBe(80);
    const shown = texts(tree.root);
    expect(shown).toEqual(expect.arrayContaining(['Glutes · Hamstrings', 'Squat rack or Power cage', 'Quads']));
    expect(byId(tree.root, 'exercise-detail-equipment-icon-0')).toHaveLength(0);
    const image = tree.root.find((node) => node.props.testID === 'exercise-alternative-9-image' && typeof node.type !== 'string');
    expect(flat(image.props.style)).toMatchObject({ width: 104, height: 84 });
  });
});
