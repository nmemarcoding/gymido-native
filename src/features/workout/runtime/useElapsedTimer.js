import { useEffect, useState } from 'react';

import { parseTimestamp } from '../../../shared/time/timestamps';

// RN-SPEC-time §7.1: a raw parse of started_at, ticking at once and every
// second; 0 without a start. No catch-up logic.
export default function useElapsedTimer(startedAt) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startedAt) {
      setElapsed(0);
      return undefined;
    }
    // Dated change B (UTC end to end): parsed like every server timestamp, so
    // a zone-less string is read as UTC, never device-local time.
    const startTime = parseTimestamp(startedAt)?.getTime?.() ?? NaN;
    const tick = () => setElapsed(Math.floor((Date.now() - startTime) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);
  return elapsed;
}
