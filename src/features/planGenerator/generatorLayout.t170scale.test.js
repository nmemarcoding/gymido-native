import { isReflow } from './generatorLayout';

// T-170 step 4: the generator screens' reflow point (fontScale > 1.3).
describe('generatorLayout isReflow', () => {
  it.each([
    [1, false],
    [1.15, false],
    [1.3, false],
    [1.31, true],
    [2, true],
  ])('fontScale %s -> %s', (scale, expected) => {
    expect(isReflow(scale)).toBe(expected);
  });
});
