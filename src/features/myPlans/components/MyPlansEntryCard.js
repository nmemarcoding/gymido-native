import { useNavigation } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CAP_BODY } from '../../../shared/components/largeText';
import { colors, font, radii, spacing, typography } from '../../../shared/theme/tokens';
import PlanIcon from '../../plans/components/planIcons';
import { PressOverlay } from '../../plans/components/planUi';
import { myPlanRoutes } from '../myPlanRoutes';

const TITLE = 'My plans';
const BODY = 'Build your own, or copy one from the catalog to change it.';

// M4 (§M4): the "My plans" entry on S1, shown to everyone (D3). v2 look (UX
// H): `layout="tile"` = the phone grid tile (44 gold-tint icon tile, 16/600
// title, 12/17 muted sub); `layout="row"` = the tablet row card (56 tile,
// 18/600, 15 muted, a chevron). The whole card is one link.
export default function MyPlansEntryCard({ layout = 'tile', style }) {
  const navigation = useNavigation();
  const row = layout === 'row';
  return (
    <Pressable
      testID="my-plans-entry"
      accessibilityRole="button"
      accessibilityLabel={`${TITLE}. ${BODY}`}
      onPress={() => navigation.push(myPlanRoutes.MyPlans)}
      style={({ pressed }) => [entryStyles.card, row ? entryStyles.row : entryStyles.tile, pressed && entryStyles.pressed, style]}
    >
      {({ pressed }) => (
        <>
          <PressOverlay pressed={pressed} radius={row ? radii.xxl : radii.xl} />
          <View style={[entryStyles.iconTile, row && entryStyles.iconTileRow, entryStyles.goldTile]}>
            <PlanIcon name="list" size={row ? 26 : 22} color={colors.gold} />
          </View>
          <View style={row ? entryStyles.rowText : null}>
            <Text {...CAP_BODY} style={row ? entryStyles.titleRow : entryStyles.title}>
              {TITLE}
            </Text>
            <Text {...CAP_BODY} style={row ? entryStyles.bodyRow : entryStyles.body}>
              {BODY}
            </Text>
          </View>
          {row ? <PlanIcon name="chevronRight" size={20} color={colors.textMuted} /> : null}
        </>
      )}
    </Pressable>
  );
}

// Shared with the Plans generator tile (same card, teal).
export const entryStyles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  // Phone: radius-xl 24, padding 16, column gap 14.
  tile: {
    padding: spacing[4],
    gap: spacing['3_5'],
  },
  // Tablet: radius 28, padding 22 24, a row with gap 16.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    borderRadius: radii.xxl,
    paddingVertical: spacing['5_5'],
    paddingHorizontal: spacing[6],
  },
  // Pressed: the 4 % overlay + a gold-line edge (UX H; §8.6 state rule).
  pressed: {
    borderColor: colors.goldLine,
  },
  // 44 × 44 (the drawn radius 14 folds into 16, §3).
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 56 × 56 (the drawn 18 folds into 20).
  iconTileRow: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
  },
  goldTile: {
    backgroundColor: colors.goldTint,
  },
  tealTile: {
    backgroundColor: colors.tealTint,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...typography.labelLg,
    color: colors.textPrimary,
  },
  titleRow: {
    ...font(600),
    fontSize: 18,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  body: {
    ...font(400),
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  bodyRow: {
    ...typography.body,
    marginTop: spacing['0_5'],
    color: colors.textMuted,
  },
});
