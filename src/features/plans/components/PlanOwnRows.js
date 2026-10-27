import { useNavigation } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CAP_BODY, NAME_TEXT } from '../../../shared/components/largeText';
import { colors, font, radii, spacing } from '../../../shared/theme/tokens';
import { myPlanRoutes } from '../../myPlans/myPlanRoutes';
import { COPY } from '../../planGenerator/generatorCopy';
import { generatorRoutes } from '../../planGenerator/generatorRoutes';
import { useGeneratorAvailable } from '../../planGenerator/useGeneratorAvailable';
import PlanIcon from './planIcons';
import { PressOverlay } from './planUi';

// The code's strings win (spec T-60): MyPlansEntryCard's title + sub-line.
const MY_PLANS_TITLE = 'My plans';
const MY_PLANS_BODY = 'Build your own, or copy one from the catalog to change it.';

// Dated change (27 Oct 2026, owner T-60; UX T60-plans-spec §3): the PHONE
// "Make it your own" section: a heading and ONE list card with two row links
// ("Build me a plan" → the generator, only when GET /plan-generator/profile
// says available (G-E1); "My plans" → My plans), divided by an inset line.
export default function PlanOwnRows() {
  const navigation = useNavigation();
  const available = useGeneratorAvailable();
  return (
    <View testID="plans-own" style={styles.section}>
      <Text {...CAP_BODY} testID="plans-own-heading" accessibilityRole="header" style={styles.heading}>
        Make it your own
      </Text>
      <View testID="plans-own-list" style={styles.list}>
        {available ? (
          <>
            <OwnRow
              rowId="generator-entry-start"
              icon="spark"
              tone="teal"
              title={COPY.entryTitle}
              body={COPY.entryBody}
              onPress={() => navigation.push(generatorRoutes.PlanGenerator)}
            />
            <View testID="plans-own-divider" style={styles.divider} />
          </>
        ) : null}
        <OwnRow rowId="my-plans-entry" icon="pen" tone="gold" title={MY_PLANS_TITLE} body={MY_PLANS_BODY} onPress={() => navigation.push(myPlanRoutes.MyPlans)} />
      </View>
    </View>
  );
}

function OwnRow({ rowId, icon, tone, title, body, onPress }) {
  const teal = tone === 'teal';
  return (
    <Pressable testID={rowId} accessibilityRole="button" accessibilityLabel={`${title}. ${body}`} onPress={onPress} style={() => styles.row}>
      {({ pressed }) => (
        <>
          <PressOverlay pressed={pressed} radius={0} />
          <View style={[styles.iconTile, teal ? styles.tealTile : styles.goldTile]}>
            <PlanIcon name={icon} size={20} strokeWidth={2} color={teal ? colors.teal : colors.gold} />
          </View>
          <View style={styles.rowText}>
            <Text {...NAME_TEXT} style={styles.title}>
              {title}
            </Text>
            <Text {...CAP_BODY} numberOfLines={2} ellipsizeMode="tail" style={styles.body}>
              {body}
            </Text>
          </View>
          <PlanIcon name="chevronRight" size={18} color={colors.textFaint} />
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing[3],
  },
  // 20/26/700 −0.02em, margin 16 4 0.
  heading: {
    ...font(700),
    marginTop: spacing[4],
    marginHorizontal: spacing[1],
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.4,
    color: colors.textPrimary,
  },
  list: {
    overflow: 'hidden',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  row: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['3_5'],
    padding: spacing[4],
  },
  divider: {
    height: 1,
    marginHorizontal: spacing[4],
    backgroundColor: colors.hairline,
  },
  // 44, radius 14 → 16 (§3 fold).
  iconTile: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
  },
  tealTile: {
    backgroundColor: colors.tealTint,
  },
  goldTile: {
    backgroundColor: colors.goldTint,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...font(600),
    fontSize: 16,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  body: {
    ...font(400),
    marginTop: spacing['0_5'],
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
});
