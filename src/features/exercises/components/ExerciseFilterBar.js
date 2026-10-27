import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import FeedbackIcon from '../../../shared/components/FeedbackIcon';
import { CAP_BODY, CAP_PILL, LINE_TEXT, TITLE_TEXT, useLargeTextReflow } from '../../../shared/components/largeText';
import PillButton from '../../../shared/components/PillButton';
import { colors, font, radii, spacing } from '../../../shared/theme/tokens';
import { filterButtonLabel, filtersA11yLabel } from '../exerciseFilters';

// Dated change (27 Oct 2026, owner T-62; UX T62 §2–§3, §6): the Exercises
// toolbar's Filter button, the active filter line under the toolbar and the
// no-match state. They replace the sideways muscle chip row and the trailing
// "All muscle groups ▾" chip.

// §2 Filter button, same height as the search field (52; 56 at 768–1279),
// radius full, 18 filter icon, 15/600. Off: glass, "Filter". On (≥ 1 filter):
// gold tint + gold line, gold text and icon; the one set value, or
// "Filter · 2" with both. The a11y name lists the values ("Filters: none").
// Large text: the label drops and the icon stays (the name keeps the label).
export function FilterButton({ values, open, onPress, tablet, tall, hideLabel, ref }) {
  const on = values.length > 0;
  const ink = on ? colors.gold : colors.textPrimary;
  return (
    <Pressable
      ref={ref}
      testID="exercises-filter"
      accessibilityRole="button"
      accessibilityLabel={filtersA11yLabel(values)}
      accessibilityHint="Opens the filters"
      accessibilityState={{ expanded: open }}
      onPress={onPress}
      style={[styles.filter, tall && styles.filterTall, tablet ? styles.filterTablet : styles.filterPhone, on ? styles.filterOn : styles.filterOff]}
    >
      {({ pressed }) => (
        <>
          {pressed ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pressOverlay]} /> : null}
          <View testID="exercises-filter-icon" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M4 6h16M7 12h10M10 18h4" stroke={ink} strokeWidth={2.2} strokeLinecap="round" />
            </Svg>
          </View>
          {hideLabel ? null : (
            <Text {...CAP_PILL} testID="exercises-filter-label" numberOfLines={1} ellipsizeMode="tail" style={[styles.filterLabel, { color: ink }]}>
              {filterButtonLabel(values)}
            </Text>
          )}
        </>
      )}
    </Pressable>
  );
}

