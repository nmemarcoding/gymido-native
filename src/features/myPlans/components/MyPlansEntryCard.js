import { useNavigation } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, shadows } from '../../../shared/theme/tokens';
import { myPlanRoutes } from '../myPlanRoutes';

const TITLE = 'My plans';
const BODY = 'Build your own, or copy one from the catalog to change it.';

// M4 (§M4): the "My plans" row on S1's loaded layout, shown to everyone (D3).
export default function MyPlansEntryCard({ style }) {
  const navigation = useNavigation();
  return (
    <Pressable
      testID="my-plans-entry"
      accessibilityRole="button"
      accessibilityLabel={`${TITLE}. ${BODY}`}
      onPress={() => navigation.push(myPlanRoutes.MyPlans)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed, style]}
    >
      <View style={styles.text}>
        <Text style={styles.title}>{TITLE}</Text>
        <Text style={styles.body}>{BODY}</Text>
      </View>
      <Text style={styles.chevron} accessibilityElementsHidden importantForAccessibility="no">
        ›
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 16,
    paddingHorizontal: 20,
    boxShadow: shadows.soft,
  },
  cardPressed: {
    borderColor: colors.brand300,
  },
  text: {
    flex: 1,
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
  chevron: {
    fontSize: 20,
    lineHeight: 28,
    color: colors.textMuted,
  },
});
