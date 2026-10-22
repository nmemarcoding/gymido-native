import { useMemo, useState } from 'react';
import { Image } from 'react-native';

import { getRemoteImageSources } from '../images/remoteImageSources';

const MAX_CANCEL_RETRIES = 2;

// A cancelled load (the view was torn down or re-laid out mid-request, which
// iOS reports through onError) is not a failure.
export function isCancelledLoad(event) {
  const message = String(event?.nativeEvent?.error ?? '');
  return /cancel/i.test(message);
}

// Next state after a load error. Only a real failure moves to the next
// candidate; a cancel restarts the current one (workout spec "RemoteImage",
// trainer plans §A7.3).
export function nextImageState(state, event) {
  if (isCancelledLoad(event) && state.cancels < MAX_CANCEL_RETRIES) {
    return { index: state.index, attempt: state.attempt + 1, cancels: state.cancels + 1 };
  }
  return { index: state.index + 1, attempt: state.attempt, cancels: 0 };
}

// Remote image with the Google-Drive fallback chain; once the candidates run
// out it renders nothing (as the web leaves an empty well).
export default function RemoteImage({ url, style, resizeMode = 'cover' }) {
  const sources = useMemo(() => getRemoteImageSources(url), [url]);
  const [state, setState] = useState({ index: 0, attempt: 0, cancels: 0 });

  if (state.index >= sources.length) {
    return null;
  }
  return (
    <Image
      key={`${state.index}-${state.attempt}`}
      source={{ uri: sources[state.index] }}
      resizeMode={resizeMode}
      style={style}
      onError={(event) => setState((current) => nextImageState(current, event))}
    />
  );
}
