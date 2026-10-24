import { useEffect, useState } from 'react';

import { getGeneratorProfile } from './api/generatorApi';

// §G-E / ⚠G-1: one GET /plan-generator/profile per mount. True only for a
// 200 with `available === true`; unavailable, 403 and any error stay false
// with no message. Hosts remount it on every focus (S1 already remounts its
// body via useFocusRemountKey), so this costs one call per focus.
export function useGeneratorAvailable() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let alive = true;
    getGeneratorProfile()
      .then((result) => {
        if (alive) {
          setAvailable(result?.available === true);
        }
      })
      .catch(() => {
        if (alive) {
          setAvailable(false);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  return available;
}
