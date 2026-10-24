import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BlurLayer from '../../shared/components/BlurLayer';
import { colors, radii } from '../../shared/theme/tokens';
import GymIcon from './GymIcon';
import { openShellPath } from './shellLinks';
import { getTabs, isNavItemActive } from './shellRules';
import { closePanel } from './shellUiStore';

// App-shell spec §6.3 (phones, < 768). Active state comes from the current
// web path, not React Navigation's focused tab. A tab press closes the
// notification panel and opens the tab's root.
export default function BottomNav({ mode, path }) {
  const insets = useSafeAreaInsets();
  const tabs = getTabs(mode);
  const compact = tabs.length > 4;

  return (
    <View testID="bottom-nav" style={styles.bar}>
      <BlurLayer blurPx={8} />
      <View style={styles.veil} />
      <View
        style={[
          styles.grid,
          compact ? styles.gridCompact : styles.gridRoomy,
          { paddingBottom: 16 + insets.bottom },
        ]}
      >
        {tabs.map((tab) => {
          const active = isNavItemActive(tab, path);
          return (
            <Pressable
              key={tab.key}
              testID={`tab-${tab.key}`}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: active }}
              onPress={() => {
                closePanel();
                openShellPath(tab.path);
              }}
              style={({ pressed }) => [
                styles.item,
                compact ? styles.itemCompact : styles.itemRoomy,
                active && styles.itemActive,
                !active && pressed && styles.itemPressed,
              ]}
            >
              {({ pressed }) => {
                const color = active ? colors.brand700 : pressed ? colors.textPrimary : colors.textMuted;
                return (
                  <>
                    <GymIcon name={tab.icon} size={compact ? 24 : 28} color={color} />
                    <Text
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      style={[styles.label, compact ? styles.labelCompact : styles.labelRoomy, { color }]}
                    >
                      {tab.label}
                    </Text>
                  </>
                );
              }}
            </Pressable>
          );
        })}
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
  },
  veil: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  grid: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    flexDirection: 'row',
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
    minWidth: 0,
    minHeight: 56,
    paddingVertical: 4,
    borderRadius: radii.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
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
  // Batch A (A2, 23 Oct): sentence case, weight 600, tracking 0.
  label: {
    width: '100%',
    textAlign: 'center',
    fontWeight: '600',
  },
  labelCompact: {
    fontSize: 11,
    lineHeight: 14,
  },
  labelRoomy: {
    fontSize: 12,
    lineHeight: 16,
  },
});
