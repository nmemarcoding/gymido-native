import { useEffect, useMemo, useRef, useState } from 'react';
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
// out it renders nothing (as the web leaves an empty well). `onExhausted`
// (optional) fires once after the last candidate fails, so a caller can show
// its own fallback (plans §4.4, S2 only). `sources` (optional, memoised by the
// caller) replaces the default candidate list (the Exercises grid's w400 Drive
// thumbnail first, RN-SPEC-exercises F4); `accessibilityLabel` is the web alt.
// `onLoad` gets the loaded image's size ({ width, height }); `blurRadius` is
// RN Image's (T-146: the rest photo's blurred copy).
export default function RemoteImage({ url, sources: customSources, style, resizeMode = 'cover', onExhausted, accessibilityLabel, fadeDuration, blurRadius, onLoad }) {
  const sources = useMemo(() => customSources ?? getRemoteImageSources(url), [customSources, url]);
  const [state, setState] = useState({ index: 0, attempt: 0, cancels: 0 });
  const exhausted = state.index >= sources.length;
  // Read through a ref so a new callback identity never re-fires it.
  const exhaustedCallback = useRef(onExhausted);
  exhaustedCallback.current = onExhausted;

  useEffect(() => {
    if (exhausted) {
      exhaustedCallback.current?.();
    }
  }, [exhausted]);

  if (exhausted) {
    return null;
  }
  return (
    <Image
      key={`${state.index}-${state.attempt}`}
      source={{ uri: sources[state.index] }}
      resizeMode={resizeMode}
      fadeDuration={fadeDuration}
      blurRadius={blurRadius}
      style={style}
      accessible={Boolean(accessibilityLabel)}
      accessibilityLabel={accessibilityLabel}
      onLoad={onLoad ? (event) => onLoad(event?.nativeEvent?.source ?? null) : undefined}
      onError={(event) => setState((current) => nextImageState(current, event))}
    />
  );
}
