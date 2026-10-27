import { exerciseImageProps, getRemoteImageSources, imageSourceProps, isImageMediaType, mediaUrl } from './remoteImageSources';

// RN-SPEC-v2-phase4 "Dated change (27 Oct 2026): image fallback chain, all
// screens" + "Images" (review 26fc4a8 M4 / M5).

const ID = 'AbC_123';
const thumb = (width) => `https://drive.google.com/thumbnail?id=${ID}&sz=w${width}`;
const LH3_W = `https://lh3.googleusercontent.com/d/${ID}=w1600`;
const LH3_S = `https://lh3.googleusercontent.com/d/${ID}=s1600`;

describe('getRemoteImageSources (the v2 chain)', () => {
  it('a Drive file link: (sized thumbnail) → stored URL → thumbnail w1600 → lh3 =w1600 → lh3 =s1600', () => {
    const stored = `https://drive.google.com/file/d/${ID}/view`;
    expect(getRemoteImageSources(stored)).toEqual([stored, thumb(1600), LH3_W, LH3_S]);
    expect(getRemoteImageSources(stored, { width: 400 })).toEqual([thumb(400), stored, thumb(1600), LH3_W, LH3_S]);
  });

  it('a uc?export=view / export=download link is NEVER tried; its id drives the chain (not first)', () => {
    for (const stored of [
      `https://drive.google.com/uc?export=view&id=${ID}`,
      `https://drive.google.com/uc?export=download&id=${ID}`,
      `https://drive.google.com/uc?id=${ID}&export=view`,
    ]) {
      const list = getRemoteImageSources(stored);
      expect(list).toEqual([thumb(1600), LH3_W, LH3_S]);
      expect(list.some((url) => /\/uc\?/.test(url))).toBe(false);
      expect(getRemoteImageSources(stored, { width: 400 })).toEqual([thumb(400), thumb(1600), LH3_W, LH3_S]);
    }
  });

  it('a uc link with no id, an empty or blank URL → no candidate (the tile immediately)', () => {
    expect(getRemoteImageSources('https://drive.google.com/uc?export=view')).toEqual([]);
    expect(getRemoteImageSources('')).toEqual([]);
    expect(getRemoteImageSources('   ')).toEqual([]);
    expect(getRemoteImageSources(null)).toEqual([]);
    expect(getRemoteImageSources(undefined)).toEqual([]);
  });

  it('stored lh3 /d/{id} and thumbnail URLs render as stored (thumbnail URL first, then the chain, no duplicates)', () => {
    const lh3 = `https://lh3.googleusercontent.com/d/${ID}`;
    expect(getRemoteImageSources(lh3)).toEqual([lh3]);
    expect(getRemoteImageSources(thumb(1600))).toEqual([thumb(1600), LH3_W, LH3_S]);
    expect(getRemoteImageSources(thumb(800))).toEqual([thumb(800), thumb(1600), LH3_W, LH3_S]);
  });

  it('a plain URL is tried as-is (cleaned: quotes and &amp;)', () => {
    expect(getRemoteImageSources(' "https://x.test/a.jpg?a=1&amp;b=2" ')).toEqual(['https://x.test/a.jpg?a=1&b=2']);
    expect(getRemoteImageSources('https://x.test/a.jpg', { width: 400 })).toEqual(['https://x.test/a.jpg']);
  });
});

describe('media_type (a video is not an image)', () => {
  it('isImageMediaType: absent / image / image/* → true; video, video/mp4, other → false', () => {
    expect([undefined, null, '', 'image', 'IMAGE', 'image/jpeg'].map(isImageMediaType)).toEqual([true, true, true, true, true, true]);
    expect(['video', 'VIDEO', 'video/mp4', 'gif-video', 'document'].map(isImageMediaType)).toEqual([false, false, false, false, false]);
  });

  it('mediaUrl: the url of an image media / a string; a video or no url → null', () => {
    expect(mediaUrl({ url: 'https://x.test/a.jpg', media_type: 'image' })).toBe('https://x.test/a.jpg');
    expect(mediaUrl({ url: 'https://x.test/a.jpg' })).toBe('https://x.test/a.jpg');
    expect(mediaUrl('https://x.test/a.jpg')).toBe('https://x.test/a.jpg');
    expect(mediaUrl({ url: 'https://x.test/a.mp4', media_type: 'video' })).toBeNull();
    expect(mediaUrl({ url: '' })).toBeNull();
    expect(mediaUrl(null)).toBeNull();
  });
});

describe('ExerciseImage props', () => {
  it('imageSourceProps: url + its candidates; no candidate → url null (the §8.1 tile, no load)', () => {
    expect(imageSourceProps('https://x.test/a.jpg')).toEqual({ url: 'https://x.test/a.jpg', sources: ['https://x.test/a.jpg'] });
    expect(imageSourceProps('https://drive.google.com/uc?export=view')).toEqual({ url: null, sources: [] });
    expect(imageSourceProps(null)).toEqual({ url: null, sources: [] });
  });

  it('exerciseImageProps: thumbnail image → the chain; a video thumbnail → url null; none → url null', () => {
    const uc = `https://drive.google.com/uc?export=view&id=${ID}`;
    expect(exerciseImageProps({ thumbnail: { url: uc, media_type: 'image' } }, { width: 400 })).toEqual({
      url: uc,
      sources: [thumb(400), thumb(1600), LH3_W, LH3_S],
    });
    expect(exerciseImageProps({ thumbnail: { url: 'https://x.test/a.mp4', media_type: 'video' } })).toEqual({ url: null, sources: [] });
    expect(exerciseImageProps({ name: 'Row' })).toEqual({ url: null, sources: [] });
    expect(exerciseImageProps(undefined)).toEqual({ url: null, sources: [] });
  });
});
