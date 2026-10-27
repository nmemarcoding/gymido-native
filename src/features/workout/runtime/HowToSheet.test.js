import { useEffect } from 'react';
import { act, create } from 'react-test-renderer';

import { Linking } from 'react-native';

import HowToSheet, { hasHowTo, howToMedia, howToSteps, isVideoFile, showHowToPill, useHowToLibrary } from './HowToSheet';

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
// Batch 2 (1): expo-video is native; the player and view are stubs that keep their props.
const mockPlayers = [];
jest.mock('expo-video', () => {
  const { View } = require('react-native');
  return {
    useVideoPlayer: (source, setup) => {
      const player = { source, loop: true, play: jest.fn(), pause: jest.fn() };
      setup?.(player);
      mockPlayers.push(player);
      return player;
    },
    VideoView: (props) => <View testID="video-view-native" {...props} />,
  };
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

  // PM sweep (27 Oct, after web's lookup loop): SessionRuntime prefetches in
  // an effect keyed on fetchEntry. A failure re-renders; if fetchEntry then
  // changed (an inline `load`), the effect would refetch on every failure.
  it('a failing prefetch keyed on fetchEntry makes ONE request, even with a new `load` every render', async () => {
    const request = jest.fn(() => Promise.reject(new Error('Network Error')));
    let value;
    function Prefetch({ id }) {
      value = useHowToLibrary({ load: (exerciseId) => request(exerciseId) });
      const { fetchEntry } = value;
      useEffect(() => {
        fetchEntry(id);
      }, [id, fetchEntry]);
      return null;
    }
    render(<Prefetch id={7} />);
    for (let tick = 0; tick < 5; tick += 1) {
      await act(async () => {});
    }
    expect(value.entries[7].status).toBe('error');
    expect(request).toHaveBeenCalledTimes(1);
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

// Batch 2 (1), web HowToSheet.jsx:19-32 / :81-107 (pm-web-facts Batch 2): media by sort_order, the first video wins,
// a video FILE plays inline, any other video URL is a "Watch video" link out; no video → first image → thumbnail.
describe('How-to media (Batch 2 item 1)', () => {
  const media = (...items) => items.map((item, index) => ({ id: index + 1, sort_order: index + 1, ...item }));

  it('isVideoFile: .mp4 / .webm / .mov / .m4v (any case, query or hash allowed); pages are not files', () => {
    ['https://x.io/a.mp4', 'https://x.io/a.WEBM', 'https://x.io/a.mov?sig=1', 'https://x.io/a.m4v#t=2'].forEach((url) => expect(isVideoFile(url)).toBe(true));
    ['https://youtube.com/watch?v=1', 'https://drive.google.com/file/d/1/view', 'https://x.io/mp4', 'https://x.io/a.mp4.html', '', null].forEach((url) =>
      expect(isVideoFile(url)).toBe(false)
    );
  });

  it('howToMedia picks by sort_order: the first video wins (file → inline, else a link), the image is the first non-video, else the thumbnail', () => {
    const thumb = { thumbnail: { url: 'https://x.io/t.jpg' } };
    expect(howToMedia({ media: media({ media_type: 'image', url: 'https://x.io/i.jpg' }, { media_type: 'video', url: 'https://x.io/v.mp4' }) })).toEqual({
      video: 'https://x.io/v.mp4',
      link: null,
      image: 'https://x.io/i.jpg',
    });
    expect(
      howToMedia({ media: [{ media_type: 'video/mp4', url: 'https://x.io/b.mp4', sort_order: 2 }, { media_type: 'video', url: 'https://youtu.be/a', sort_order: 1 }], ...thumb })
    ).toEqual({ video: null, link: 'https://youtu.be/a', image: 'https://x.io/t.jpg' });
    expect(howToMedia({ media: [{ media_type: 'gif', url: 'https://x.io/2.gif', sort_order: 2 }, { media_type: 'image', url: 'https://x.io/1.jpg', sort_order: 1 }] })).toEqual({
      video: null,
      link: null,
      image: 'https://x.io/1.jpg',
    });
    expect(howToMedia({ media: [], ...thumb })).toEqual({ video: null, link: null, image: 'https://x.io/t.jpg' });
    expect(howToMedia({}, { exercise: { thumbnail: { url: 'https://x.io/s.jpg' } } })).toEqual({ video: null, link: null, image: 'https://x.io/s.jpg' });
    expect(howToMedia({}, {})).toEqual({ video: null, link: null, image: null });
    expect(howToMedia(null, {})).toEqual({ video: null, link: null, image: null });
  });

  it('the pill also shows for an exercise that has only media', () => {
    expect(showHowToPill({ status: 'ready', exercise: { media: media({ media_type: 'video', url: 'https://youtu.be/a' }) } }, {})).toBe(true);
  });

  const props = { open: true, sessionExercise: SESSION_EXERCISE, onRetry: jest.fn(), onClose: jest.fn() };
  const byId = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.type === 'string');

  it('a video file plays inline: native controls, contain, no autoplay, no PiP / background; the image is not shown', () => {
    mockPlayers.length = 0;
    const exercise = { description: 'Brace.', media: media({ media_type: 'video', url: 'https://x.io/squat.mp4' }) };
    const tree = render(<HowToSheet {...props} entry={{ status: 'ready', exercise }} />);
    const [view] = byId(tree, 'video-view-native');
    expect(view.props).toMatchObject({ nativeControls: true, contentFit: 'contain', allowsPictureInPicture: false, accessibilityLabel: 'Squat video' });
    expect(mockPlayers[0].source).toBe('https://x.io/squat.mp4');
    expect(mockPlayers[0].loop).toBe(false);
    expect(mockPlayers[0].play).not.toHaveBeenCalled();
    expect(view.props.player).toBe(mockPlayers[0]);
    expect(byId(tree, 'how-to-video')).toHaveLength(1);
    expect(tree.root.findAll((node) => node.props.testID === 'remote-image')).toHaveLength(0);
    expect(byId(tree, 'how-to-watch-video')).toHaveLength(0);
    expect(texts(tree)).toEqual(expect.arrayContaining(['How to do it', 'Brace.']));
  });

  it('a non-file video is a "Watch video" link that opens externally; the thumbnail still shows', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const exercise = { media: media({ media_type: 'video', url: 'https://youtube.com/watch?v=1' }) };
    const tree = render(<HowToSheet {...props} entry={{ status: 'ready', exercise }} />);
    expect(byId(tree, 'video-view-native')).toHaveLength(0);
    const link = tree.root.findAll((node) => node.props.testID === 'how-to-watch-video' && node.props.onPress)[0];
    expect(link.props.accessibilityRole).toBe('link');
    expect(texts(tree)).toContain('Watch video');
    await act(async () => link.props.onPress());
    expect(open).toHaveBeenCalledWith('https://youtube.com/watch?v=1');
    expect(tree.root.findAll((node) => node.props.testID === 'remote-image')[0].props.url).toBe('https://example.com/s.jpg');
    open.mockRestore();
  });

  it('a failed link open is swallowed (no crash)', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no handler'));
    const exercise = { media: media({ media_type: 'video', url: 'https://youtube.com/watch?v=1' }) };
    const tree = render(<HowToSheet {...props} entry={{ status: 'ready', exercise }} />);
    const link = tree.root.findAll((node) => node.props.testID === 'how-to-watch-video' && node.props.onPress)[0];
    await act(async () => link.props.onPress());
    expect(open).toHaveBeenCalled();
    open.mockRestore();
  });

  it('no video: the first media image wins over the thumbnail', () => {
    const exercise = { media: media({ media_type: 'image', url: 'https://x.io/first.jpg' }, { media_type: 'image', url: 'https://x.io/second.jpg' }) };
    const tree = render(<HowToSheet {...props} entry={{ status: 'ready', exercise }} />);
    expect(tree.root.findAll((node) => node.props.testID === 'remote-image')[0].props.url).toBe('https://x.io/first.jpg');
    expect(byId(tree, 'video-view-native')).toHaveLength(0);
  });
});
