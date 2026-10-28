import {
  compactSetSummary,
  dayOfMonth,
  joinWithAnd,
  planPhotoUrl,
  stripCells,
  thisWeekCards,
  weekCardMeta,
} from './libraryFormat';

// v2 Phase 4 §1 (UX H) helpers.
const day = (id, title) => ({ id, title });
const wd = (id, name) => ({ id, name });
const item = (id, muscle, sets = { set_count: 3, target_reps_min: 8, target_reps_max: 10 }) => ({
  id,
  exercise: { name: `E${id}`, primary_muscle_group: muscle ? { name: muscle } : undefined },
  target_set_summary: sets,
});

describe('compactSetSummary (the short form, U+00D7)', () => {
  it.each([
    [{ set_count: 3, target_reps_min: 8, target_reps_max: 10 }, '3×8-10'],
    [{ set_count: 3, target_reps_min: 12, target_reps_max: 12 }, '3×12'],
    [{ set_count: 1 }, '1 set'],
    [{ set_count: 4 }, '4 sets'],
    [undefined, 'Open prescription'],
  ])('%j → %s', (summary, expected) => {
    expect(compactSetSummary({ target_set_summary: summary })).toBe(expected);
  });
});

describe('small helpers', () => {
  it('joinWithAnd', () => {
    expect(joinWithAnd([])).toBe('');
    expect(joinWithAnd(['Mon'])).toBe('Mon');
    expect(joinWithAnd(['Mon', 'Tue'])).toBe('Mon and Tue');
    expect(joinWithAnd(['Mon', 'Tue', 'Wed'])).toBe('Mon, Tue and Wed');
  });

  it('dayOfMonth', () => {
    expect(dayOfMonth('2026-10-09')).toBe('9');
    expect(dayOfMonth('2026-10-29T00:00:00Z')).toBe('29');
    expect(dayOfMonth('')).toBe('');
    expect(dayOfMonth(null)).toBe('');
  });

  it('weekCardMeta: count + up to 3 muscles', () => {
    expect(weekCardMeta([item(1, 'Chest'), item(2, 'Back'), item(3, 'Chest'), item(4, 'Legs'), item(5, 'Arms')])).toBe('5 exercises · Chest, Back, Legs');
    expect(weekCardMeta([item(1)])).toBe('1 exercise');
  });

  it('stripCells: all up to 4; past 4 the 4th carries +n', () => {
    expect(stripCells([item(1), item(2)]).map((cell) => cell.more)).toEqual([0, 0]);
    expect(stripCells([1, 2, 3, 4].map((id) => item(id))).map((cell) => cell.more)).toEqual([0, 0, 0, 0]);
    expect(stripCells([1, 2, 3, 4, 5, 6].map((id) => item(id))).map((cell) => cell.more)).toEqual([0, 0, 0, 3]);
  });

  it('planPhotoUrl (N3): only an image thumbnail', () => {
    expect(planPhotoUrl({ thumbnail: { url: ' https://x/a.jpg ', media_type: 'image' } })).toBe('https://x/a.jpg');
    expect(planPhotoUrl({ thumbnail: { url: 'https://x/a.jpg', media_type: 'image/jpeg' } })).toBe('https://x/a.jpg');
    expect(planPhotoUrl({ thumbnail: { url: 'https://x/a.jpg' } })).toBe('https://x/a.jpg');
    expect(planPhotoUrl({ thumbnail: { url: 'https://x/a.mp4', media_type: 'video' } })).toBeNull();
    expect(planPhotoUrl({ thumbnail: { url: '' } })).toBeNull();
    expect(planPhotoUrl({})).toBeNull();
  });
});

describe('thisWeekCards (approved #9)', () => {
  const week = [
    { weekday: wd(1, 'Monday'), is_workout_day: true, plan_day: day(11, 'Upper A'), date: '2026-10-26', status: 'done' },
    { weekday: wd(2, 'Tuesday'), is_workout_day: true, plan_day: day(12, 'Lower A'), date: '2026-10-27', status: 'done' },
    { weekday: wd(3, 'Wednesday'), is_workout_day: false, date: '2026-10-28', status: 'rest' },
    { weekday: wd(4, 'Thursday'), is_workout_day: true, plan_day: day(13, 'Upper B'), date: '2026-10-29', status: 'today' },
    { weekday: wd(5, 'Friday'), is_workout_day: true, plan_day: day(14, ''), date: '2026-10-30', status: 'upcoming' },
    { weekday: wd(6, 'Saturday'), is_workout_day: true, plan_day: day(15, 'Arms'), date: '2026-10-31', status: 'missed' },
  ];

  it('splits today / others (week order) / one done summary; rest days have no card', () => {
    const cards = thisWeekCards(week, { 13: [item(1, 'Chest')] });
    expect(cards.today).toEqual(expect.objectContaining({ title: 'Upper B', date: '29', status: 'today', meta: '1 exercise · Chest' }));
    expect(cards.today.weekday.label).toBe('Thu');
    expect(cards.others.map((card) => [card.status, card.title])).toEqual([
      ['upcoming', 'Day'],
      ['missed', 'Arms'],
    ]);
    expect(cards.done).toEqual({ titles: 'Upper A · Lower A', label: 'Done Mon and Tue' });
  });

  it('no statuses → null (never guessed); nothing done → no summary; no today', () => {
    expect(thisWeekCards(week.map(({ status, ...rest }) => rest))).toBeNull();
    expect(thisWeekCards(undefined)).toBeNull();
    const cards = thisWeekCards(week.filter((entry) => entry.status !== 'done' && entry.status !== 'today'));
    expect([cards.today, cards.done]).toEqual([null, null]);
  });
});
