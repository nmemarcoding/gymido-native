import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { colors, radii } from '../../../shared/theme/tokens';
import { findFacets } from '../exerciseFilters';
import ExerciseFilterList, { FilterFindField } from './ExerciseFilterList';

// Dated change (27 Oct 2026, owner T-62; UX T62 §5 "≥ 1024"): the always
// visible filter panel left of the results (tablet landscape, beside the
// rail). The same ExerciseFilterList in its `panel` metrics; no title, no ×,
// no footer, and a tap applies at once. 280 wide at ≥ 1280, 256 at
// 1024–1279; a card (radius 24, surface, hairline, padding 16 10), held at
// the top 24 of the page (native: it sits outside the scrolling list, so it
// never scrolls away) with max height window − 48; its rows scroll inside
// under the pinned find field. Large text (≥ 1.5) uses the button + dialog.
export default function ExerciseFilterPanel({ facets, filters, onSelect, loadingNames, width, maxHeight, style }) {
  const [query, setQuery] = useState('');
  const shown = useMemo(() => findFacets(facets, query), [facets, query]);
  const variantB = facets.equipment !== null;
  return (
    <View testID="exercises-filter-panel" style={[styles.panel, { width: width >= 1280 ? 280 : 256, maxHeight }, style]}>
      <FilterFindField value={query} onChangeText={setQuery} variantB={variantB} panel />
      <ScrollView testID="exercises-filter-panel-scroll" style={styles.scroll} bounces={false} overScrollMode="never" keyboardShouldPersistTaps="handled">
        <ExerciseFilterList
          facets={shown}
          filters={filters}
          onSelect={onSelect}
          query={query}
          onChangeQuery={setQuery}
          loadingNames={loadingNames}
          panel
          showFind={false}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    alignSelf: 'flex-start',
    flexShrink: 0,
    marginTop: 24,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    paddingVertical: 16,
    paddingHorizontal: 10,
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
});
