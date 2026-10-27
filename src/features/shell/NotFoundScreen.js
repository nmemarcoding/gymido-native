import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Text as SvgText } from 'react-native-svg';

import PillButton from '../../shared/components/PillButton';
import Screen from '../../shared/components/Screen';
import { breakpoints, colors, font, spacing, typography } from '../../shared/theme/tokens';

// UX A §Not found: the outline "404" (gold at 55 %, 2 px stroke, no fill),
// decorative. 150/140, tracking -0.07em. An Svg (explicit size) draws the
// outline: RN Text has no text stroke.
export const NUMERAL = { fontSize: 150, lineHeight: 140, width: 300 };
const NUMERAL_TRACKING = -0.07 * NUMERAL.fontSize;
// Digits' cap height ≈ 0.7 em: the baseline that centres them in the line.
const NUMERAL_BASELINE = Math.round((NUMERAL.lineHeight + 0.7 * NUMERAL.fontSize) / 2);

function OutlineNumeral({ centred }) {
  return (
    <View
      testID="not-found-numeral"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={centred && styles.centred}
    >
      <Svg width={NUMERAL.width} height={NUMERAL.lineHeight}>
        <SvgText
          x={centred ? NUMERAL.width / 2 : 0}
          y={NUMERAL_BASELINE}
          textAnchor={centred ? 'middle' : 'start'}
          fontFamily={font(700).fontFamily}
          fontSize={NUMERAL.fontSize}
          letterSpacing={NUMERAL_TRACKING}
          fill="none"
          stroke={colors.notFoundStroke}
          strokeWidth={2}
        >
          404
        </SvgText>
      </Svg>
    </View>
  );
}

// App-shell spec §9.4. "Go home" goes Home (`onGoHome`). Phone per the board
// (left-aligned, the gold CTA at the bottom); tablet (ruling ND5): the SAME
// 404, title, body and gold Go home, centred in the tablet column.
export default function NotFoundScreen({ onGoHome }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tablet = width >= breakpoints.md;
  const top = Math.max(spacing[6], Math.round((150 / 844) * height) - insets.top);

  return (
    <Screen testID="not-found" style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.scroll, tablet && styles.scrollTablet]}>
        <View testID="not-found-column" style={[styles.column, tablet ? styles.columnTablet : { paddingTop: top }]}>
          <OutlineNumeral centred={tablet} />
          <Text accessibilityRole="header" textBreakStrategy="simple" style={[styles.title, tablet && styles.textCentred]}>
            Page not found
          </Text>
          <Text style={[styles.body, tablet && styles.textCentred]}>
            The requested page does not exist. Return to the app home to keep going.
          </Text>
          {tablet ? null : <View style={styles.spacer} />}
          <PillButton
            fullWidth={!tablet}
            size="cta"
            variant="primary"
            testID="not-found-home"
            title="Go home"
            onPress={onGoHome}
            style={tablet ? styles.homeTablet : null}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 0,
    justifyContent: 'flex-start',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing[6],
    paddingBottom: 40,
  },
  scrollTablet: {
    justifyContent: 'center',
    paddingVertical: spacing[8],
  },
  column: {
    flexGrow: 1,
    width: '100%',
  },
  // The tablet content column: centred, max 640 (UX: missing tablet boards).
  columnTablet: {
    flexGrow: 0,
    maxWidth: 640,
    alignSelf: 'center',
    alignItems: 'center',
  },
  centred: {
    alignSelf: 'center',
  },
  title: {
    ...typography.titleXl,
    marginTop: spacing[7],
    color: colors.textPrimary,
  },
  body: {
    ...typography.bodyLg,
    marginTop: spacing[3],
    color: colors.textSecondary,
  },
  textCentred: {
    textAlign: 'center',
  },
  // margin-top:auto on the board, at least 24 under the body.
  spacer: {
    flexGrow: 1,
    minHeight: spacing[6],
  },
  homeTablet: {
    marginTop: spacing[7],
    paddingHorizontal: spacing[8],
  },
});
