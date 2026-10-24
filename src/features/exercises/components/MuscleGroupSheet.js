import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { colors, radii } from '../../../shared/theme/tokens';
import { countFor } from '../exercisesCatalog';

const SHEET_EASE = Easing.bezier(0.22, 1, 0.36, 1);
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1);

// RN-SPEC-exercises §E2 "Muscle group" bottom sheet. Opens over everything
// (its own Modal window, above the tab bar). No drag-to-dismiss (⚠E-8):
// it closes via the scrim, "Close", an option or Android back.
export default function MuscleGroupSheet({ open, categories, categoryCounts, total, value, onSelect, onClose }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(0)).current;
  // translateY 100% → 0 of the sheet's own height, so wait for its layout.
  const [sheetHeight, setSheetHeight] = useState(0);

  useEffect(() => {
    if (!open) {
      fade.setValue(0);
      slide.setValue(0);
      return undefined;
    }
    if (reducedMotion) {
      fade.setValue(1);
      slide.setValue(1);
      return undefined;
    }
    if (!sheetHeight) {
      return undefined;
    }
    const animation = Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 240, easing: EASE_OUT, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 1, duration: 320, easing: SHEET_EASE, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
    // Only (re)start when the sheet opens or is first measured.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reducedMotion, sheetHeight > 0]);

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [sheetHeight || height, 0] });
  const options = [{ value: '', label: 'All muscle groups', count: total }].concat(
    categories.map((category) => ({ value: category, label: category, count: countFor(categoryCounts, category) }))
  );

  return (
    <Modal transparent visible={open} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
        <Pressable
          testID="muscle-sheet-scrim"
          style={[StyleSheet.absoluteFill, styles.scrim]}
          onPress={onClose}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </Animated.View>
      <View pointerEvents="box-none" style={styles.host}>
        <Animated.View
          testID="muscle-sheet"
          role="dialog"
          accessibilityViewIsModal
          accessibilityLabel="Filter by muscle group"
          onLayout={(event) => setSheetHeight(event.nativeEvent.layout.height)}
          style={[styles.sheet, { maxHeight: height * 0.75, transform: [{ translateY }] }]}
        >
          <ScrollView bounces={false} contentContainerStyle={[styles.content, { paddingBottom: Math.max(24, insets.bottom) }]}>
            <View style={styles.handle} accessibilityElementsHidden importantForAccessibility="no" />
            <View style={styles.titleRow}>
              <Text textBreakStrategy="simple" accessibilityRole="header" style={styles.title}>
                Muscle group
              </Text>
              <Pressable testID="muscle-sheet-close" accessibilityRole="button" onPress={onClose} hitSlop={12}>
                <Text style={styles.close}>Close</Text>
              </Pressable>
            </View>
            <View style={styles.options}>
              {options.map((option) => {
                const active = option.value === value;
                return (
                  <Pressable
                    key={option.value || '__all__'}
                    testID={`muscle-sheet-option-${option.value || 'all'}`}
                    accessibilityRole="togglebutton"
                    accessibilityState={{ checked: active }}
                    onPress={() => onSelect(option.value)}
                    style={({ pressed }) => [
                      styles.option,
                      active ? styles.optionActive : pressed ? styles.optionPressed : null,
                    ]}
                  >
                    <Text numberOfLines={1} style={styles.optionLabel}>
                      {option.label}
                    </Text>
                    <View style={styles.optionRight}>
                      <Text style={styles.optionCount}>{option.count}</Text>
                      {active ? (
                        <View style={styles.check}>
                          <Text numberOfLines={1} textBreakStrategy="simple" style={styles.checkText}>✓</Text>
                        </View>
                      ) : (
                        <View style={styles.checkSpacer} />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    backgroundColor: 'rgba(17, 24, 39, 0.40)',
  },
  host: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    overflow: 'hidden',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: colors.surface,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 48,
    height: 6,
    marginBottom: 16,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceMuted,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  close: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.textMuted,
  },
  options: {
    gap: 6,
  },
  option: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  optionPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  optionActive: {
    borderColor: colors.brand400,
    backgroundColor: colors.brand50,
  },
  optionLabel: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  optionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionCount: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: colors.textMuted,
  },
  check: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
    backgroundColor: colors.brand400,
  },
  checkText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    color: colors.navy,
  },
  checkSpacer: {
    width: 20,
    height: 20,
  },
});
