import { centeredScrollOffset } from '../runtime/runtimeRules';

// §22.3: the whole feature is one key plus one effect. The arithmetic lives
// here; the three triggers are covered in SessionRuntime.test.js.
describe('centeredScrollOffset (§22.3)', () => {
  const VIEW = { visibleHeight: 600, contentHeight: 3000 };

  it('centres the row in the visible area', () => {
    expect(centeredScrollOffset({ rowY: 1000, rowHeight: 200, ...VIEW })).toBe(800);
  });

  it('never scrolls above the top of the content', () => {
    expect(centeredScrollOffset({ rowY: 0, rowHeight: 120, ...VIEW })).toBe(0);
    expect(centeredScrollOffset({ rowY: 50, rowHeight: 120, ...VIEW })).toBe(0);
  });

  it('never scrolls past the end of the content', () => {
    expect(centeredScrollOffset({ rowY: 2900, rowHeight: 200, ...VIEW })).toBe(2400);
  });

  it('stays at 0 when the content is shorter than the viewport', () => {
    expect(
      centeredScrollOffset({ rowY: 100, rowHeight: 120, visibleHeight: 600, contentHeight: 400 })
    ).toBe(0);
  });

  it('does nothing before the scroll view has been measured', () => {
    expect(
      centeredScrollOffset({ rowY: 100, rowHeight: 120, visibleHeight: 0, contentHeight: 3000 })
    ).toBeNull();
  });
});
