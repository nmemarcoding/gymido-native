import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '../../shared/theme/tokens';
import { useAuthStore } from '../auth/authStore';
import { Workspace } from '../workspace/workspace';
import { openShellPath } from './shellLinks';
import { WORKSPACE_HOME, isTrainerUser } from './shellRules';
import { saveWorkspacePreference } from './shellUiStore';

const SEGMENTS = [
  { mode: Workspace.member, label: 'Personal' },
  { mode: Workspace.trainer, label: 'Trainer' },
];

// App-shell spec §6.2. Only trainers see it. Switching saves the preference
// and opens that workspace's home (a push, ⚠S14).
export default function ModeSwitch({ mode }) {
  const user = useAuthStore((state) => state.user);
  if (!isTrainerUser(user)) {
    return null;
  }

  return (
    <View accessibilityLabel="Workspace" style={styles.group}>
      {SEGMENTS.map((segment) => {
        const active = segment.mode === mode;
        return (
          <Pressable
            key={segment.mode}
            testID={`mode-switch-${segment.mode}`}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (active) {
                return;
              }
              saveWorkspacePreference(segment.mode);
              openShellPath(WORKSPACE_HOME[segment.mode]);
            }}
            style={[styles.segment, active && styles.segmentActive]}
          >
            {({ pressed }) => (
              <Text style={[styles.label, active ? styles.labelActive : pressed && styles.labelPressed]}>
                {segment.label}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: 4,
  },
  segment: {
    // Design system v1 #16: the touch minimum.
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'transparent',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: colors.brand50,
    borderColor: colors.brandActiveBorder,
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  labelActive: {
    color: colors.brand700,
  },
  labelPressed: {
    color: colors.textPrimary,
  },
});
