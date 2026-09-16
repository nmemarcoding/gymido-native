import { getPreference, setPreference } from '../../shared/storage/preferences';
import { Workspace } from './workspace';

const WORKSPACE_KEY = 'gymido-mode';

// Storage is async, but the landing rules need the value synchronously, so the
// last loaded value is cached here and kept in the auth store.
let cachedWorkspace = Workspace.member;

function normalise(value) {
  return value === Workspace.trainer ? Workspace.trainer : Workspace.member;
}

// Survives logout on purpose; only an interactive trainer login resets it.
export async function loadWorkspace() {
  cachedWorkspace = normalise(await getPreference(WORKSPACE_KEY));
  return cachedWorkspace;
}

export function getCachedWorkspace() {
  return cachedWorkspace;
}

export async function setWorkspace(workspace) {
  cachedWorkspace = normalise(workspace);
  await setPreference(WORKSPACE_KEY, cachedWorkspace);
}
