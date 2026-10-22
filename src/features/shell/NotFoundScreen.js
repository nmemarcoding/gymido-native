import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, shadows } from '../../shared/theme/tokens';

// App-shell spec §9.4. "Go home" pushes Home (`onGoHome`).
export default function NotFoundScreen({ onGoHome }) {
  return (
    <SafeAreaView testID="not-found" style={styles.screen}>
      <View style={styles.column}>
        <View style={styles.card}>
          <Text style={styles.code}>404</Text>
          <Text accessibilityRole="header" style={styles.title}>
            Page not found
          </Text>
          <Text style={styles.body}>The requested page does not exist. Return to the app home to keep going.</Text>
          <Pressable
            testID="not-found-home"
            accessibilityRole="button"
            onPress={onGoHome}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonLabel}>Go home</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 48,
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 512,
    alignSelf: 'center',
    borderRadius: radii.surfaceCard,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
    boxShadow: shadows.soft,
    padding: 32,
    alignItems: 'center',
  },
  code: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: 2.8,
    textTransform: 'uppercase',
    color: colors.brand600,
  },
  title: {
    marginTop: 16,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '600',
    letterSpacing: -0.75,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  body: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  button: {
    marginTop: 24,
    borderRadius: radii.full,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: colors.brand400,
  },
  buttonPressed: {
    backgroundColor: colors.brand500,
  },
  buttonLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.navy,
  },
});
