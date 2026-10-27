import { useNavigation } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CAP_BODY } from '../../../shared/components/largeText';
import TextLink from '../../../shared/components/TextLink';
import { colors, radii, spacing } from '../../../shared/theme/tokens';
import MyPlansEntryCard, { entryStyles } from '../../myPlans/components/MyPlansEntryCard';
import { COPY } from '../../planGenerator/generatorCopy';
import { generatorRoutes } from '../../planGenerator/generatorRoutes';
import { useGeneratorAvailable } from '../../planGenerator/useGeneratorAvailable';
import PlanIcon from './planIcons';
import { PressOverlay, useIsTablet, useReflow } from './planUi';

// UX H: the two entry tiles under the active card. Phone: a 2-column grid
// (gap 12) of tiles; tablet: two row cards side by side (gap 16), "My plans"
// first. "Build me a plan" only when GET /plan-generator/profile says
// available (G-E1, ⚠G-1: otherwise nothing, and "My plans" spans the row).
// Past 1.3× text the two stack (§9 rule 4).
export default function PlanEntryTiles() {
  const navigation = useNavigation();
  const available = useGeneratorAvailable();
  const tablet = useIsTablet();
  const reflow = useReflow();
  const openGenerator = () => navigation.push(generatorRoutes.PlanGenerator);
  const cell = available && !reflow ? styles.half : styles.full;

  return (
    <View testID="plans-entry-tiles" style={[styles.grid, tablet && styles.gridTablet]}>
      <MyPlansEntryCard layout={tablet ? 'row' : 'tile'} style={cell} />
      {available ? (
        tablet ? (
          <View testID="generator-entry-card" style={[entryStyles.card, entryStyles.row, styles.generatorRow, cell]}>
            <View style={[entryStyles.iconTile, entryStyles.iconTileRow, entryStyles.tealTile]}>
              <PlanIcon name="spark" size={26} color={colors.teal} />
            </View>
            <View style={entryStyles.rowText}>
              <Text {...CAP_BODY} style={entryStyles.titleRow}>
                {COPY.entryTitle}
              </Text>
              <Text {...CAP_BODY} style={entryStyles.bodyRow}>
                {COPY.entryBody}
              </Text>
              {/* Decided: a TextLink (the canvas draws a glass pill). */}
              <TextLink testID="generator-entry-start" label={COPY.entryAction} arrow onPress={openGenerator} />
            </View>
          </View>
        ) : (
          <Pressable
            testID="generator-entry-start"
            accessibilityRole="button"
            accessibilityLabel={`${COPY.entryTitle}. ${COPY.entryBody}`}
            onPress={openGenerator}
            style={({ pressed }) => [entryStyles.card, entryStyles.tile, pressed && entryStyles.pressed, cell]}
          >
            {({ pressed }) => (
              <>
                <PressOverlay pressed={pressed} radius={radii.xl} />
                <View style={[entryStyles.iconTile, entryStyles.tealTile]}>
                  <PlanIcon name="spark" size={22} color={colors.teal} />
                </View>
                <View>
                  <Text {...CAP_BODY} style={entryStyles.title}>
                    {COPY.entryTitle}
                  </Text>
                  <Text {...CAP_BODY} style={entryStyles.body}>
                    {COPY.entryBody}
                  </Text>
                </View>
              </>
            )}
          </Pressable>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  gridTablet: {
    gap: spacing[4],
  },
  // Two equal columns: each grows from 0 beside the gap.
  half: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  full: {
    width: '100%',
  },
  generatorRow: {
    alignItems: 'flex-start',
  },
});
