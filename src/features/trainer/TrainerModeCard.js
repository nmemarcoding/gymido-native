import { useNavigation } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';

import { routes } from '../../navigation/routes';
import { useLayoutMetrics } from '../../navigation/shell/layoutMetrics';
import { findTabNavigation } from '../../navigation/shell/shellNavigation';
import { colors, radii, shadows } from '../../shared/theme/tokens';
import { ColorPressable, Eyebrow } from '../plans/components/PlanBits';

// TrainerModeCard (web features/trainer/components/TrainerModeCard.jsx), on the
// member Trainer hub for users with the trainer claim. It ONLY navigates to
// /trainer; it must not write the mode preference, so Back returns to
// /my-trainer with the member tabs.
export default function TrainerModeCard() {
  const navigation = useNavigation();
  const { gutter } = useLayoutMetrics();

  return (
    <View testID="trainer-mode-card" style={[styles.card, { paddingHorizontal: gutter === 20 ? 24 : 20 }]}>
      <Eyebrow>Trainer mode</Eyebrow>
      <Text style={styles.title}>You are already a trainer</Text>
      <Text style={styles.body}>
        Switch to Trainer Mode to manage your clients, their plans and your trainer profile.
      </Text>
      <View style={styles.buttonRow}>
        {/* Shared web Button, primary: pill, 16×12, 14px/600, shadow-soft, 200ms transitions. */}
        <ColorPressable
          accessibilityRole="button"
          onPress={() => findTabNavigation(navigation)?.navigate(routes.TrainerDashboardTab)}
          colorsFor={(pressed) => ({ backgroundColor: pressed ? colors.brand500 : colors.brand400 })}
          transitionMs={200}
          style={styles.button}
        >
          <Text style={styles.buttonLabel}>Switch to Trainer Mode</Text>
        </ColorPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.surfaceCard,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
    boxShadow: shadows.plansSoft,
    paddingVertical: 20,
  },
  title: {
    marginTop: 6,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: colors.textPrimary,
  },
  body: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  buttonRow: {
    marginTop: 20,
    flexDirection: 'row',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radii.full,
    paddingHorizontal: 16,
    paddingVertical: 12,
    boxShadow: shadows.plansSoft,
  },
  buttonLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.navy,
  },
});
