import { preferences } from '../../shared/storage/preferences';
import { Workspace } from './workspace';

const WORKSPACE_KEY = 'gymido-mode';

// Survives logout on purpose; only an interactive trainer login resets it.
export function getWorkspace() {
  return preferences.getString(WORKSPACE_KEY) === Workspace.trainer ? Workspace.trainer : Workspace.member;
}

export function setWorkspace(workspace) {
  preferences.set(WORKSPACE_KEY, workspace);
}
