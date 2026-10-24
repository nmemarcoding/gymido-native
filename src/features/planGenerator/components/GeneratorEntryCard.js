import { useNavigation } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
        <Pressable
          testID="generator-entry-start"
          accessibilityRole="link"
          accessibilityLabel={COPY.entryAction}
          onPress={() => navigation.push(generatorRoutes.PlanGenerator)}
          style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}
        >
          <Text numberOfLines={1} textBreakStrategy="simple" style={styles.linkText}>{COPY.entryAction}</Text>
        </Pressable>
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
  link: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radii.xl,
    backgroundColor: colors.brand400,
    paddingHorizontal: 16,
    paddingVertical: 10,
    boxShadow: shadows.glow,
  },
  linkPressed: {
    backgroundColor: colors.brand500,
  },
  linkText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '900',
    color: colors.navy,
  },
});
