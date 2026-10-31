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

  it('takes /regex/ ids', () => {
    const r = check(screen(FIT, [node({ 'resource-id': 'set-action-12', clickable: 'true', bounds: '[24,700][696,812]' })]), { mode: 'fit', require: ['/set-action-.*/'], density: 2 });
    expect(r.failures).toEqual([]);
    expect(check(screen(FIT), { mode: 'fit', require: ['/set-action-.*/'] }).failures).toEqual(['/set-action-.*/ not on screen']);
  });

  it('id+N adds a hitSlop the dump does not show (the 32 Discard link + 6 = 44)', () => {
    const tree = screen(FIT, [node({ 'resource-id': 'link', clickable: 'true', bounds: '[200,1000][520,1064]' })]);
    expect(check(tree, { mode: 'fit', require: ['link'], density: 2 }).failures).toEqual(['link hit area 32.0 dp < 44']);
    expect(check(tree, { mode: 'fit', require: ['link+6'], density: 2 }).failures).toEqual([]);
  });

  it('a fit that overflows at the floor (O > 0) reports its off-screen controls instead of failing', () => {
    const r = check(screen('session-page fit-L8-P112-O40-U624-R640-G20-settled'), { mode: 'fit', require: ['up-next'], density: 2 });
    expect(r).toMatchObject({ ok: true, over: 40, reported: ['up-next not on screen'], failures: [] });
  });

  it('--inside: the disc digits must sit inside the disc', () => {
    const disc = (digits) => screen(FIT, [node({ 'resource-id': 'rest-timer', bounds: '[500,900][684,1084]' }, [node({ 'resource-id': 'rest-countdown', bounds: digits })])]);
    expect(check(disc('[540,960][644,1024]'), { mode: 'any', inside: ['rest-countdown:rest-timer'] }).failures).toEqual([]);
    expect(check(disc('[480,960][704,1024]'), { mode: 'any', inside: ['rest-countdown:rest-timer'] }).failures).toEqual([
      'rest-countdown (224×64) not inside rest-timer (184×184)',
    ]);
  });

  it('mode any skips the mode; the OS status bar is never checked', () => {
    const tree = node({ bounds: '[0,0][390,844]' }, [node({ 'resource-id': 'wifi', text: 'Wi-Fi', bounds: '[300,10][420,40]' }), node({ 'resource-id': 'rest-sheet', bounds: '[0,100][390,844]' })]);
    expect(check(tree, { mode: 'any' }).failures).toEqual([]);
  });

  it('skips OS status-bar items by id even below the top band (largest text sizes)', () => {
    const tree = node({ bounds: '[0,0][390,844]' }, [node({ 'resource-id': 'wifi', text: 'Wi-Fi', bounds: '[300,70][420,110]' }), node({ 'resource-id': 'rest-sheet', bounds: '[0,120][390,844]' })]);
    expect(check(tree, { mode: 'any' }).failures).toEqual([]);
  });
});
