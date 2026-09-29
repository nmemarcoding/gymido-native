import { resolveMode } from '../../navigation/shell/shellRules';
import { useAuthStore } from '../auth/authStore';
import { setWorkspace } from './workspacePreference';

// Saves the "gymido-mode" preference and mirrors it into the auth store so the
// chrome re-renders (RN-SPEC-app-shell §5).
export async function saveWorkspacePreference(mode) {
  useAuthStore.setState({ workspace: mode });
  await setWorkspace(mode);
}

// The resolved mode for `path`, evaluated on every render from the live user
// and preference, never cached (§2, §5).
export function useResolvedMode(path) {
  const user = useAuthStore((state) => state.user);
  const preference = useAuthStore((state) => state.workspace);
  return { mode: resolveMode(user, path, preference), user };
}
