// Image URLs to try in order for a thumbnail (web shared/utils/images.js, as
// confirmed by frontend 2026-10-21): the cleaned original, then Drive's
// direct-view forms when a Drive file id is found. Duplicates are dropped;
// the caller stops at the last one.

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

export function getRemoteImageSources(url) {
  if (!url) {
    return [];
  }
  const original = cleanImageUrl(url);
  const id = getDriveFileId(original);
  if (!id) {
    return [original];
  }
  const encoded = encodeURIComponent(id);
  const candidates = [
    original,
    `https://drive.google.com/uc?export=view&id=${encoded}`,
    `https://drive.google.com/uc?export=download&id=${encoded}`,
    `https://drive.google.com/thumbnail?id=${encoded}&sz=w1600`,
    `https://lh3.googleusercontent.com/d/${encoded}=w1600`,
    `https://lh3.googleusercontent.com/d/${encoded}=s1600`,
  ];
  return [...new Set(candidates)];
}
