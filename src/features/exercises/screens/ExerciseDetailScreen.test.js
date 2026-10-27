import { Text, useWindowDimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import BlurLayer from '../../../shared/components/BlurLayer';
import ExerciseImage from '../../../shared/components/ExerciseImage';
import GradientFill from '../../../shared/components/GradientFill';
import { blur, colors, gradients, muscle, muscleGlow, muscleText, textScale } from '../../../shared/theme/tokens';
import { getExercise, getExerciseProfile } from '../api/exercisesApi';
import ExerciseDetailScreen, {
  howToSteps,
  muscleTextColor,
  primaryHue,
  PHONE_HERO,
  TABLET_HERO,
  TABLET_PAGE_WASH,
} from './ExerciseDetailScreen';

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
jest.mock('../../shell/ShellPage', () => jest.fn(({ children }) => children));
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
  secondary_muscles: [
    { id: 1, name: 'Glutes' },
    { id: 2, name: 'Hamstrings' },
  ],
  stabilizer_muscles: [{ id: 3, name: 'Core' }],
  mechanic: 'compound',
  is_unilateral: false,
  difficulty_level: { name: 'Intermediate' },
  equipment: [
    [{ code: 'BARBELL', name: 'Barbell' }],
    [
      { code: 'RACK', name: 'Squat rack' },
      { code: 'CAGE', name: 'Power cage' },
    ],
  ],
  substitutes: [{ id: 9, name: 'Goblet Squat', primary_muscle_group: { code: 'LEGS', name: 'Quads' }, thumbnail: null }],
};
const notFound = Object.assign(new Error('Not found'), { response: { status: 404 } });
const serverError = Object.assign(new Error('Boom'), { response: { status: 500, data: { message: 'Server down' } } });

const texts = (root) => root.findAll((node) => node.type === 'Text').map((node) => [].concat(node.props.children).join(''));
const byId = (root, id) => root.findAll((node) => node.props.testID === id && typeof node.type === 'string');
const flat = (style) => Object.assign({}, ...[].concat(style).flat(Infinity).filter(Boolean));

function setWidth(width, fontScale = 1) {
  useWindowDimensions.mockReturnValue({ width, height: 900, scale: 2, fontScale });
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
    expect(flat(hero.props.style)).toMatchObject({ minHeight: PHONE_HERO, marginHorizontal: -16 });
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
    expect(shown).toEqual(
      expect.arrayContaining(['Muscles', 'Primary', 'Secondary', 'Glutes', 'Hamstrings', 'Stabilizers', 'Core']),
    );
    expect(shown).toEqual(expect.arrayContaining(['Equipment', 'Barbell', 'Squat rack or Power cage']));
    expect(flat(byId(tree.root, 'exercise-detail-equipment-icon-0')[0].props.style).backgroundColor).toBe(colors.goldTint);
    expect(flat(byId(tree.root, 'exercise-detail-equipment-icon-1')[0].props.style).backgroundColor).toBe(colors.fillSkeleton);
  });

  it('numbers the how-to steps when the instructions have line breaks', async () => {
    const tree = await render();
    expect(byId(tree.root, 'exercise-detail-steps')).toHaveLength(1);
    const shown = texts(tree.root);
    expect(shown).toEqual(
      expect.arrayContaining(['How to do it', 'A squat.', '1.', 'Brace.', '2.', 'Sit down.', '3.', 'Stand up.']),
    );
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
    const tile = tree.root.find(
      (node) => node.props.testID === 'exercise-alternative-9' && typeof node.props.onPress === 'function',
    );
    act(() => tile.props.onPress());
    expect(mockNavigation.push).toHaveBeenCalledWith('ExerciseDetail', { exerciseId: '9' });
  });

  it('Back goes back, or to /exercises when there is no history', async () => {
    const tree = await render();
    const back = () =>
      tree.root.find((node) => node.props.testID === 'exercise-detail-back' && typeof node.props.onPress === 'function');
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
    expect(texts(tree.root)).toEqual(
      expect.arrayContaining(['Exercise not found', 'This exercise isn’t available.', 'Back to exercises']),
    );
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
    expect(flat(hero.props.style)).toMatchObject({ minHeight: TABLET_HERO, borderRadius: 36 });
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

// Phase 2 tokens pass: exact colours (UX §8.4/§8.5) and large text (§9).
const ShellPage = require('../../shell/ShellPage');
const backPressable = (root) =>
  root.find((node) => node.props.testID === 'exercise-detail-back' && typeof node.props.children === 'function');
function renderChildren(element, pressed) {
  let inner;
  act(() => {
    inner = create(<>{element.props.children({ pressed })}</>);
  });
  mounted.push(inner);
  return inner;
}
// This screen's own Text (the kit's ExerciseImage initials are not this file's).
const insideImage = (node) => {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.type === ExerciseImage) {
      return true;
    }
  }
  return false;
};
const ownTexts = (root) => root.findAllByType(Text).filter((node) => !insideImage(node));
const fills = (root) => root.findAllByType(GradientFill).map((node) => node.props);

