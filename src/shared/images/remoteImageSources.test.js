import { cleanImageUrl, getDriveFileId, getRemoteImageSources } from './remoteImageSources';

describe('getRemoteImageSources', () => {
  it('returns only the cleaned URL for non-Drive images', () => {
    expect(getRemoteImageSources(' "https://cdn.example.com/a.png?x=1&amp;y=2" ')).toEqual([
      'https://cdn.example.com/a.png?x=1&y=2',
    ]);
    expect(getRemoteImageSources(null)).toEqual([]);
  });

  it('adds the Drive fallbacks in order, without the uc?export candidates (dated change @ 81ef4911)', () => {
    const url = 'https://drive.google.com/file/d/abc_123-x/view?usp=sharing';
    expect(getRemoteImageSources(url)).toEqual([
      url,
      'https://drive.google.com/thumbnail?id=abc_123-x&sz=w1600',
      'https://lh3.googleusercontent.com/d/abc_123-x=w1600',
      'https://lh3.googleusercontent.com/d/abc_123-x=s1600',
    ]);
  });

  // DECLARED change (27 Oct dated chain, all screens): a stored uc link is no
  // longer tried as-is (was: `url` first in this list).
  it('drops a duplicate of the original, and never tries a uc link as-is', () => {
    const url = 'https://drive.google.com/uc?export=view&id=AB';
    expect(getRemoteImageSources(url)).toEqual([
      'https://drive.google.com/thumbnail?id=AB&sz=w1600',
      'https://lh3.googleusercontent.com/d/AB=w1600',
      'https://lh3.googleusercontent.com/d/AB=s1600',
    ]);
    expect(getRemoteImageSources(url).some((source) => source.includes('export=download'))).toBe(false);
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

// RN-SPEC-v2-phase4 "Dated change (27 Oct 2026): image fallback chain, ALL
// screens" — the shared chain now follows it (P4's planImages folded in).
describe('dated chain, all screens (27 Oct 2026)', () => {
  const {
    getRemoteImageSources: chain,
    mediaUrl,
    exerciseImageProps,
    thumbImageProps,
  } = require('./remoteImageSources');

  it('a stored uc link is never tried as-is; its id drives the chain', () => {
    expect(chain('https://drive.google.com/uc?export=view&id=abc')).toEqual([
      'https://drive.google.com/thumbnail?id=abc&sz=w1600',
      'https://lh3.googleusercontent.com/d/abc=w1600',
      'https://lh3.googleusercontent.com/d/abc=s1600',
    ]);
  });

  it('a uc link with no id has no candidate (the tile at once)', () => {
    expect(chain('https://drive.google.com/uc?export=view')).toEqual([]);
  });

  it('a sized request asks Drive for that width first, then the stored URL', () => {
    expect(chain('https://drive.google.com/file/d/abc/view', { width: 400 }).slice(0, 2)).toEqual([
      'https://drive.google.com/thumbnail?id=abc&sz=w400',
      'https://drive.google.com/file/d/abc/view',
    ]);
  });

  it('a video media is never drawn as an image; an image media is', () => {
    expect(mediaUrl({ url: 'https://x.test/v.mp4', media_type: 'video/mp4' })).toBeNull();
    expect(mediaUrl({ url: 'https://x.test/a.png', media_type: 'image/png' })).toBe('https://x.test/a.png');
    expect(exerciseImageProps({ thumbnail: { url: 'https://x.test/v.mp4', media_type: 'video/mp4' } })).toEqual({ url: null, sources: [] });
    expect(thumbImageProps({ thumbnail: { url: 'https://drive.google.com/file/d/abc/view' } }).sources[0]).toBe('https://drive.google.com/thumbnail?id=abc&sz=w400');
  });
});