// §3 Active filter line (wraps, gap 8): the results count, then one gold
// chip per set filter (Muscle, then Equipment) with a × (44 hit, "Remove
// filter {value}"), then "Clear all" when 2+ of {muscle, equipment, search}
// are set. The search is not a chip. The count is NOT a live region here: the
// screen announces it once per change (once per submit for a search).
export function ActiveFilterLine({ countText, emphasized, chips, onRemove, showClearAll, onClearAll, chipRefs, style }) {
  return (
    <View testID="exercises-active-line" style={[styles.line, style]}>
      {countText ? (
        <Text {...CAP_BODY} testID="exercises-result-count" style={emphasized ? styles.countOn : styles.count}>
          {countText}
        </Text>
      ) : null}
      {chips.map((chip) => (
        <View key={chip.facet} testID={`exercises-active-chip-${chip.facet}`} style={styles.chip}>
          <Text {...LINE_TEXT} style={styles.chipText}>
            {chip.value}
          </Text>
          <Pressable
            ref={(node) => {
              if (chipRefs) {
                chipRefs.current[chip.facet] = node;
              }
            }}
            testID={`exercises-active-chip-remove-${chip.facet}`}
            accessibilityRole="button"
            accessibilityLabel={`Remove filter ${chip.value}`}
            hitSlop={7}
            onPress={() => onRemove(chip.facet)}
            style={({ pressed }) => [styles.chipRemove, pressed && styles.chipRemovePressed]}
          >
            <FeedbackIcon name="close" size={14} color={colors.gold} />
          </Pressable>
        </View>
      ))}
      {showClearAll ? (
        <Pressable testID="exercises-clear-all" accessibilityRole="button" hitSlop={{ top: 4, bottom: 4 }} onPress={onClearAll} style={styles.clearAll}>
          <Text {...CAP_BODY} style={styles.clearAllText}>
            Clear all
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// §6 No match (any filter or search, 0 results): centred, 64 tile with a
// search glyph, the code's title, the body from noMatchMessage, then "Clear
// filters" (glass 44) and, with a muscle/equipment AND a search, "Search all
// exercises" (ghost 44). No gold. Nothing set (an empty catalog): no actions.
export function NoMatchState({ message, showClear, showSearchAll, onClearFilters, onSearchAll }) {
  const stacked = useLargeTextReflow();
  return (
    <View testID="exercises-no-match" style={styles.empty}>
      <View testID="exercises-no-match-tile" style={styles.emptyTile} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
          <Path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4" stroke={colors.textSecondary} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>
      <Text {...TITLE_TEXT} accessibilityRole="header" style={styles.emptyTitle}>
        No exercises found
      </Text>
      <Text {...CAP_BODY} style={styles.emptyBody}>
        {message}
      </Text>
      {showClear || showSearchAll ? (
        <View style={[styles.emptyActions, stacked && styles.emptyActionsStacked]}>
          {showClear ? (
            <PillButton testID="exercises-clear-filters" title="Clear filters" variant="secondary" size="compact" fullWidth={stacked} onPress={onClearFilters} />
          ) : null}
          {showSearchAll ? (
            <PillButton testID="exercises-search-all" title="Search all exercises" variant="ghost" size="compact" fullWidth={stacked} onPress={onSearchAll} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  filter: {
    minHeight: 52,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    overflow: 'hidden',
    borderRadius: radii.full,
    borderWidth: 1,
    paddingHorizontal: spacing[4],
  },
  filterTall: {
    minHeight: 56,
  },
  filterPhone: {
    maxWidth: 160,
  },
  filterTablet: {
    maxWidth: 220,
  },
  filterOff: {
    backgroundColor: colors.fillButton,
    borderColor: colors.hairlineButton,
  },
  filterOn: {
    backgroundColor: colors.goldTint,
    borderColor: colors.goldLine,
  },
  filterLabel: {
    ...font(600),
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 20,
  },
  pressOverlay: {
    backgroundColor: colors.pressOverlay,
  },
  line: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing[2],
    minHeight: 38,
    paddingHorizontal: spacing[1],
  },
  count: {
    ...font(400),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  countOn: {
    ...font(600),
    fontSize: 15,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  // §3 chip: 38 tall, padding 0 6 0 14, gold tint, gold 14/600 text.
  chip: {
    minHeight: 38,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['0_5'],
    borderRadius: radii.full,
    backgroundColor: colors.goldTint,
    paddingLeft: 14,
    paddingRight: 6,
  },
  chipText: {
    ...font(600),
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 18,
    color: colors.gold,
  },
  // 30 × 30 visual, 44 hit (hitSlop 7).
  chipRemove: {
    width: 30,
    height: 30,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRemovePressed: {
    backgroundColor: colors.pressOverlay,
  },
  clearAll: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing[1],
  },
  clearAllText: {
    ...font(600),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  empty: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[4],
  },
  emptyTile: {
    width: 64,
    height: 64,
    borderRadius: radii.lgPlus,
    backgroundColor: colors.fillSkeleton,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
  },
  emptyTitle: {
    ...font(700),
    fontSize: 20,
    lineHeight: 26,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emptyBody: {
    ...font(400),
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyActions: {
    marginTop: spacing[2],
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing[2],
  },
  emptyActionsStacked: {
    alignSelf: 'stretch',
    flexDirection: 'column',
  },
});
