// Ported from the web's `shared/utils/images.js` (RN-SPEC-workout §19.7 native
// equivalents). Exercise thumbnails are often Google Drive links, and Drive
// serves a share URL as HTML rather than an image — so a single <Image> with the
// stored URL fails silently and every card falls back to its placeholder. The
// web works around it by trying the raw URL first and then five Drive forms,
// advancing on each error. Native has to do the same or Drive-hosted thumbnails
// are invisible.

const DRIVE_FILE_ID_PATTERNS = [
  /drive\.google\.com\/file\/d\/([^/]+)\//i,
  /drive\.google\.com\/open\?id=([^&]+)/i,
  /drive\.google\.com\/uc\?(?:.*&)?id=([^&]+)/i,
  /drive\.usercontent\.google\.com\/download\?(?:.*&)?id=([^&]+)/i,
];

export function normalizeImageUrl(url) {
  const rawUrl = String(url || '').trim();
  if (!rawUrl) {
    return '';
  }
  // Stored URLs sometimes arrive quoted or HTML-escaped.
  const unquoted = rawUrl.replace(/^["']+|["']+$/g, '');
  return unquoted.replace(/&amp;/g, '&');
}

export function getGoogleDriveFileId(url) {
  const rawUrl = normalizeImageUrl(url);
  if (!rawUrl) {
    return '';
  }

  try {
    const parsed = new URL(rawUrl);
    const searchId = parsed.searchParams.get('id');
    if (searchId) {
      return searchId;
    }
    const pathname = parsed.pathname || '';
    for (const pattern of DRIVE_FILE_ID_PATTERNS) {
      const match = pathname.match(pattern) || rawUrl.match(pattern);
      if (match?.[1]) {
        return match[1];
      }
    }
  } catch {
    for (const pattern of DRIVE_FILE_ID_PATTERNS) {
      const match = rawUrl.match(pattern);
      if (match?.[1]) {
        return match[1];
      }
    }
  }

  return '';
}

// The raw URL first, then the Drive variants, in the web's order. Deduplicated,
// so a URL that is already one of the variants is not retried against itself.
export function getDriveImageCandidates(url) {
  const normalizedUrl = normalizeImageUrl(url);
  if (!normalizedUrl) {
    return [];
  }

  const candidates = [normalizedUrl];
  const driveFileId = getGoogleDriveFileId(normalizedUrl);

  if (driveFileId) {
    const id = encodeURIComponent(driveFileId);
    candidates.push(`https://drive.google.com/uc?export=view&id=${id}`);
    candidates.push(`https://drive.google.com/uc?export=download&id=${id}`);
    candidates.push(`https://drive.google.com/thumbnail?id=${id}&sz=w1600`);
    candidates.push(`https://lh3.googleusercontent.com/d/${id}=w1600`);
    candidates.push(`https://lh3.googleusercontent.com/d/${id}=s1600`);
  }

  return Array.from(new Set(candidates));
}

export function getImageSrc(url) {
  return getDriveImageCandidates(url)[0] || '';
}
