import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../../theme/tokens';

// iOS picker sheet (RN-SPEC-profile-create §3.5, §3.6): the platform picker in
// a bottom sheet with "Done", standing in for Safari's picker sheet.
export default function BottomSheet({ visible, onDone, children, testID }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDone}>
      <Pressable style={styles.backdrop} onPress={onDone} accessibilityLabel="Close picker" />
      <View testID={testID} style={[styles.sheet, { paddingBottom: insets.bottom }]}>
        <View style={styles.toolbar}>
          <Pressable accessibilityRole="button" onPress={onDone} hitSlop={8}>
            <Text style={styles.done}>Done</Text>
          </Pressable>
        </View>
        {children}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  done: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007aff',
  },
});
