import SegmentedSwitch from '../../shared/components/SegmentedSwitch';
import { useAuthStore } from '../auth/authStore';
import { Workspace } from '../workspace/workspace';
import { openShellPath } from './shellLinks';
import { WORKSPACE_HOME, isTrainerUser } from './shellRules';
import { saveWorkspacePreference } from './shellUiStore';

const SEGMENTS = [
  { value: Workspace.member, label: 'Personal', testID: `mode-switch-${Workspace.member}` },
  { value: Workspace.trainer, label: 'Trainer', testID: `mode-switch-${Workspace.trainer}` },
];

// App-shell spec §6.2. Only trainers see it. Switching saves the preference
// and opens that workspace's home (a push, ⚠S14). v2 (RN-SPEC-v2-foundation
// §4.7, §7.5): restyled as the segmented switch, 120 per segment, with a
// white selected segment; it stays where v1 puts it until Phase 5.
export const MODE_SEGMENT_WIDTH = 120;

export default function ModeSwitch({ mode }) {
  const user = useAuthStore((state) => state.user);
  if (!isTrainerUser(user)) {
    return null;
  }

  return (
    <SegmentedSwitch
      accessibilityLabel="Workspace"
      segments={SEGMENTS}
      value={mode}
      segmentWidth={MODE_SEGMENT_WIDTH}
      onChange={(next) => {
        if (next === mode) {
          return;
        }
        saveWorkspacePreference(next);
        openShellPath(WORKSPACE_HOME[next]);
      }}
    />
  );
}