describe('Exercise detail tokens (Phase 2 exact match)', () => {
  it('muscleTextColor: the lighter muscle text, null without a muscle', () => {
    expect(muscleTextColor('QUADS')).toBe(muscleText.legs);
    expect(muscleTextColor('CHEST')).toBe(muscleText.chest);
    expect(muscleTextColor(null)).toBeNull();
    expect(muscleTextColor('NOT_A_MUSCLE')).toBeNull();
  });

  it('phone Back pill: on-photo glass (blur 12) with the 0.12 edge; pressed adds the 4 % overlay', async () => {
    const tree = await render();
    const back = backPressable(tree.root);
    expect(flat(back.props.style).borderColor).toBe(colors.hairlineButton);
    expect(flat(back.props.style).backgroundColor).toBeUndefined();
    const rest = renderChildren(back, false);
    expect(rest.root.findByType(BlurLayer).props.blurPx).toBe(blur.onPhoto);
    expect(
      rest.root.findAll((node) => flat(node.props?.style).backgroundColor === colors.onPhoto && typeof node.type === 'string')
        .length,
    ).toBe(1);
    expect(rest.root.findAll((node) => node.props?.testID === 'exercise-detail-back-pressed')).toHaveLength(0);
    const pressed = renderChildren(back, true);
    const overlay = pressed.root.find(
      (node) => node.props?.testID === 'exercise-detail-back-pressed' && typeof node.type === 'string',
    );
    expect(flat(overlay.props.style).backgroundColor).toBe(colors.pressOverlay);
  });

  it('tablet Back pill: no glass (not on a photo), the rest fill kept; pressed adds the overlay', async () => {
    setWidth(834);
    const tree = await render();
    const back = backPressable(tree.root);
    expect(flat(back.props.style)).toMatchObject({ minHeight: 40, backgroundColor: colors.fillSkeleton });
    expect(renderChildren(back, false).root.findAllByType(BlurLayer)).toHaveLength(0);
    expect(
      renderChildren(back, true).root.findAll((node) => node.props?.testID === 'exercise-detail-back-pressed'),
    ).not.toHaveLength(0);
  });

  it('fact chips: on-photo glass, blur 12, hairline-strong 0.12 edge, no fixed height', async () => {
    const tree = await render();
    const chips = byId(tree.root, 'exercise-detail-fact-chip');
    expect(chips).toHaveLength(3);
    chips.forEach((chip) => {
      const style = flat(chip.props.style);
      expect(style).toMatchObject({ minHeight: 28, borderColor: colors.hairlineButton });
      expect(style.height).toBeUndefined();
      expect(chip.findByType(BlurLayer).props.blurPx).toBe(blur.onPhoto);
    });
  });

  it('phone fades use gradient-photo-fade (hero and alternative tiles)', async () => {
    const tree = await render();
    const all = fills(tree.root);
    expect(all).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ colors: [...gradients.photoFade.colors, colors.ground] }),
        expect.objectContaining({ colors: [gradients.photoFade.colors[0], ...gradients.photoFade.colors] }),
      ]),
    );
    expect(byId(tree.root, 'exercise-detail-orb')).toHaveLength(0);
    expect(ShellPage.mock.calls.at(-1)[0].glow).toBe(false);
  });

  it('tablet: muscle orb, muscle-text eyebrow, surface-input → surface-sunk cards, photo fade, gold page wash', async () => {
    setWidth(834);
    const tree = await render();
    const orb = byId(tree.root, 'exercise-detail-orb')[0];
    expect(orb.props.pointerEvents).toBe('none');
    expect(orb.props.accessibilityElementsHidden).toBe(true);
    expect(orb.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(flat(orb.props.style)).toMatchObject({ width: 360, height: 360, left: -80, bottom: -120 });
    expect(orb.findByType(GradientFill).props.colors).toEqual(muscleGlow(muscle.legs).colors);
    expect(flat(byId(tree.root, 'exercise-detail-eyebrow')[0].props.style).color).toBe(muscleText.legs);
    const all = fills(tree.root);
    expect(all.filter((props) => props.colors[0] === colors.surfaceInput && props.colors[1] === colors.surfaceSunk).length).toBe(
      4,
    );
    expect(all).toEqual(expect.arrayContaining([expect.objectContaining({ colors: gradients.photoFade.colors })]));
    expect(ShellPage.mock.calls.at(-1)[0].glow).toBe(TABLET_PAGE_WASH);
    expect(TABLET_PAGE_WASH.colors).toEqual(['rgba(255, 194, 26, 0.18)', 'rgba(255, 194, 26, 0)']);
  });

  it('tablet: no orb when the muscle has no colour', async () => {
    setWidth(834);
    getExerciseProfile.mockResolvedValue({ ...profile, primary_muscle: { code: 'UNKNOWN', name: 'Other' } });
    getExercise.mockResolvedValue({ ...exercise, primary_muscle_group: null });
    const tree = await render();
    expect(byId(tree.root, 'exercise-detail-orb')).toHaveLength(0);
    expect(flat(byId(tree.root, 'exercise-detail-eyebrow')[0].props.style).color).toBe(colors.gold);
  });

  it('tablet alternative row: pressed is the rest fill + the 4 % overlay', async () => {
    setWidth(834);
    const tree = await render();
    const row = tree.root.find(
      (node) => node.props.testID === 'exercise-alternative-9' && typeof node.props.children === 'function',
    );
    expect(flat(row.props.style).backgroundColor).toBe(colors.fillWell);
    expect(
      renderChildren(row, false).root.findAll((node) => node.props?.testID === 'exercise-alternative-9-pressed'),
    ).toHaveLength(0);
    const pressed = renderChildren(row, true).root.find(
      (node) => node.props?.testID === 'exercise-alternative-9-pressed' && typeof node.type === 'string',
    );
    expect(flat(pressed.props.style).backgroundColor).toBe(colors.pressOverlay);
  });
});

