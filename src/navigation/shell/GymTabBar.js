import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../../shared/theme/tokens';
import LibraryIcon from './LibraryIcon';
import { useLayoutMetrics } from './layoutMetrics';
import { MEMBER_TABS } from './tabs';

// STUB values, pending docs/RN-SPEC-app-shell.md: item padding, row gap,
// label line-height, the inner max width and the backdrop blur (the 95%
// surface stands in for it).
const STUB_ITEM_PADDING_Y = 6;
const STUB_LABEL_LINE_HEIGHT = 14;

// Bottom nav (RN-SPEC-plans §1.3). Drawn over the content, which keeps 112px
// of bottom padding. Per the owner, the bar sits above the home-indicator
// inset with the web's 16px padding on top of it. Hidden at ≥768pt, where the
// desktop sidebar takes its place.
export default function GymTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  const { isDesktop } = useLayoutMetrics();

  if (isDesktop) {
    return null;
  }

  return (
    <View
      testID="tab-bar"
      style={[
        styles.bar,
        { paddingBottom: 16 + insets.bottom, paddingLeft: insets.left, paddingRight: insets.right },
      ]}
    >
      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const tab = MEMBER_TABS.find((item) => item.name === route.name);
          const isFocused = state.index === index;
          const color = isFocused ? colors.brand700 : colors.textMuted;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              testID={`tab-${route.name}`}
              accessibilityRole="tab"
              accessibilityLabel={tab?.label}
              accessibilityState={{ selected: isFocused }}
              onPress={onPress}
              style={[styles.item, isFocused && styles.itemActive]}
            >
              <View style={styles.icon}>{tab?.icon === 'library' ? <LibraryIcon color={color} /> : null}</View>
              <Text numberOfLines={1} style={[styles.label, { color }]}>
                {tab?.label}
              </Text>
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
    backgroundColor: colors.tabBar,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  row: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    paddingHorizontal: 8,
    gap: 2,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: STUB_ITEM_PADDING_Y,
    borderRadius: 20,
  },
  itemActive: {
    backgroundColor: colors.brand50,
  },
  icon: {
    width: 24,
    height: 24,
  },
  label: {
    fontSize: 10,
    lineHeight: STUB_LABEL_LINE_HEIGHT,
    fontWeight: '700',
    letterSpacing: -0.25,
    textTransform: 'uppercase',
  },
});
