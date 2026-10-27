import { useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, font, textScale, typography } from '../../shared/theme/tokens';
import GymIcon from './GymIcon';
import { RAIL } from './railMetrics';
import { openShellPath } from './shellLinks';
import { getTabs, isNavItemActive } from './shellRules';
import { closePanel } from './shellUiStore';

// RN-SPEC-v2-foundation §7.2 "Icon rail (tablet 768–1279)" and §3 [O2]
// (tablets use the rail in portrait AND landscape; native keeps it at ≥ 1280).
// 88 wide at the left, full height, outside the page scroll; the gold "G"
// tile on top, then the same items as the phone tab bar (§7.2 "Same items as
// the tab bar"), with the tab bar's active/inactive look and behaviour: the
// active item comes from the current web path (isNavItemActive), a press
// closes the notification panel and opens the tab's root (openShellPath).
// Safe area: the top/bottom insets pad the column and the left inset widens
// it (landscape notch / side nav bar), so items never sit under them.
// Large text (UX §9 "Rail (tablet): the same rule"): labels capped at 1.2;
// above a 1.3 text scale the rail shows icons only, each item keeps its name
// for screen readers, iOS shows it in the Large Content Viewer and Android in
// a long-press label beside the item.
export default function TabletRail({ mode, path }) {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const tabs = getTabs(mode);
  const iconsOnly = fontScale > textScale.iconsOnlyAbove;
  const [tipKey, setTipKey] = useState(null);
  const itemFrames = useRef({});
  const itemsTop = useRef(0);
  const scrollY = useRef(0);
  const [tipTop, setTipTop] = useState(0);
  const tipTab = tabs.find((tab) => tab.key === tipKey);
  const paddingTop = insets.top + RAIL.paddingVertical;

  function showTip(key) {
    const frame = itemFrames.current[key] ?? { y: 0, height: RAIL.itemHeight };
    setTipTop(paddingTop + itemsTop.current + frame.y - scrollY.current + frame.height / 2 - TIP_HEIGHT / 2);
    setTipKey(key);
  }

  return (
    <View
      testID="tablet-rail"
      style={[
        styles.rail,
        {
          width: RAIL.width + insets.left,
          paddingLeft: insets.left,
          paddingTop,
          paddingBottom: insets.bottom + RAIL.paddingVertical,
        },
      ]}
    >
      {/* Short landscape windows: the column scrolls instead of clipping. */}
      <ScrollView
        testID="tablet-rail-scroll"
        bounces={false}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(event) => {
          scrollY.current = event.nativeEvent.contentOffset.y;
        }}
        contentContainerStyle={styles.scrollContent}
      >
        <View testID="tablet-rail-mark" accessible accessibilityRole="image" accessibilityLabel="Gymido" style={styles.mark}>
          <Text allowFontScaling={false} style={styles.markText}>
            G
          </Text>
        </View>
        <View
          accessibilityRole="tablist"
          style={styles.items}
          onLayout={(event) => {
            itemsTop.current = event.nativeEvent.layout.y;
          }}
        >
          {tabs.map((tab) => {
            const active = isNavItemActive(tab, path);
            return (
              <Pressable
                // Remounted on a new text scale (QA F1, iOS stale text layout; see ShellPage).
                key={`${tab.key}-${fontScale}`}
                testID={`rail-${tab.key}`}
                accessibilityRole="tab"
                accessibilityLabel={tab.label}
                accessibilityState={{ selected: active }}
                accessibilityShowsLargeContentViewer={iconsOnly}
                accessibilityLargeContentTitle={tab.label}
                onLayout={(event) => {
                  const { y, height } = event.nativeEvent.layout;
                  itemFrames.current[tab.key] = { y, height };
                }}
                onPress={() => {
                  closePanel();
                  openShellPath(tab.path);
                }}
                onLongPress={iconsOnly && Platform.OS === 'android' ? () => showTip(tab.key) : undefined}
                onPressOut={() => setTipKey(null)}
                style={({ pressed }) => [styles.item, active && styles.itemActive, !active && pressed && styles.itemPressed]}
              >
                {({ pressed }) => {
                  const color = active ? colors.gold : pressed ? colors.textPrimary : colors.textMuted;
                  return (
                    <>
                      <GymIcon name={tab.icon} size={RAIL.iconSize} color={color} />
                      {iconsOnly ? null : (
                        <Text
                          numberOfLines={1}
                          maxFontSizeMultiplier={textScale.tabLabel}
                          style={[styles.label, active && styles.labelActive, { color }]}
                        >
                          {tab.label}
                        </Text>
                      )}
                    </>
                  );
                }}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      {iconsOnly && tipTab ? (
        <View testID="tablet-rail-tip" pointerEvents="none" style={[styles.tip, { top: tipTop, left: RAIL.width + insets.left + 8 }]}>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.tipText}>
            {tipTab.label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const TIP_HEIGHT = 32;

const styles = StyleSheet.create({
  // §7.2 color-surface + a 1 px hairline; drawn as the boards' full-height
  // column (border on the content side). zIndex: the Android label draws over the content.
  rail: {
    flexShrink: 0,
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.hairline,
    zIndex: 1,
  },
  scrollContent: {
    alignItems: 'center',
  },
  mark: {
    width: RAIL.markSize,
    height: RAIL.markSize,
    borderRadius: RAIL.markRadius,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: RAIL.markGap,
  },
  markText: {
    ...font(700),
    fontSize: 22,
    lineHeight: 26,
    color: colors.onGold,
  },
  items: {
    alignItems: 'center',
    gap: RAIL.itemGap,
  },
  item: {
    width: RAIL.itemWidth,
    minHeight: RAIL.itemHeight,
    paddingHorizontal: 2,
    paddingVertical: 6,
    borderRadius: RAIL.itemRadius,
    alignItems: 'center',
    justifyContent: 'center',
    gap: RAIL.labelGap,
  },
  itemActive: {
    backgroundColor: colors.goldTintTab,
  },
  itemPressed: {
    backgroundColor: colors.fillChip,
  },
  // 11 px label (micro): 500 inactive, 600 active (as the tab bar).
  label: {
    ...typography.micro,
    width: '100%',
    textAlign: 'center',
  },
  labelActive: font(600),
  // Android's long-press label: a chip beside the held item.
  tip: {
    position: 'absolute',
    minHeight: TIP_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.glassSolid,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  // QA BUG-N1: the full name at any text size, never ellipsized; the label
  // keeps its text width and the chip grows around it.
  tipText: {
    ...typography.label,
    color: colors.textPrimary,
    flexShrink: 0,
  },
});
