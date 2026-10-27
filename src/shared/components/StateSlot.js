import { StyleSheet, View } from 'react-native';

// RN-SPEC-v2-phase2 §D1 placement (UX D "Tablet/web rule"): a whole-page
// state (inline error, the page's ErrorAlert, a page EmptyState, the page
// Loader) is the same card in the content column, centred, max 640, in the
// normal flow under the page header (never vertically centred on the
// screen). On a phone the column is narrower than 640, so it is full width.
// Section states (an EmptyState inside a card or section) keep their
// section's width and are not wrapped.
export const STATE_COLUMN_MAX = 640;
// Pages centre their Loader with 48 above and below (RN-SPEC loaders).
export const STATE_LOADER_PADDING = 48;

export default function StateSlot({ children, loader = false, testID = 'state-slot', style }) {
  return (
    <View testID={testID} style={[styles.slot, loader && styles.loader, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    width: '100%',
    maxWidth: STATE_COLUMN_MAX,
    alignSelf: 'center',
  },
  loader: {
    paddingVertical: STATE_LOADER_PADDING,
  },
});
