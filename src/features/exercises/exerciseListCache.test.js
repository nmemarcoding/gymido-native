import { MAX_CACHED_SEARCHES, clearExerciseListCache, getCachedList, setCachedList } from './exerciseListCache';

const fill = (count) => {
  for (let index = 0; index < count; index += 1) {
    setCachedList(`s${index}`, [index]);
  }
};

beforeEach(() => clearExerciseListCache());

describe('exercise list cache (§E1.1a, LRU 10)', () => {
  it('stores and reads a list per search, null when missing', () => {
    setCachedList('', [1, 2]);
    expect(getCachedList('')).toEqual([1, 2]);
    expect(getCachedList('row')).toBeNull();
  });

  it('keeps at most 10 searches; an 11th drops the least recently used', () => {
    fill(MAX_CACHED_SEARCHES + 1);
    expect(MAX_CACHED_SEARCHES).toBe(10);
    expect(getCachedList('s0')).toBeNull();
    expect(getCachedList('s1')).toEqual([1]);
    expect(getCachedList('s10')).toEqual([10]);
  });

  it('a read makes a search the newest', () => {
    fill(MAX_CACHED_SEARCHES);
    getCachedList('s0');
    setCachedList('new', []);
    expect(getCachedList('s0')).toEqual([0]);
    expect(getCachedList('s1')).toBeNull();
  });

  it('a store of a known search makes it the newest without growing the cache', () => {
    fill(MAX_CACHED_SEARCHES);
    setCachedList('s0', ['fresh']);
    setCachedList('new', []);
    expect(getCachedList('s0')).toEqual(['fresh']);
    expect(getCachedList('s1')).toBeNull();
    expect(getCachedList('s2')).toEqual([2]);
  });
});