describe('Exercise detail large text (UX §9)', () => {
  it.each([1, 2, 3.1])('fontScale %s: every text is capped by role; the title wraps by word and shrinks', async (scale) => {
    setWidth(390, scale);
    const tree = await render();
    const all = ownTexts(tree.root);
    all.forEach((node) => expect(node.props.maxFontSizeMultiplier).toBeGreaterThan(0));
    const title = tree.root.find((node) => node.props.testID === 'exercise-detail-title' && node.type === Text);
    expect(title.props).toMatchObject({
      maxFontSizeMultiplier: textScale.display,
      numberOfLines: 3,
      adjustsFontSizeToFit: true,
      minimumFontScale: 0.7,
      textBreakStrategy: 'simple',
    });
    const primary = tree.root.find((node) => node.props.testID === 'exercise-detail-primary' && node.type === Text);
    expect(primary.props).toMatchObject({ maxFontSizeMultiplier: textScale.title, numberOfLines: 3, adjustsFontSizeToFit: true });
    const howTo = all.find((node) => node.props.children === 'A squat.');
    expect(howTo.props.maxFontSizeMultiplier).toBe(textScale.body);
    const chip = all.find((node) => node.props.children === 'Intermediate');
    expect(chip.props.maxFontSizeMultiplier).toBe(textScale.pill);
  });

  it('no text is cut to one line (labels and summaries wrap to at least 2)', async () => {
    for (const width of [390, 834]) {
      setWidth(width, 2);
      const tree = await render();
      ownTexts(tree.root).forEach((node) => {
        if (node.props.numberOfLines !== undefined) {
          expect(node.props.numberOfLines).toBeGreaterThanOrEqual(2);
        }
      });
    }
  });

  it('fontScale 1: Muscles and Equipment side by side; alternatives two per row', async () => {
    setWidth(390, 1);
    const tree = await render();
    expect(flat(byId(tree.root, 'exercise-detail-grid')[0].props.style).flexDirection).toBe('row');
    expect(flat(byId(tree.root, 'exercise-detail-muscles')[0].props.style).flex).toBe(1);
    const tile = tree.root.find((node) => node.props.testID === 'exercise-alternative-9' && typeof node.type === 'string');
    expect(flat(tile.props.style).width).toBe('47%');
  });

  it.each([2, 3.1])('fontScale %s: the grids reflow to one column; the hero grows (minHeight)', async (scale) => {
    for (const width of [390, 834]) {
      setWidth(width, scale);
      const tree = await render();
      expect(flat(byId(tree.root, 'exercise-detail-grid')[0].props.style).flexDirection).toBe('column');
      expect(flat(byId(tree.root, 'exercise-detail-muscles')[0].props.style).flex).toBeUndefined();
      expect(flat(byId(tree.root, 'exercise-detail-equipment')[0].props.style).flex).toBeUndefined();
      const tile = tree.root.find((node) => node.props.testID === 'exercise-alternative-9' && typeof node.type === 'string');
      expect(flat(tile.props.style).width).toBe('100%');
      const hero = flat(byId(tree.root, 'exercise-detail-hero')[0].props.style);
      expect(hero.height).toBeUndefined();
      expect(hero.minHeight).toBe(width === 390 ? PHONE_HERO : TABLET_HERO);
    }
  });
});
