import { splitStopColor } from './GradientFill';

describe('splitStopColor', () => {
  it('moves an rgba alpha into stopOpacity', () => {
    expect(splitStopColor('rgba(255, 255, 255, 0.7)')).toEqual({ stopColor: 'rgb(255, 255, 255)', stopOpacity: 0.7 });
    expect(splitStopColor('rgba(255,255,255,0)')).toEqual({ stopColor: 'rgb(255, 255, 255)', stopOpacity: 0 });
  });

  it('leaves opaque colours alone', () => {
    expect(splitStopColor('#f4b400')).toEqual({ stopColor: '#f4b400', stopOpacity: 1 });
    expect(splitStopColor('rgb(17, 24, 39)')).toEqual({ stopColor: 'rgb(17, 24, 39)', stopOpacity: 1 });
  });
});

describe('GradientFill', () => {
  const { act, create } = require('react-test-renderer');
  const { View } = require('react-native');
  const { LinearGradient, RadialGradient, Stop, default: Svg } = require('react-native-svg');
  const GradientFill = require('./GradientFill').default;
  const { gradients } = require('../theme/tokens');

  function render(props, layout = { width: 300, height: 200 }) {
    let tree;
    act(() => {
      tree = create(<GradientFill {...props} />);
    });
    if (layout) {
      act(() => {
        tree.root.findByType(View).props.onLayout({ nativeEvent: { layout } });
      });
    }
    return tree;
  }

  it('draws nothing until it has a size (no 0×0 gradient on Android)', () => {
    expect(render(gradients.card, null).root.findAllByType(Svg)).toHaveLength(0);
  });

  it('draws a linear gradient with an explicit Svg size by default', () => {
    const tree = render(gradients.card);
    expect(tree.root.findByType(Svg).props).toMatchObject({ width: 300, height: 200 });
    expect(tree.root.findAllByType(LinearGradient)).toHaveLength(1);
    expect(tree.root.findAllByType(RadialGradient)).toHaveLength(0);
  });

  it('draws the ambient gold glow as an elliptical radial gradient in px', () => {
    const tree = render(gradients.goldAmbient);
    const radial = tree.root.findByType(RadialGradient);
    expect(radial.props).toMatchObject({ cx: 150, cy: 84, fx: 150, fy: 84, rx: 240, ry: 90, gradientUnits: 'userSpaceOnUse' });
    const stops = tree.root.findAllByType(Stop).map((stop) => stop.props);
    expect(stops).toEqual([
      expect.objectContaining({ offset: 0, stopColor: 'rgb(255, 194, 26)', stopOpacity: 0.2 }),
      expect.objectContaining({ offset: 0.68, stopColor: 'rgb(255, 194, 26)', stopOpacity: 0 }),
    ]);
  });

  it('keeps the gold gradient for avatars/initials/logo with its 45 % stop', () => {
    expect(gradients.gold).toEqual({ angle: 145, colors: ['#FFD45C', '#FFC21A', '#F29E00'], stops: [0, 0.45, 1] });
    expect(gradients.card).toEqual({ angle: 160, colors: ['#1E2129', '#14161C'] });
  });
});
