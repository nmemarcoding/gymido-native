import { getDriveImageCandidates, getGoogleDriveFileId, getImageSrc, normalizeImageUrl } from './images';

// Ported from the web (RN-SPEC-workout §19.7). Without this chain a Drive-hosted
// thumbnail fails silently and every exercise card falls back to a placeholder,
// which looks like correct behaviour rather than a bug — so the chain itself is
// pinned here rather than left to an integration test.
const FILE_ID = '1AbCdEfGhIjKlMnOp';

describe('normalizeImageUrl', () => {
  it('trims, unquotes and unescapes stored URLs', () => {
    expect(normalizeImageUrl('  "https://x.test/a.png"  ')).toBe('https://x.test/a.png');
    expect(normalizeImageUrl('https://x.test/a?b=1&amp;c=2')).toBe('https://x.test/a?b=1&c=2');
  });

  it('returns an empty string for nothing usable', () => {
    expect(normalizeImageUrl(null)).toBe('');
    expect(normalizeImageUrl('   ')).toBe('');
  });
});

describe('getGoogleDriveFileId', () => {
  it('reads the id from every Drive URL shape the web handles', () => {
    expect(getGoogleDriveFileId(`https://drive.google.com/file/d/${FILE_ID}/view`)).toBe(FILE_ID);
    expect(getGoogleDriveFileId(`https://drive.google.com/open?id=${FILE_ID}`)).toBe(FILE_ID);
    expect(getGoogleDriveFileId(`https://drive.google.com/uc?export=view&id=${FILE_ID}`)).toBe(FILE_ID);
    expect(getGoogleDriveFileId(`https://drive.usercontent.google.com/download?id=${FILE_ID}&export=view`)).toBe(
      FILE_ID
    );
  });

  it('is empty for a non-Drive URL', () => {
    expect(getGoogleDriveFileId('https://cdn.test/a.png')).toBe('');
  });
});

describe('getDriveImageCandidates', () => {
  it('is just the URL itself when it is not a Drive link', () => {
    expect(getDriveImageCandidates('https://cdn.test/a.png')).toEqual(['https://cdn.test/a.png']);
  });

  it('adds the five Drive variants after the raw URL, in the web order', () => {
    const candidates = getDriveImageCandidates(`https://drive.google.com/file/d/${FILE_ID}/view`);
    expect(candidates[0]).toBe(`https://drive.google.com/file/d/${FILE_ID}/view`);
    expect(candidates.slice(1)).toEqual([
      `https://drive.google.com/uc?export=view&id=${FILE_ID}`,
      `https://drive.google.com/uc?export=download&id=${FILE_ID}`,
      `https://drive.google.com/thumbnail?id=${FILE_ID}&sz=w1600`,
      `https://lh3.googleusercontent.com/d/${FILE_ID}=w1600`,
      `https://lh3.googleusercontent.com/d/${FILE_ID}=s1600`,
    ]);
  });

  it('never repeats a candidate when the stored URL is already a variant', () => {
    const url = `https://drive.google.com/uc?export=view&id=${FILE_ID}`;
    const candidates = getDriveImageCandidates(url);
    expect(new Set(candidates).size).toBe(candidates.length);
  });

  it('is empty for nothing usable', () => {
    expect(getDriveImageCandidates('')).toEqual([]);
    expect(getImageSrc(null)).toBe('');
  });
});
