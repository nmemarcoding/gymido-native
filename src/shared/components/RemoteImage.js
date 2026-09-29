import { useEffect, useMemo, useState } from 'react';
import { Image } from 'react-native';

import { getDriveImageCandidates } from '../utils/images';

// The web's RemoteImage (RN-SPEC-workout §19.7): walk the Drive candidate list,
// advancing on each load error, and send no referrer — Drive rejects requests
// that carry one.
//
// `onExhausted` fires when every candidate has failed, so a caller can tell
// "this URL does not work" from "there was never a URL". The two mean different
// things in the sheet's fallbacks: a missing URL shows the position number, a
// failing one deliberately does not (§19.7 (b)).
export default function RemoteImage({ uri, onExhausted, style, resizeMode = 'cover', ...rest }) {
  const candidates = useMemo(() => getDriveImageCandidates(uri), [uri]);
  const [index, setIndex] = useState(0);

  // A new URL restarts the walk.
  useEffect(() => {
    setIndex(0);
  }, [uri]);

  const source = candidates[index];
  if (!source) {
    return null;
  }

  return (
    <Image
      {...rest}
      source={{ uri: source, headers: { Referer: '' } }}
      resizeMode={resizeMode}
      style={style}
      onError={() => {
        if (index + 1 < candidates.length) {
          setIndex(index + 1);
          return;
        }
        onExhausted?.();
      }}
    />
  );
}
