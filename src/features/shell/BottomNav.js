import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GlassSurface from '../../shared/components/GlassSurface';
import { colors, font, textScale, typography } from '../../shared/theme/tokens';
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
// Large text (UX §9): labels scale at most 1.2×; above a 1.3 text scale the
// bar shows icons only (same bar), each tab keeps its name for screen readers,
// iOS shows it in the Large Content Viewer and Android in a long-press label.
export default function BottomNav({ mode, path }) {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const tabs = getTabs(mode);
  const iconsOnly = fontScale > textScale.iconsOnlyAbove;
  const [tipKey, setTipKey] = useState(null);
  const [wrapWidth, setWrapWidth] = useState(0);
  const [tipWidth, setTipWidth] = useState(0);
  const tipIndex = tabs.findIndex((tab) => tab.key === tipKey);

  return (
    <View
      testID="bottom-nav"
      pointerEvents="box-none"
      onLayout={(event) => setWrapWidth(event.nativeEvent.layout.width)}
      style={[
        styles.wrap,
        {
          left: TAB_BAR.sideInset + insets.left,
          right: TAB_BAR.sideInset + insets.right,
          bottom: TAB_BAR.bottomGap + insets.bottom,
        },
      ]}
    >
      {iconsOnly && tipIndex >= 0 ? (
        <View
          testID="bottom-nav-tip"
          pointerEvents="none"
          onLayout={(event) => setTipWidth(event.nativeEvent.layout.width)}
          style={[styles.tip, { left: tipLeft(tipIndex, tabs.length, wrapWidth, tipWidth), opacity: tipWidth ? 1 : 0 }]}
        >
          <Text maxFontSizeMultiplier={textScale.body} numberOfLines={1} style={styles.tipText}>
            {tabs[tipIndex].label}
          </Text>
        </View>
      ) : null}
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
              accessibilityShowsLargeContentViewer={iconsOnly}
              accessibilityLargeContentTitle={tab.label}
              onPress={() => {
                closePanel();
                openShellPath(tab.path);
              }}
              onLongPress={iconsOnly && Platform.OS === 'android' ? () => setTipKey(tab.key) : undefined}
              onPressOut={() => setTipKey(null)}
              style={({ pressed }) => [styles.item, active && styles.itemActive, !active && pressed && styles.itemPressed]}
            >
              {({ pressed }) => {
                const color = active ? colors.gold : pressed ? colors.textPrimary : colors.textMuted;
                return (
                  <>
                    <GymIcon name={tab.icon} size={22} color={color} />
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
      </GlassSurface>
    </View>
  );
}

// The long-press label's left edge in the wrapper: centred over tab `index`
// of the (centred, max 398) bar, kept inside the bar.
export function tipLeft(index, count, wrapWidth, tipWidth) {
  const barWidth = Math.min(wrapWidth, TAB_BAR.maxWidth);
  const offset = (wrapWidth - barWidth) / 2;
  const slot = (barWidth - TAB_BAR.padding * 2 - TAB_BAR.itemGap * (count - 1)) / count;
  const centre = offset + TAB_BAR.padding + index * (slot + TAB_BAR.itemGap) + slot / 2;
  return Math.max(offset, Math.min(centre - tipWidth / 2, offset + barWidth - tipWidth));
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
  // Android's long-press label: a chip centred above the held tab.
  tip: {
    position: 'absolute',
    bottom: TAB_BAR.height + 8,
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.glassSolid,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  tipText: {
    ...typography.label,
    color: colors.textPrimary,
    textAlign: 'center',
  },
});
