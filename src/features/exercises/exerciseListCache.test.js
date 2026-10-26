import { clearExerciseListCache, getCachedList, setCachedList } from './exerciseListCache';

// The four cases of RN-SPEC-exercises §E1.1a "Cache tests to match".
const store = (names) => names.forEach((name) => setCachedList(name, [name]));
const range = (count) => Array.from({ length: count }, (_, index) => `s${index}`);

beforeEach(() => clearExerciseListCache());

describe('exercise list cache (§E1.1a, LRU 10)', () => {
  it('one list per search, no search stored as ""', () => {
    setCachedList(undefined, ['all']);
    setCachedList('row', ['rows']);
    expect(getCachedList('')).toEqual(['all']);
    expect(getCachedList('row')).toEqual(['rows']);
    expect(getCachedList('squat')).toBeNull();
  });

  it('keeps only the last 10 searches', () => {
    store(range(11));
    expect(getCachedList('s0')).toBeNull();
    for (const name of range(11).slice(1)) {
      expect(getCachedList(name)).toEqual([name]);
    }
  });

  it('drops the least recently used, a read counts as a use', () => {
    store(range(10));
    getCachedList('s0');
    setCachedList('new', ['new']);
    expect(getCachedList('s0')).toEqual(['s0']);
    expect(getCachedList('s1')).toBeNull();
    expect(getCachedList('new')).toEqual(['new']);
  });

  it('replacing a search does not count twice', () => {
    store(range(10));
    setCachedList('s5', ['fresh']);
    expect(getCachedList('s0')).toEqual(['s0']);
    expect(getCachedList('s5')).toEqual(['fresh']);
  });
});
