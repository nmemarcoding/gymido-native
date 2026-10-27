import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';

import AppModal, { isTabletWidth } from '../../../shared/components/AppModal';
import { useLargeTextReflow } from '../../../shared/components/largeText';
import PillButton from '../../../shared/components/PillButton';
import { useSheetFocus } from '../../../shared/hooks/useSheetFocus';
import { findFacets, showLabel } from '../exerciseFilters';
import ExerciseFilterList, { FilterFindField } from './ExerciseFilterList';

// Dated change (27 Oct 2026, owner T-62; UX T62 §5): the filter list in the
// shared AppModal, used unchanged: phone < 768 = the bottom sheet (handle,
// pinned title row + ×, safe-area bottom, the shared max height), tablet =
// the centred 520 dialog with the list in 2 columns. Replaces §E2's
// "Muscle group" sheet. The find field is pinned under the title (AppModal
// `pinnedHeader`); only the rows scroll.
// [B] (equipment names known): title "Filters"; a tap applies live (the
// count updates behind the scrim) and the sheet stays open; the pinned gold
// footer "Show {n} exercises" closes it. The footer is not a dismiss
// (Cancel / Close / Done), so the phone × stays (AppModal's footer rule).
// A (the lookup failed or is pending): title "Muscle group", a tap applies
// AND closes, no footer.
// a11y: on open focus goes to the selected muscle row, on close back to the
// Filter button (`returnRef`).
export default function ExerciseFilterSheet({ open, facets, filters, resultCount, onSelect, onClose, loadingNames, returnRef }) {
  const { width } = useWindowDimensions();
  const tablet = isTabletWidth(width);
  const reflow = useLargeTextReflow();
  const variantB = facets.equipment !== null;
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (open) {
      setQuery('');
    }
  }, [open]);
  const shown = useMemo(() => findFacets(facets, query), [facets, query]);
  const firstRowRef = useRef(null);
  useSheetFocus(open, { initialRef: firstRowRef, returnRef });

  const select = (facet, value) => {
    onSelect(facet, value);
    if (!variantB) {
      onClose();
    }
  };

  return (
    <AppModal
      testID="exercise-filter-sheet"
      isOpen={open}
      onClose={onClose}
      title={variantB ? 'Filters' : 'Muscle group'}
      size="md"
      pinnedHeader={<FilterFindField value={query} onChangeText={setQuery} variantB={variantB} pinned />}
      footer={
        variantB ? (
          <PillButton
            testID="exercise-filter-show"
            title={showLabel(resultCount)}
            variant="primary"
            fullWidth
            onPress={onClose}
            // UX T62 §5: gold 52 on the phone (the kit default), 56 in the dialog.
            size="default"
            style={tablet ? styles.showTablet : null}
          />
        ) : null
      }
    >
      <ExerciseFilterList
        facets={shown}
        filters={filters}
        onSelect={select}
        query={query}
        onChangeQuery={setQuery}
        columns={tablet && !reflow ? 2 : 1}
        loadingNames={loadingNames}
        firstRowRef={firstRowRef}
        showFind={false}
      />
    </AppModal>
  );
}

const styles = StyleSheet.create({
  showTablet: {
    minHeight: 56,
  },
});
