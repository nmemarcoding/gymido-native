import { BlurView } from 'expo-blur';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useWorkoutSessionStore } from '../../features/workout/workoutSessionStore';
import { useResolvedMode } from '../../features/workspace/useWorkspaceMode';
import { Workspace } from '../../features/workspace/workspace';
import { colors } from '../../shared/theme/tokens';
import GymIcon from './GymIcon';
import { useLayoutMetrics } from './layoutMetrics';
import { openTab } from './shellNavigation';
import { focusedRoute, isActivePath, pathForRoute, tabsForMode } from './shellRules';

function TabItem({ tab, active, compact, onPress }) {
  const [pressed, setPressed] = useState(false);
  const color = active ? colors.brand700 : pressed ? colors.textPrimary : colors.textMuted;
  return (
    <Pressable
      testID={`tab-${tab.route}`}
      accessibilityRole="tab"
      accessibilityLabel={tab.label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        styles.item,
        compact ? styles.itemCompact : styles.itemRoomy,
        active ? styles.itemActive : pressed ? styles.itemPressed : null,
      ]}
    >
      <GymIcon name={tab.icon} size={compact ? 24 : 28} color={color} />
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={[styles.label, compact ? styles.labelCompact : styles.labelRoomy, { color }]}
      >
        {tab.label}
      </Text>
    </Pressable>
  );
}

// BottomNav (RN-SPEC-app-shell §6.3). The tab set and the active tab come from
// the current screen's path and its resolved mode (§5), not from the focused
// navigator branch. Hidden at ≥768 (the sidebar replaces it) and during an
// active workout session. [O2] bottom padding = 16 + the bottom inset.
export default function GymTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  const { isDesktop } = useLayoutMetrics();
  const sessionActive = useWorkoutSessionStore((store) => store.isSessionActive);
  const path = pathForRoute(focusedRoute(state));
  const { mode } = useResolvedMode(path);

  if (isDesktop || sessionActive) {
    return null;
  }

  const tabs = tabsForMode(mode);
  const compact = mode === Workspace.member;

  return (
    <View testID="tab-bar" style={[styles.bar, { paddingLeft: insets.left, paddingRight: insets.right }]}>
      {/* §11: an 8px backdrop blur under 95% white. */}
      <BlurView
        tint="light"
        intensity={20}
        experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, styles.veil]} />
      <View
        testID="tab-bar-grid"
        style={[
          styles.grid,
          compact ? styles.gridCompact : styles.gridRoomy,
          { paddingBottom: 16 + insets.bottom },
        ]}
      >
        {tabs.map((tab) => (
          <TabItem
            key={tab.route}
            tab={tab}
            compact={compact}
            active={isActivePath(path, tab.path, tab.exact)}
            onPress={() => openTab(navigation, tab.route)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    overflow: 'hidden',
  },
  veil: {
    backgroundColor: colors.tabBar,
  },
  grid: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    paddingTop: 12,
  },
  gridCompact: {
    gap: 2,
    paddingHorizontal: 4,
  },
  gridRoomy: {
    gap: 4,
    paddingHorizontal: 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 56,
    paddingVertical: 4,
    borderRadius: 20,
  },
  itemCompact: {
    paddingHorizontal: 2,
  },
  itemRoomy: {
    paddingHorizontal: 4,
  },
  itemActive: {
    backgroundColor: colors.brand50,
  },
  itemPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  label: {
    width: '100%',
    textAlign: 'center',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  labelCompact: {
    fontSize: 10,
    letterSpacing: -0.25,
  },
  labelRoomy: {
    fontSize: 11,
    letterSpacing: 0.275,
  },
});
