import { useNavigation } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CAP_BODY, NAME_TEXT } from '../../../shared/components/largeText';
import { colors, font, radii, spacing } from '../../../shared/theme/tokens';
import { myPlanRoutes } from '../../myPlans/myPlanRoutes';
import { COPY } from '../../planGenerator/generatorCopy';
import { generatorRoutes } from '../../planGenerator/generatorRoutes';
import { useGeneratorAvailable } from '../../planGenerator/useGeneratorAvailable';
import PlanIcon from './planIcons';
import { PressOverlay, rowsOf } from './planUi';

// The code's strings win (spec T-60): the old My plans entry card's title + sub-line.
const MY_PLANS_TITLE = 'My plans';
const MY_PLANS_BODY = 'Build your own, or copy one from the catalog to change it.';

// Dated change (27 Oct 2026, owner T-60; UX T60-plans-spec §3): the PHONE
// "Make it your own" section: a heading and ONE list card with two row links
// ("Build me a plan" → the generator, only when GET /plan-generator/profile
// says available (G-E1); "My plans" → My plans), divided by an inset line.
// UX native final audit 27 Oct 2026, B203/B204 (T-60 §6): on a tablet the
// two rows become two cards side by side (auto-fit, min 340, gap 16), each
// surface, radius 24, row padding 20, icon tile 52 radius 16, title 18/600,
// body 15/22. `columns` = how many 340 cards fit the column.
export default function PlanOwnRows({ tablet = false, columns = 1 }) {
  const navigation = useNavigation();
  const available = useGeneratorAvailable();
  if (tablet) {
    const rows = [
      available
        ? { rowId: 'generator-entry-start', icon: 'spark', tone: 'teal', title: COPY.entryTitle, body: COPY.entryBody, onPress: () => navigation.push(generatorRoutes.PlanGenerator) }
        : null,
      { rowId: 'my-plans-entry', icon: 'pen', tone: 'gold', title: MY_PLANS_TITLE, body: MY_PLANS_BODY, onPress: () => navigation.push(myPlanRoutes.MyPlans) },
    ].filter(Boolean);
    // auto-fit: the cards share the line (no empty cells).
    const perLine = Math.max(1, Math.min(columns, rows.length));
    return (
      <View testID="plans-own" style={styles.section}>
        <Text {...CAP_BODY} testID="plans-own-heading" accessibilityRole="header" style={styles.heading}>
          Make it your own
        </Text>
        <View testID="plans-own-list" style={styles.grid}>
          {rowsOf(rows, perLine).map((line) => (
            <View key={line.map((row) => row.rowId).join('-')} testID="plans-own-row-line" style={styles.gridLine}>
              {line.map((row) => (
                <View key={row.rowId} testID={`plans-own-card-${row.rowId}`} style={[styles.list, styles.card]}>
                  <OwnRow {...row} tablet />
                </View>
              ))}
            </View>
          ))}
        </View>
      </View>
    );
  }
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

function OwnRow({ rowId, icon, tone, title, body, onPress, tablet = false }) {
  const teal = tone === 'teal';
  return (
    <Pressable
      testID={rowId}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body}`}
      onPress={onPress}
      style={() => [styles.row, tablet && styles.rowTablet]}
    >
      {({ pressed }) => (
        <>
          <PressOverlay pressed={pressed} radius={0} />
          <View testID={`plans-own-tile-${rowId}`} style={[styles.iconTile, tablet && styles.iconTileTablet, teal ? styles.tealTile : styles.goldTile]}>
            <PlanIcon name={icon} size={20} strokeWidth={2} color={teal ? colors.teal : colors.gold} />
          </View>
          <View style={styles.rowText}>
            <Text {...NAME_TEXT} style={[styles.title, tablet && styles.titleTablet]}>
              {title}
            </Text>
            <Text {...CAP_BODY} numberOfLines={2} ellipsizeMode="tail" style={[styles.body, tablet && styles.bodyTablet]}>
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
  grid: {
    gap: spacing[4],
  },
  gridLine: {
    flexDirection: 'row',
    gap: spacing[4],
  },
  card: {
    flex: 1,
    minWidth: 0,
  },
  row: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['3_5'],
    padding: spacing[4],
  },
  rowTablet: {
    flex: 1,
    padding: spacing[5],
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
  iconTileTablet: {
    width: 52,
    height: 52,
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
  titleTablet: {
    fontSize: 18,
    lineHeight: 24,
  },
  body: {
    ...font(400),
    marginTop: spacing['0_5'],
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  bodyTablet: {
    fontSize: 15,
    lineHeight: 22,
  },
});
