import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GlassSurface from '../../shared/components/GlassSurface';
import { colors, font, typography } from '../../shared/theme/tokens';
import GymIcon from './GymIcon';
import { openShellPath } from './shellLinks';
import { getTabs, isNavItemActive } from './shellRules';
import { closePanel } from './shellUiStore';
import { TAB_BAR } from './tabBarMetrics';

// App-shell spec §6.3 (phones, < 768), v2 look RN-SPEC-v2-foundation §7.1:
// a floating glass pill inset 16 from the sides and 20 above the bottom safe
// area (both orientations: the insets include left/right). Active state comes
// from the current web path, not React Navigation's focused tab. A tab press
// closes the notification panel and opens the tab's root.
export default function BottomNav({ mode, path }) {
  const insets = useSafeAreaInsets();
  const tabs = getTabs(mode);

  return (
    <View
      testID="bottom-nav"
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          left: TAB_BAR.sideInset + insets.left,
          right: TAB_BAR.sideInset + insets.right,
          bottom: TAB_BAR.bottomGap + insets.bottom,
        },
      ]}
    >
      <GlassSurface testID="bottom-nav-bar" radius={TAB_BAR.radius} style={styles.bar}>
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
              style={({ pressed }) => [styles.item, active && styles.itemActive, !active && pressed && styles.itemPressed]}
            >
              {({ pressed }) => {
                const color = active ? colors.gold : pressed ? colors.textPrimary : colors.textMuted;
                return (
                  <>
                    <GymIcon name={tab.icon} size={22} color={color} />
                    <Text
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      style={[styles.label, active && styles.labelActive, { color }]}
                    >
                      {tab.label}
                    </Text>
                  </>
                );
              }}
            </Pressable>
          );
        })}
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    alignItems: 'center',
  },
  bar: {
    width: '100%',
    maxWidth: TAB_BAR.maxWidth,
    height: TAB_BAR.height,
    padding: TAB_BAR.padding,
    flexDirection: 'row',
    gap: TAB_BAR.itemGap,
  },
  item: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 2,
    borderRadius: TAB_BAR.itemRadius,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  itemActive: {
    backgroundColor: colors.goldTintTab,
  },
  itemPressed: {
    backgroundColor: colors.fillChip,
  },
  // 11 px label (micro): 500 inactive, 600 active.
  label: {
    ...typography.micro,
    width: '100%',
    textAlign: 'center',
  },
  labelActive: font(600),
});
