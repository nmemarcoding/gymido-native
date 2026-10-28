import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKeyboardOverlap } from '../../../shared/hooks/useKeyboardHeight';
import { colors, radii, spacing } from '../../../shared/theme/tokens';
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
// Final device audit (27 Oct 2026, Android tablet): the card ran to the
// window's bottom edge (its last rows sat under the system taskbar) and the
// landscape keyboard hid everything below the find field. The card now sits
// in a frame as tall as the results row, padded 24 at the top and 24 + the
// bottom safe-area inset at the bottom (the "− 48", kept above the inset);
// an open keyboard replaces the inset (as in AppModal), so the card shrinks
// above it and its own list scrolls there, the find field on top.
// v2 fix (PM decision (a), 27 Oct 2026): `onFindFocusChange(focused)` reports
// the find field's focus, so the screen can collapse its header block while
// the keyboard is up (the card then gets the keyboard top − 48).
export default function ExerciseFilterPanel({ facets, filters, onSelect, loadingNames, width, style, onFindFocusChange }) {
  const [query, setQuery] = useState('');
  const shown = useMemo(() => findFacets(facets, query), [facets, query]);
  const variantB = facets.equipment !== null;
  const insets = useSafeAreaInsets();
  // The part of the window the keyboard covers (a floating keyboard: none).
  const keyboardOverlap = useKeyboardOverlap();
  const bottomInset = keyboardOverlap > 0 ? keyboardOverlap : insets.bottom;
  return (
    <View testID="exercises-filter-panel-frame" style={[styles.frame, { paddingBottom: PANEL_GAP + bottomInset }, style]}>
      <View testID="exercises-filter-panel" style={[styles.panel, { width: width >= 1280 ? 280 : 256 }]}>
        <FilterFindField
          value={query}
          onChangeText={setQuery}
          variantB={variantB}
          panel
          onFocus={onFindFocusChange ? () => onFindFocusChange(true) : undefined}
          onBlur={onFindFocusChange ? () => onFindFocusChange(false) : undefined}
        />
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
    </View>
  );
}

// UX T62 §5: top 24, max height viewport − 48 (24 under the card too).
const PANEL_GAP = spacing[6];
// Reviewer LOW: never shorter than its padding + the find field (44) + 8 +
// one row (44), so the find field and a result always show.
const PANEL_MIN_HEIGHT = 16 + 44 + spacing[2] + 44 + 16;

const styles = StyleSheet.create({
  // As tall as the results row (the row stretches it); the card hugs its
  // content inside it and shrinks when the frame is shorter.
  frame: {
    alignSelf: 'stretch',
    flexShrink: 0,
    paddingTop: PANEL_GAP,
  },
  panel: {
    alignSelf: 'flex-start',
    flexShrink: 1,
    minHeight: PANEL_MIN_HEIGHT,
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
