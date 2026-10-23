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
