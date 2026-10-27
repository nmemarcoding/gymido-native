import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BlurLayer from '../../../shared/components/BlurLayer';
import GradientFill from '../../../shared/components/GradientFill';
import { isTabletWidth } from '../../../shared/components/AppModal';
import useForegroundBlur from './useForegroundBlur';
import { CAP_BODY, DISPLAY_TITLE_TEXT, TITLE_TEXT } from '../../../shared/components/largeText';
import { colors, font, gradients, radii, shadows, spacing, typography } from '../../../shared/theme/tokens';

// The v2 workout prompt shell (UX F1 Discard, F2 Exact alarm / Hear your
// rest timer): a floating bottom sheet on phones (left/right/bottom 10, grab
// handle, icon tile, centred title and body, actions) and a centred card on
// tablets (≥ 768, no handle). Look only: every caller keeps its own
// dismiss rules, focus and copy.
//
// `onScrim`: the scrim tap (null = the scrim does nothing).
// `onRequestClose`: Android back.
// `tone`: 'gold' | 'teal' | 'danger' (icon tile + the tablet card glow).
// `icon`: ({ size }) => node.  `variant`: 'prompt' (A2/A3 sheets, radius 36)
// or 'confirm' (Discard: radius 32, danger card on tablet).
// The prompts' backdrop blur (px), as drawn on the Rest alert / Discard
// boards (and v1's dialogs). No blur token holds 8 (blur.scrim 4 /
// scrimTablet 6 are U12's AppModal values): reported to the lead.
export const PROMPT_SCRIM_BLUR = 8;

const TILE = {
  gold: colors.goldTint,
  teal: colors.tealTint,
  danger: colors.dangerTint,
};

export default function AlertSheet({
  open,
  testID,
  label,
  title,
  titleRef,
  tone = 'gold',
  variant = 'prompt',
  icon,
  onRequestClose,
  onScrim = null,
  children,
  actions,
}) {
  const { width, height } = useWindowDimensions();
  const { showBlur, blurKey } = useForegroundBlur();
  const insets = useSafeAreaInsets();
  const tablet = isTabletWidth(width);
  const confirm = variant === 'confirm';
  const tileSize = tablet ? (confirm ? 72 : 84) : confirm ? 56 : 76;
  const iconSize = tablet ? (confirm ? 32 : 40) : confirm ? 26 : 34;
  const card = tablet
    ? [styles.card, confirm ? styles.cardConfirm : styles.cardPrompt, { maxHeight: height - 2 * spacing[6] - insets.top - insets.bottom }]
    : [
        styles.sheet,
        confirm ? styles.sheetConfirm : styles.sheetPrompt,
        { bottom: spacing['2_5'] + insets.bottom, maxHeight: height - spacing['2_5'] * 2 - insets.top - insets.bottom },
      ];
  return (
    <Modal transparent visible={open} animationType="fade" onRequestClose={onRequestClose} statusBarTranslucent>
      <View style={[styles.host, tablet && styles.hostTablet]}>
        {/* Lead / UX F2 ruling: a DIMMED scrim over the live Rest screen,
            never opaque: color-scrim 0.6 + blur 8 on phone and tablet; the
            blur only while the app is in the foreground (useForegroundBlur). */}
        {showBlur ? <BlurLayer key={blurKey} blurPx={PROMPT_SCRIM_BLUR} overApp /> : null}
        <Pressable
          testID={testID ? `${testID}-scrim` : undefined}
          accessible={false}
          disabled={!onScrim}
          onPress={onScrim ?? undefined}
          style={[StyleSheet.absoluteFill, styles.scrim]}
        />
        <View testID={testID} accessibilityViewIsModal role="dialog" accessibilityLabel={label ?? title} style={card}>
          {tablet ? (
            // The card's fill, mounted with the card (Android gradient hazard).
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.cardClip, confirm ? styles.radiusConfirm : styles.radiusPrompt]}>
              <GradientFill
                angle={(confirm ? gradients.dangerCard : gradients.card).angle}
                colors={(confirm ? gradients.dangerCard : gradients.card).colors}
              />
            </View>
          ) : null}
          <ScrollView bounces={false} contentContainerStyle={[styles.content, tablet && styles.contentTablet]}>
            {tablet ? null : <View testID={testID ? `${testID}-handle` : undefined} accessibilityElementsHidden importantForAccessibility="no" style={styles.handle} />}
            <View
              testID={testID ? `${testID}-tile` : undefined}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[
                styles.tile,
                { width: tileSize, height: tileSize, backgroundColor: TILE[tone] ?? TILE.gold },
                confirm ? (tablet ? styles.tileConfirmTablet : styles.tileConfirm) : styles.tilePrompt,
                tablet ? styles.tileTabletGap : styles.tilePhoneGap,
              ]}
            >
              {icon ? icon({ size: iconSize }) : null}
            </View>
            <Text
              ref={titleRef}
              {...(tablet ? DISPLAY_TITLE_TEXT : TITLE_TEXT)}
              accessibilityRole="header"
              style={[styles.title, tablet ? (confirm ? styles.titleConfirmTablet : styles.titleTablet) : confirm ? styles.titleConfirm : styles.titlePhone]}
            >
              {title}
            </Text>
            {children}
            <View style={styles.actions}>{actions}</View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// Body copy in the sheet's style (phone 15/22 secondary, max 310; tablet
