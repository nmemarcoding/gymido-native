// Image URLs to try in order (web shared/utils/images.js). Duplicates are
// dropped; the caller stops at the last one.

const ID_PATTERNS = [
  /drive\.google\.com\/file\/d\/([^/?#]+)\//,
  /drive\.google\.com\/open\?id=([^&#]+)/,
  /drive\.google\.com\/uc\?.*?\bid=([^&#]+)/,
  /drive\.usercontent\.google\.com\/download\?.*?\bid=([^&#]+)/,
];

export function cleanImageUrl(url) {
  return String(url)
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .replace(/&amp;/g, '&');
}

export function getDriveFileId(url) {
  let path = null;
  try {
    const parsed = new URL(url);
    const id = parsed.searchParams.get('id');
    if (id) {
      return id;
    }
    path = `${parsed.host}${parsed.pathname}`;
  } catch {
    // Not a parseable URL: only the full-string match below applies.
  }
  for (const target of [path, url]) {
    if (!target) {
      continue;
    }
    for (const pattern of ID_PATTERNS) {
      const match = target.match(pattern);
      if (match) {
        return match[1];
      }
    }
  }
  return null;
}

// RN-SPEC-v2-phase4 "Dated change (27 Oct 2026): image fallback chain, all
// screens" (web shared/utils/images.js), for EVERY screen (P4's planImages
// folded in here):
//   (sized drive thumbnail?id={id}&sz=w{N} first where a size is asked)
//   → the stored URL (never a drive `uc?…` link: browsers block them)
//   → thumbnail?id={id}&sz=w1600 → lh3 /d/{id}=w1600 → …=s1600
// Each error advances (RemoteImage); all failed → the §8.1 tile. No
// candidate at all (empty URL, a uc link with no id) → the tile at once.
// A media whose media_type is not an image (a video) is never drawn.
// Web parity (kit review LOW): only drive.google.com/uc counts as a uc link.
const UC_LINK = /^https?:\/\/drive\.google\.com\/uc(\?|\/|$)/i;
// Web VIDEO_FILE (kit review MEDIUM): a URL with a video file extension is
// never drawn as an image, whatever (or whether) media_type says.
const VIDEO_FILE = /\.(mp4|webm|mov|m4v|avi|mkv|ogv|3gp)$/i;

export function isVideoFileUrl(url) {
  const path = String(url).split(/[?#]/)[0];
  return VIDEO_FILE.test(path);
}

export function getRemoteImageSources(url, { width } = {}) {
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
    return media.trim() && !isVideoFileUrl(media) ? media : null;
  }
  const url = typeof media?.url === 'string' ? media.url : '';
  if (!url.trim() || !isImageMediaType(media.media_type) || isVideoFileUrl(url)) {
    return null;
  }
  return url;
}

// ExerciseImage / RemoteImage props: the URL (null → the tile, no load) and
// its candidate list.
export function imageSourceProps(url, options) {
  const sources = getRemoteImageSources(url, options);
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
