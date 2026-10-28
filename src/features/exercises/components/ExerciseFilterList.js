import { useEffect, useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import FeedbackIcon from '../../../shared/components/FeedbackIcon';
import { CAP_BODY, NAME_TEXT } from '../../../shared/components/largeText';
import Skeleton from '../../../shared/components/Skeleton';
import { colors, font, radii, spacing, textInputColors, textScale } from '../../../shared/theme/tokens';
import { rowA11yLabel } from '../exerciseFilters';

const NUMBER = { maxFontSizeMultiplier: textScale.display };
const SKELETON_ROWS = 6;

// Dated change (27 Oct 2026, owner T-62; UX T62 §4): the filter list, ONE
// component for the phone sheet and the tablet dialog. Top to bottom: the
// "Find a muscle" field, the "Muscle group" radiogroup ("All muscle groups",
// then Upper body · Lower body · Core · Other headings and the muscles) and,
// in variant B only, the "Equipment" radiogroup ("All equipment", A–Z).
// Variant A (no equipment names) has no section headings in the sheet /
// dialog: their title already says "Muscle group". `columns` 2 = the tablet
// dialog (headings span both). `facets` comes from findFacets(filterFacets(…),
// query).
// `panel` (≥ 1024, UX T62 §5 + §4): the always-visible panel's metrics: rows
// 44 / radius 14, name 15/500, section headings shown in both variants.
// `showFind` false: the caller pins FilterFindField itself (the sheet's
// AppModal `pinnedHeader`, the panel's top), so only the rows scroll.
export default function ExerciseFilterList({ facets, filters, onSelect, query, onChangeQuery, columns = 1, loadingNames = false, firstRowRef, panel = false, showFind = true }) {
  const variantB = facets.equipment !== null;
  const headings = variantB || panel;
  const cell = columns > 1 ? styles.cellHalf : styles.cellFull;
  const firstSelected = filters.muscle || '';
  const row = (facet, value, label, count, key, testID) => (
    <View key={key} testID={`${testID}-cell`} style={[styles.cell, cell]}>
      <FilterRow
        testID={testID}
        ref={facet === 'muscle' && value === firstSelected ? firstRowRef : undefined}
        panel={panel}
        label={label}
        count={count}
        checked={filters[facet] === value}
        onPress={() => onSelect(facet, value)}
      />
    </View>
  );

  let body;
  if (loadingNames) {
    // §6 first load: no muscle names yet → 6 skeleton rows (44, radius 12).
    body = (
      <View style={styles.skeletons}>
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <Skeleton key={index} testID="exercise-filter-skeleton" radius={12} style={styles.skeleton} />
        ))}
      </View>
    );
  } else if (facets.empty) {
    body = (
      <Text {...CAP_BODY} testID="exercise-filter-no-match" style={styles.noMatch}>
        {`No match for "${String(query).trim()}"`}
      </Text>
    );
  } else {
    body = (
      <>
        {facets.showAll || facets.muscleGroups.length > 0 ? (
          <View testID="exercise-filter-section-muscle" accessibilityRole="radiogroup" accessibilityLabel="Muscle group" style={styles.grid}>
            {headings ? <SectionHeading title="Muscle group" /> : null}
            {facets.showAll ? row('muscle', '', 'All muscle groups', facets.muscleTotal, '__all__', 'exercise-filter-all-muscle') : null}
            {facets.muscleGroups.map((group, index) => [
              <View key={`heading-${group.title}`} testID={`exercise-filter-group-${group.title}`} style={[styles.groupHeadingCell, index === 0 && styles.groupHeadingFirst]}>
                <Text {...CAP_BODY} style={styles.groupHeading}>
                  {group.title}
                </Text>
              </View>,
              ...group.rows.map((option) => row('muscle', option.value, option.label, option.count, option.value, `exercise-filter-muscle-${option.value}`)),
            ])}
          </View>
        ) : null}
        {variantB && (facets.showAll || facets.equipment.length > 0) ? (
          <View testID="exercise-filter-section-equipment" accessibilityRole="radiogroup" accessibilityLabel="Equipment" style={[styles.grid, styles.equipmentSection]}>
            <SectionHeading title="Equipment" />
            {facets.showAll ? row('equipment', '', 'All equipment', facets.equipmentTotal, '__all__', 'exercise-filter-all-equipment') : null}
            {facets.equipment.map((option) => row('equipment', option.value, option.label, option.count, option.value, `exercise-filter-equipment-${option.value}`))}
          </View>
        ) : null}
      </>
    );
  }

  return (
    <View>
      {showFind ? <FilterFindField value={query} onChangeText={onChangeQuery} variantB={variantB} panel={panel} /> : null}
      {body}
    </View>
  );
}

function SectionHeading({ title }) {
  return (
    <View style={styles.sectionHeadingCell}>
      <Text {...CAP_BODY} accessibilityRole="header" style={styles.sectionHeading}>
        {title}
      </Text>
    </View>
  );
}

