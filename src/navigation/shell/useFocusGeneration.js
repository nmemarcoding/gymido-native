import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';

// RN-SPEC-plans §8.1: the web mounts S1/S2 fresh on every visit. Each focus
// bumps `generation`; screens key their content on it so every local state
// resets and the load reruns. `isCurrent(gen)` is false once the screen blurs
// or refocuses, so late responses from an earlier focus are dropped.
// generation 0 means "not focused yet"; render the loading state for it.
export function useFocusGeneration() {
  const [generation, setGeneration] = useState(0);
  const counter = useRef(0);
  const active = useRef(0);

  useFocusEffect(
    useCallback(() => {
      counter.current += 1;
      active.current = counter.current;
      setGeneration(counter.current);
      return () => {
        active.current = -1;
      };
    }, [])
  );

  const isCurrent = useCallback((gen) => active.current === gen, []);
  return { generation, isCurrent };
}