// 18/28 strong-2, or 17/26 secondary on the Discard card).
export function SheetBody({ children, tablet, confirm = false, muted = false, testID }) {
  let style = styles.bodyPhone;
  if (tablet) {
    style = confirm ? styles.bodyConfirmTablet : styles.bodyTablet;
  }
  return (
    <Text testID={testID} {...CAP_BODY} style={[styles.body, style, muted && (tablet ? styles.mutedTablet : styles.mutedPhone)]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
  },
  hostTablet: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
  },
  scrim: {
    backgroundColor: colors.scrim,
  },
  sheet: {
    position: 'absolute',
    left: spacing['2_5'],
    right: spacing['2_5'],
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surfaceCard2,
    boxShadow: shadows.sheetUp,
  },
  sheetPrompt: {
    borderRadius: radii.xxxxl,
  },
  sheetConfirm: {
    borderRadius: radii.xxxl,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surface,
    boxShadow: shadows.sheet,
  },
  cardPrompt: {
    borderRadius: radii.xxxxl,
  },
  cardConfirm: {
    borderRadius: radii.xxxl,
    borderColor: colors.dangerLine,
  },
  cardClip: {
    overflow: 'hidden',
  },
  radiusPrompt: {
    borderRadius: radii.xxxxl,
  },
  radiusConfirm: {
    borderRadius: radii.xxxl,
  },
  content: {
    alignItems: 'center',
    paddingTop: spacing['2_5'],
    paddingHorizontal: spacing['5_5'],
    paddingBottom: spacing[6],
  },
  contentTablet: {
    alignItems: 'stretch',
    padding: spacing[8] + spacing[2],
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: radii.full,
    backgroundColor: colors.grabHandle,
  },
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Board radii 26 / 18 / 22 fold up to the ladder (UX §3: 14 → 16, 18 → 20).
  tilePrompt: {
    borderRadius: radii.xxl,
  },
  tileConfirm: {
    borderRadius: radii.lg,
  },
  tileConfirmTablet: {
    borderRadius: radii.lgPlus,
  },
  tilePhoneGap: {
    marginTop: spacing['5_5'],
  },
  tileTabletGap: {
    marginTop: 0,
  },
  title: {
    color: colors.textPrimary,
    textAlign: 'center',
  },
  titlePhone: {
    ...typography.titleXl,
    marginTop: spacing[4],
  },
  titleConfirm: {
    ...typography.titleMd,
    marginTop: spacing[4],
  },
  titleTablet: {
    ...typography.titleXl,
    fontSize: 40,
    lineHeight: 42,
    letterSpacing: -1.6,
    marginTop: spacing['5_5'],
    textAlign: 'left',
  },
  titleConfirmTablet: {
    ...typography.titleXl,
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: -1.52,
    marginTop: spacing[4],
    textAlign: 'left',
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
  },
  bodyPhone: {
    marginTop: spacing[2],
    maxWidth: 310,
    textAlign: 'center',
  },
  bodyTablet: {
    ...font(400),
    fontSize: 18,
    lineHeight: 28,
    marginTop: spacing[4],
    color: colors.textStrong2,
  },
  bodyConfirmTablet: {
    ...font(400),
    fontSize: 17,
    lineHeight: 26,
    marginTop: spacing[3],
  },
  mutedPhone: {
    ...typography.bodySm,
    marginTop: spacing['2_5'],
    color: colors.textMuted,
  },
  mutedTablet: {
    ...font(400),
    fontSize: 16,
    lineHeight: 24,
    marginTop: spacing['3_5'],
    color: colors.textSecondary,
  },
  actions: {
    alignSelf: 'stretch',
    marginTop: spacing['4_5'],
  },
});

