import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../theme/tokens';

// testID defaults to app-root so UI tests can wait for the app itself rather
// than the Expo dev launcher, which also shows the app name.
export default function Screen({ children, style, testID = 'app-root' }) {
  return (
    <SafeAreaView testID={testID} style={styles.safeArea}>
      <View style={[styles.content, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
});
