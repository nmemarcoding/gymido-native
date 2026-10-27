import { cleanImageUrl, getDriveFileId } from '../../shared/images/remoteImageSources';

// RN-SPEC-v2-phase4 "Dated change (27 Oct 2026): image fallback chain, all
// screens" (web shared/utils/images.js) and "Images" (review 26fc4a8 M4/M5),
// for the Phase 4 screens (plans, plan detail, builder, generator):
//   (sized drive thumbnail?id={id}&sz=w{N} first where a size is asked)
//   → the stored URL (never a drive `uc?…` link: browsers block them)
//   → thumbnail?id={id}&sz=w1600 → lh3 /d/{id}=w1600 → …=s1600
// Each error advances (RemoteImage); all failed → the §8.1 tile. No
// candidate at all (empty URL, a uc link with no id) → the tile at once.
// A media whose media_type is not an image (a video) is never drawn.
// The shared getRemoteImageSources still has the v1 order (listed for the lead).

const UC_LINK = /^https?:\/\/(drive|docs)\.google\.com\/uc(\?|\/|$)/i;

export function isImageMediaType(type) {
  if (type === undefined || type === null || type === '') {
    return true;
  }
  return String(type).trim().toLowerCase().startsWith('image');
}

// A media object {url, media_type} or a plain URL string → the URL to draw,
// or null (no URL, or not an image).
export function mediaUrl(media) {
  if (typeof media === 'string') {
    return media.trim() ? media : null;
  }
  const url = typeof media?.url === 'string' ? media.url : '';
  if (!url.trim() || !isImageMediaType(media.media_type)) {
    return null;
  }
  return url;
}

export function imageCandidates(url, { width } = {}) {
  if (typeof url !== 'string' || !url.trim()) {
    return [];
  }
  const stored = cleanImageUrl(url);
  if (!stored) {
    return [];
  }
  const uc = UC_LINK.test(stored);
  const id = getDriveFileId(stored);
  if (!id) {
    return uc ? [] : [stored];
  }
  const encoded = encodeURIComponent(id);
  const candidates = [
    width ? `https://drive.google.com/thumbnail?id=${encoded}&sz=w${width}` : null,
    uc ? null : stored,
    `https://drive.google.com/thumbnail?id=${encoded}&sz=w1600`,
    `https://lh3.googleusercontent.com/d/${encoded}=w1600`,
    `https://lh3.googleusercontent.com/d/${encoded}=s1600`,
  ].filter(Boolean);
  return [...new Set(candidates)];
}

// ExerciseImage / RemoteImage props: the URL (null → the tile, no load) and
// its candidate list.
export function imageSourceProps(url, options) {
  const sources = imageCandidates(url, options);
  return { url: sources.length ? url : null, sources };
}

// An exercise's thumbnail (respecting media_type) → ExerciseImage props.
export function exerciseImageProps(exercise, options) {
  return imageSourceProps(mediaUrl(exercise?.thumbnail), options);
}

// Thumbnails (≤ 150 pt) ask Drive for w400 first, as the Exercises grid
// (RN-SPEC-exercises F4); heroes ask no size.
export const THUMB_WIDTH = 400;

// A thumbnail's props (w400 first).
export function thumbImageProps(exercise) {
  return exerciseImageProps(exercise, { width: THUMB_WIDTH });
}
