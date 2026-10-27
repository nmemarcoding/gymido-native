// Jest stub for expo-video (a native module; no player in Node). Tests that
// assert on the player mock it themselves (HowToSheet.test.js).
const { View } = require('react-native');

function createPlayer(source) {
  return { source, loop: false, play: jest.fn(), pause: jest.fn(), release: jest.fn() };
}

module.exports = {
  useVideoPlayer: (source, setup) => {
    const player = createPlayer(source);
    setup?.(player);
    return player;
  },
  createVideoPlayer: createPlayer,
  VideoView: (props) => require('react').createElement(View, { testID: 'video-view-native', ...props }),
  VideoAirPlayButton: () => null,
  isPictureInPictureSupported: () => false,
};
