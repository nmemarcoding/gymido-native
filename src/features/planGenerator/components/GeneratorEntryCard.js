import { useNavigation } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';

import TextLink from '../../../shared/components/TextLink';
import { colors, radii, shadows } from '../../../shared/theme/tokens';
import { COPY } from '../generatorCopy';
import { generatorRoutes } from '../generatorRoutes';
import { useGeneratorAvailable } from '../useGeneratorAvailable';

// G-E1 (RN-SPEC-PLAN-GENERATOR §G-E): the S1 card, right after the "My
// plans" card. Renders nothing unless the generator is available (⚠G-1).
export default function GeneratorEntryCard() {
  const navigation = useNavigation();
  const available = useGeneratorAvailable();
  if (!available) {
    return null;
  }

  return (
    <View testID="generator-entry-card" style={styles.card}>
      <View style={styles.accent} accessibilityElementsHidden importantForAccessibility="no" />
      <View style={styles.content}>
        <View style={styles.text}>
          <Text style={styles.title}>{COPY.entryTitle}</Text>
          <Text style={styles.body}>{COPY.entryBody}</Text>
        </View>
        {/* Design system v1 #19: "Get started →" is a text link. */}
        <TextLink testID="generator-entry-start" label={COPY.entryAction} arrow onPress={() => navigation.push(generatorRoutes.PlanGenerator)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: radii.xxxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    boxShadow: shadows.soft,
  },
  accent: {
    width: 6,
    backgroundColor: colors.brand400,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  text: {
    flexShrink: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  body: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  // Batch A (A3): min-height 44.
});
