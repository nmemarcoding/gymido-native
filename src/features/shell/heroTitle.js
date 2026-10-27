import { createContext, useContext, useLayoutEffect, useMemo, useState } from 'react';

// RN-SPEC-app-shell §6.1, dated change 27 Oct 2026 (audit b1 X1): every page
// state has EXACTLY ONE heading. The coaching / trainer pages draw their own
// hero title once loaded; while it is on screen the shell header shows no
// title, and in a state that does not draw it (loading, error, not found) the
// header keeps "Coaching". Web mechanism, matched here: the hero title
// registers itself while mounted (HeroTitleMark beside it) with its
// ShellPage, and the header hides its fallback title while any is registered.

const HeroTitleContext = createContext(null);

// ShellPage: the registry its page's hero titles report to, and whether one
// is mounted now.
export function useHeroTitleRegistry() {
  const [count, setCount] = useState(0);
  const registry = useMemo(
    () => ({
      register: () => {
        setCount((value) => value + 1);
        return () => setCount((value) => value - 1);
      },
    }),
    []
  );
  return { registry, heroTitleShown: count > 0 };
}

export const HeroTitleProvider = HeroTitleContext.Provider;

// Rendered next to a page's hero title: registers while mounted (layout
// effect, so the header drops its title before the frame is drawn). Draws
// nothing; outside a ShellPage it does nothing.
export function HeroTitleMark() {
  const registry = useContext(HeroTitleContext);
  useLayoutEffect(() => registry?.register(), [registry]);
  return null;
}
