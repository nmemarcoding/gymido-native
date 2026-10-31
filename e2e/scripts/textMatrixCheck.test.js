/**
 * @jest-environment node
 */
// T-170 step 5: the §9.1 matrix checker (pure; fixtures shaped like `maestro hierarchy`).
const { check, parseBounds } = require('./textMatrixCheck');

const node = (attrs, children = []) => ({ attributes: attrs, children });
const screen = (pageId, extra = []) =>
  node({ bounds: '[0,0][720,1280]' }, [
    node({ 'resource-id': pageId, bounds: '[0,100][720,1280]' }, [
      node({ 'resource-id': 'did-it', clickable: 'true', bounds: '[24,900][696,1012]' }, [node({ text: 'Did it', bounds: '[300,930][420,980]' })]),
      node({ 'resource-id': 'discard-workout', clickable: 'true', bounds: '[200,1100][520,1196]' }),
      ...extra,
    ]),
  ]);
const FIT = 'session-page fit-L3-P200-O0-U600-R640-G9-settled';

describe('textMatrixCheck', () => {
  it('parses Android / iOS bounds', () => {
    expect(parseBounds('[0,10][20,40]')).toEqual({ x1: 0, y1: 10, x2: 20, y2: 40, w: 20, h: 30 });
    expect(parseBounds('[0.5,1][10.5,2]')).toMatchObject({ w: 10, h: 1 });
    expect(parseBounds('')).toBeNull();
  });

  it('passes a settled fit screen with its controls on screen at ≥ 44 dp', () => {
    expect(check(screen(FIT), { mode: 'fit', require: ['did-it', 'discard-workout'], density: 2 })).toMatchObject({ ok: true, mode: 'fit', failures: [] });
  });

  it('reads the mode from the marker: none = large text; an unsettled fit fails', () => {
    expect(check(screen('session-page'), { mode: 'large' })).toMatchObject({ ok: true, mode: 'large' });
    expect(check(screen('session-page'), { mode: 'fit' }).failures).toEqual(['mode large, expected fit']);
    expect(check(screen('session-page fit-L3-P200-G9'), { mode: 'fit' }).failures[0]).toMatch(/not settled/);
  });

  it('fails a required control that is off screen or under 44 dp', () => {
    const r = check(screen(FIT, [node({ 'resource-id': 'up-next', bounds: '[0,1300][720,1400]' }), node({ 'resource-id': 'skip', clickable: 'true', bounds: '[0,200][80,280]' })]), {
      mode: 'fit',
      require: ['up-next', 'skip'],
      density: 2,
    });
    expect(r.failures).toEqual(['up-next not on screen', 'skip hit area 40.0 dp < 44']);
  });

  it('fails text past the window edge or out of its parent, without printing the text', () => {
    const r = check(screen(FIT, [node({ bounds: '[0,300][100,340]' }, [node({ text: 'secret words', bounds: '[0,300][760,340]' })])]), { mode: 'fit' });
    expect(r.failures).toEqual(['text(12 chars) past the window edge', 'text(12 chars) outside its parent box']);
    expect(JSON.stringify(r)).not.toMatch(/secret/);
  });
});