// §4 "Find a muscle": 48 pill on surface (panel: 44 on surface-well),
// hairline, 16 icon. iOS has its clear button; Android draws our own × (44
// hit). `pinned`: no gap under it (the pinning container spaces it).
// Dated 27 Oct 2026 (audit b3): the field is one line and a placeholder too
// long for it ends in an ellipsis (copy unchanged): our own 1-line Text over
// the empty field (a TextInput placeholder can't ellipsize on Android); the
// copy stays the field's accessibility label.
// `onFocus` / `onBlur` (optional; v2 fix, 27 Oct 2026): passed to the input,
// so the panel can report its find field's focus to the screen.
export function FilterFindField({ value, onChangeText, variantB, panel = false, pinned = false, onFocus, onBlur }) {
  const placeholder = variantB ? 'Find a muscle or equipment' : 'Find a muscle';
  const androidClear = Platform.OS !== 'ios' && value.length > 0;
  return (
    <View testID="exercise-filter-find-box" style={[styles.find, pinned && styles.findPinned]}>
      <TextInput
        {...textInputColors}
        testID="exercise-filter-find"
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        accessibilityLabel={placeholder}
        returnKeyType="search"
        clearButtonMode="while-editing"
        autoCorrect={false}
        autoCapitalize="none"
        maxFontSizeMultiplier={textScale.body}
        style={[styles.findInput, panel && styles.findInputPanel, androidClear && styles.findInputClear]}
      />
      {value.length === 0 ? (
        <View pointerEvents="none" style={styles.findPlaceholderBox}>
          <Text
            testID="exercise-filter-find-placeholder"
            numberOfLines={1}
            ellipsizeMode="tail"
            maxFontSizeMultiplier={textScale.body}
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={styles.findPlaceholder}
          >
            {placeholder}
          </Text>
        </View>
      ) : null}
      <View pointerEvents="none" style={styles.findGlyph} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4" stroke={colors.textMuted} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>
      {androidClear ? (
        <Pressable testID="exercise-filter-find-clear" accessibilityRole="button" accessibilityLabel="Clear" onPress={() => onChangeText('')} style={[styles.findClear, panel && styles.findClearPanel]}>
          <FeedbackIcon name="close" size={14} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

// QA M1 (candidate 2941880, iPhone): a find typed after scrolling kept the
// old offset, so the first matches sat under the pinned title + find field.
// A new query shows its results from the top: the caller's ScrollView (the
// sheet's AppModal scroll, the panel's own) jumps to y 0 with no animation.
export function useScrollTopOnQuery(scrollRef, query) {
  const last = useRef(query);
  useEffect(() => {
    if (last.current === query) {
      return;
    }
    last.current = query;
    scrollRef.current?.scrollTo?.({ y: 0, animated: false });
  }, [scrollRef, query]);
}

// §4 Row (radio): name wraps to 2 lines then an ellipsis; the count is
// tabular and never truncates. Selected: gold tint, ✓ before the name, name
// 600, count gold. Zero: name + count muted, "0", still selectable. While
// loading the count is "—".
function FilterRow({ testID, label, count, checked, onPress, panel, ref }) {
  const zero = count === 0;
  return (
    <Pressable
      ref={ref}
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ checked }}
      accessibilityLabel={rowA11yLabel(label, count)}
      onPress={onPress}
      style={({ pressed }) => [styles.row, panel && styles.rowPanel, checked && styles.rowOn, pressed && !checked && styles.rowPressed]}
    >
      {checked ? (
        <View testID={testID.replace('exercise-filter-', 'exercise-filter-check-')}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M5 12l5 5L20 7" stroke={colors.gold} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
      ) : null}
      <Text {...NAME_TEXT} style={[styles.rowName, panel && styles.rowNamePanel, checked && styles.rowNameOn, zero && !checked && styles.rowMuted]}>
        {label}
      </Text>
      <Text {...NUMBER} testID={`${testID}-count`} style={[styles.rowCount, checked && styles.rowCountOn, zero && !checked && styles.rowMuted]}>
        {count ?? '—'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  find: {
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  findInput: {
    ...font(400),
    minHeight: 48,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingLeft: 42,
    paddingRight: 16,
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  findPinned: {
    marginBottom: 0,
  },
  findInputPanel: {
    minHeight: 44,
    paddingVertical: 10,
    backgroundColor: colors.surfaceWell,
  },
  findInputClear: {
    paddingRight: 44,
  },
  // Over the input's text box: left 42 (past the glyph), right 16.
  findPlaceholderBox: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 42,
    right: 16,
    justifyContent: 'center',
  },
  findPlaceholder: {
    ...font(400),
    fontSize: 15,
    lineHeight: 20,
    color: colors.textFaint,
  },
  findGlyph: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 16,
    justifyContent: 'center',
  },
  findClear: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  findClearPanel: {
    top: 0,
  },
  // The cells pad 6 each side: a 12 column gap in the 2-column dialog.
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  equipmentSection: {
    marginTop: spacing[4],
  },
  cell: {
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  cellFull: {
    width: '100%',
  },
  cellHalf: {
    width: '50%',
  },
  sectionHeadingCell: {
    width: '100%',
    paddingHorizontal: 6 + 12,
    paddingBottom: 6,
  },
  sectionHeading: {
    ...font(600),
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  // Group headings 13/18 600 secondary, margin 12 12 4 (the first 4 12 4).
  groupHeadingCell: {
    width: '100%',
    paddingHorizontal: 6 + 12,
    paddingTop: 12,
    paddingBottom: 4,
  },
  groupHeadingFirst: {
    paddingTop: 4,
  },
  groupHeading: {
    ...font(600),
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  rowPanel: {
    minHeight: 44,
    borderRadius: 14,
  },
  rowOn: {
    backgroundColor: colors.goldTint,
  },
  rowPressed: {
    backgroundColor: colors.pressOverlay,
  },
  rowName: {
    ...font(500),
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  rowNamePanel: {
    fontSize: 15,
    lineHeight: 20,
  },
  rowNameOn: {
    ...font(600),
  },
  rowCount: {
    ...font(600),
    flexShrink: 0,
    fontSize: 14,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
    color: colors.textSecondary,
  },
  rowCountOn: {
    color: colors.gold,
  },
  rowMuted: {
    color: colors.textMuted,
  },
  noMatch: {
    ...font(400),
    padding: 12,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  skeletons: {
    gap: spacing[2],
  },
  skeleton: {
    height: 44,
  },
});
