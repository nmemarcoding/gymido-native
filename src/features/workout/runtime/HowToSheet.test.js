import { act, create } from 'react-test-renderer';

import HowToSheet, { hasHowTo, howToSteps, showHowToPill, useHowToLibrary } from './HowToSheet';

jest.mock('react-native-svg', () => {
  const Mock = ({ children }) => children ?? null;
  return { __esModule: true, default: Mock, Path: Mock, Circle: Mock };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../../shared/components/GradientFill', () => () => null);
jest.mock('../../../shared/components/BlurLayer', () => () => null);
jest.mock('../../../shared/components/RemoteImage', () => {
  const { View } = require('react-native');
  return (props) => <View testID="remote-image" {...props} />;
});
jest.mock('../../exercises/api/exercisesApi', () => ({ getExercise: jest.fn() }));
let mockWidth = 390;
let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 844, scale: 3, fontScale: mockFontScale }),
}));

const trees = [];
afterEach(() => {
  mockWidth = 390;
  mockFontScale = 1;
  act(() => trees.splice(0).forEach((tree) => tree.unmount()));
});
function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  trees.push(tree);
  return tree;
}
const texts = (tree) => tree.root.findAll((node) => node.type === 'Text').map((node) => [].concat(node.props.children).join(''));
const SESSION_EXERCISE = { id: 1, exercise_name_snapshot: 'Squat', exercise: { id: 7, thumbnail: { url: 'https://example.com/s.jpg' } } };

describe('How to helpers', () => {
  it('splits instructions with line breaks into steps (the detail screen rule)', () => {
    expect(howToSteps('One\n\nTwo\r\nThree')).toEqual(['One', 'Two', 'Three']);
    expect(howToSteps('Single block')).toBeNull();
    expect(howToSteps('Only\n')).toBeNull();
    expect(howToSteps(null)).toBeNull();
  });

  it('hides the pill only when the library is loaded with neither text nor image', () => {
    expect(hasHowTo({ description: 'x' })).toBe(true);
    expect(hasHowTo({})).toBe(false);
    expect(showHowToPill(undefined, {})).toBe(true);
    expect(showHowToPill({ status: 'loading' }, {})).toBe(true);
    expect(showHowToPill({ status: 'error' }, {})).toBe(true);
    expect(showHowToPill({ status: 'ready', exercise: {} }, {})).toBe(false);
    expect(showHowToPill({ status: 'ready', exercise: {} }, SESSION_EXERCISE)).toBe(true);
    expect(showHowToPill({ status: 'ready', exercise: { instructions: 'x' } }, {})).toBe(true);
  });
});

describe('useHowToLibrary', () => {
  function Probe({ load, onValue }) {
    onValue(useHowToLibrary({ load }));
    return null;
  }

  it('loads once per id, keeps errors, and a forced retry reloads', async () => {
    let value;
    const load = jest.fn().mockRejectedValueOnce({ response: { data: { message: 'Nope' } } }).mockResolvedValueOnce({ id: 7, description: 'Go' });
    render(<Probe load={load} onValue={(next) => (value = next)} />);
    await act(async () => value.fetchEntry(7));
    expect(value.entries[7]).toEqual({ status: 'error', message: 'Nope' });
    await act(async () => value.fetchEntry(7, true));
    expect(value.entries[7]).toEqual({ status: 'ready', exercise: { id: 7, description: 'Go' } });
    await act(async () => value.fetchEntry(7));
    await act(async () => value.fetchEntry(undefined));
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe('HowToSheet', () => {
  const props = { open: true, sessionExercise: SESSION_EXERCISE, onRetry: jest.fn(), onClose: jest.fn() };

  it('loading: the loader', () => {
    const tree = render(<HowToSheet {...props} entry={{ status: 'loading' }} />);
    expect(texts(tree)).toContain('Loading exercise');
  });

  it('error: the detail screen copy with Retry', () => {
    const onRetry = jest.fn();
    const tree = render(<HowToSheet {...props} onRetry={onRetry} entry={{ status: 'error', message: 'Network Error' }} />);
    expect(texts(tree)).toEqual(expect.arrayContaining(['Could not load this exercise', 'Network Error']));
    const retry = tree.root.findAll((node) => node.props.title === 'Retry' || node.props.accessibilityLabel === 'Retry').find((node) => node.props.onPress);
    act(() => retry.props.onPress());
    expect(onRetry).toHaveBeenCalled();
  });

  it('ready: the image, "How to do it", the description and numbered steps; Close closes', () => {
    const onClose = jest.fn();
    const tree = render(<HowToSheet {...props} onClose={onClose} entry={{ status: 'ready', exercise: { description: 'Brace.', instructions: 'Sit back\nStand up' } }} />);
    expect(texts(tree)).toEqual(expect.arrayContaining(['Squat', 'How to do it', 'Brace.', '1.', 'Sit back', '2.', 'Stand up']));
    expect(tree.root.findAll((node) => node.props.testID === 'remote-image')[0].props.url).toBe('https://example.com/s.jpg');
    act(() => tree.root.findAll((node) => node.props.testID === 'how-to-close' && node.props.title)[0].props.onPress());
    expect(onClose).toHaveBeenCalled();
  });

  it('ready, one text block and no image', () => {
    const tree = render(<HowToSheet {...props} sessionExercise={{ ...SESSION_EXERCISE, exercise: { id: 7 } }} entry={{ status: 'ready', exercise: { instructions: 'Just squat.' } }} />);
    expect(texts(tree)).toContain('Just squat.');
    expect(tree.root.findAll((node) => node.props.testID === 'remote-image')).toHaveLength(0);
  });

  it.each([1, 2, 3.1])('at %sx the body text scales to the 2.0 cap; tablet is a centred card', (scale) => {
    mockFontScale = scale;
    mockWidth = scale === 2 ? 834 : 390;
    const tree = render(<HowToSheet {...props} entry={{ status: 'ready', exercise: { description: 'Brace.' } }} />);
    const body = tree.root.findAll((node) => node.type === 'Text' && node.props.children === 'Brace.')[0];
    expect(body.props.maxFontSizeMultiplier).toBe(2);
  });
});
