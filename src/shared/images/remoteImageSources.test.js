import { cleanImageUrl, getDriveFileId, getRemoteImageSources } from './remoteImageSources';

describe('getRemoteImageSources', () => {
  it('returns only the cleaned URL for non-Drive images', () => {
    expect(getRemoteImageSources(' "https://cdn.example.com/a.png?x=1&amp;y=2" ')).toEqual([
      'https://cdn.example.com/a.png?x=1&y=2',
    ]);
    expect(getRemoteImageSources(null)).toEqual([]);
  });

  it('adds the Drive fallbacks in order', () => {
    const url = 'https://drive.google.com/file/d/abc_123-x/view?usp=sharing';
    expect(getRemoteImageSources(url)).toEqual([
      url,
      'https://drive.google.com/uc?export=view&id=abc_123-x',
      'https://drive.google.com/uc?export=download&id=abc_123-x',
      'https://drive.google.com/thumbnail?id=abc_123-x&sz=w1600',
      'https://lh3.googleusercontent.com/d/abc_123-x=w1600',
      'https://lh3.googleusercontent.com/d/abc_123-x=s1600',
    ]);
  });

  it('drops a duplicate of the original', () => {
    const url = 'https://drive.google.com/uc?export=view&id=AB';
    expect(getRemoteImageSources(url)).toHaveLength(5);
  });
});

describe('getDriveFileId', () => {
  it('prefers the id query param', () => {
    expect(getDriveFileId('https://drive.google.com/open?id=XYZ')).toBe('XYZ');
    expect(getDriveFileId('https://drive.usercontent.google.com/download?export=view&id=Q1')).toBe('Q1');
  });

  it('reads /file/d/{id}/ and ignores other hosts', () => {
    expect(getDriveFileId('https://drive.google.com/file/d/F00/view')).toBe('F00');
    expect(getDriveFileId('https://example.com/file/d/F00/view')).toBeNull();
  });

  it('cleans quotes and &amp;', () => {
    expect(cleanImageUrl(`'a&amp;b'`)).toBe('a&b');
  });
});
