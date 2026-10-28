import { createContext, useContext } from 'react';

// T-86: the gold glow sits ONLY under each screen's one gold primary, never
// under a button inside a dialog or sheet. Every dialog / sheet host (AppModal,
// so ConfirmDialog too; the runtime AlertSheet and SessionDialog; the tablet
// completion card) wraps its content in <NoGlow>, and PillButton reads it.
// PillButton's explicit `glow` prop still wins over the scope.
const NoGlowContext = createContext(false);

export function NoGlow({ children }) {
  return <NoGlowContext.Provider value>{children}</NoGlowContext.Provider>;
}

export function useInNoGlow() {
  return useContext(NoGlowContext);
}
