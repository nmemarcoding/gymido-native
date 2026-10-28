import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { isTabletWidth } from '../../../../shared/components/AppModal';
import BackPill from '../../../../shared/components/BackPill';
import { CAP_BODY, useLargeTextReflow } from '../../../../shared/components/largeText';
import Spinner from '../../../../shared/components/Spinner';
import { colors, font, layout, motion, radii, spacing } from '../../../../shared/theme/tokens';
import { InfoIcon } from './pickerIcons';

// Small pieces of the v2 builder (UX phase4 I §0-§3, phase6 O builder).
// Kept here so the screen, the lists and the dialogs share one look.

// The layout facts every builder piece reads: tablet = the centred-card /
// two-column layout (≥ 768); reflow = past the §9 large-text point.
export function useBuilderLayout() {
  const { width } = useWindowDimensions();
  const reflow = useLargeTextReflow();
  return { tablet: isTabletWidth(width), reflow };
}

// Vertical slop that turns a drawn 32-40 control into a 44 target.
export function slopFor(height) {
  const pad = Math.max(0, Math.ceil((layout.touchMin - height) / 2));
  return { top: pad, bottom: pad, left: 4, right: 4 };
}

// "Edit" / "Delete" text buttons (13/600 gold or danger-text, 44 hit).
export function TextAction({ label, tone = 'gold', size = 13, accessibilityLabel, onPress, testID }) {
  const color = tone === 'danger' ? colors.dangerText : colors.gold;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      hitSlop={slopFor(32)}
      style={styles.textAction}
    >
      {({ pressed }) => (
        <Text {...CAP_BODY} style={[styles.textActionLabel, { fontSize: size, lineHeight: size + 5, color }, pressed && styles.underline]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

// The danger-tint button of the builder ("Delete", "Delete plan"):
// danger-dot 8 % fill, 30 % edge, danger-text label; 44 tall (drawn 40-42).
// Pressed adds the white 4 % overlay (UX §8.6 state rule). The kit pill
// has no danger-tint variant (reported).
export function DangerTintButton({ title, onPress, loading = false, disabled = false, accessibilityLabel, testID, style }) {
  const inactive = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={[styles.tint, style, inactive && styles.inactive]}
    >
      {({ pressed }) => (
        <>
          {pressed && !inactive ? <View testID={testID ? `${testID}-pressed` : undefined} pointerEvents="none" style={[StyleSheet.absoluteFill, styles.overlay]} /> : null}
          <View style={styles.tintRow}>
            {loading ? (
              <Spinner size={14} thickness={2} color={colors.dangerText} track={colors.dangerLine} reducedMotionLoopMs={motion.spinnerReducedLoopMs} />
            ) : null}
            <Text {...CAP_BODY} textBreakStrategy="simple" style={styles.tintLabel}>
              {title}
            </Text>
          </View>
        </>
      )}
    </Pressable>
  );
}

// The back link of the builder. T-65 (PHONE-NAV spec §3, 27 Oct 2026): the
// kit glass back pill for both audiences ("‹ My plans" / "‹ All plans"), in
// place of the member's gold text link and the trainer's own 40-tall pill.
export function BackLink({ label, onPress, testID }) {
  return <BackPill testID={testID} label={label} onPress={onPress} />;
}

// The trainer eyebrow chip ("Builder" / "Plan"): teal on teal 14 %, a 6 dot.
export function EyebrowChip({ label, tablet = false }) {
  return (
    <View testID="plan-eyebrow-chip" style={[styles.chip, tablet && styles.chipTablet]}>
      <View style={styles.chipDot} />
      <Text {...CAP_BODY} style={[styles.chipLabel, tablet && styles.chipLabelTablet]}>
        {label}
      </Text>
    </View>
  );
}

// The neutral status box of the builder (current plan, catalog notice):
// radius 20, surface + hairline, padding 16.
export function StatusBox({ title, children, testID, accessibilityRole = 'summary', style }) {
  return (
    <View testID={testID} accessibilityRole={accessibilityRole} accessibilityLiveRegion="polite" style={[styles.statusBox, style]}>
      {title ? (
        <Text {...CAP_BODY} style={styles.statusTitle}>
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

// The amber notice card (UX §0.4): warning 8 % + 28 % edge, info icon,
// 14/20 (tablet 15/22). `title` makes it the page banner (phase6 O).
export function WarningNotice({ title, body, testID, accessibilityRole = 'summary' }) {
  const { tablet } = useBuilderLayout();
  return (
    <View testID={testID} accessibilityRole={accessibilityRole} accessibilityLiveRegion="polite" style={styles.warning}>
      <View style={styles.warningIcon}>
        <InfoIcon color={colors.warning} size={20} />
      </View>
      <View style={styles.warningText}>
        {title ? (
          <Text {...CAP_BODY} style={styles.warningTitle}>
            {title}
          </Text>
        ) : null}
        <Text {...CAP_BODY} style={[title ? styles.warningBodyBanner : styles.warningBody, tablet && !title && styles.warningBodyTablet]}>
          {body}
        </Text>
      </View>
    </View>
  );
}

export const builderStyles = StyleSheet.create({
  statusBody: {
    ...font(400),
    marginTop: spacing[1],
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  link: {
    ...font(700),
    color: colors.gold,
  },
  hint: {
    ...font(400),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
});

const styles = StyleSheet.create({
  textAction: {
    minHeight: 32,
    justifyContent: 'center',
  },
  textActionLabel: {
    ...font(600),
  },
  underline: {
    textDecorationLine: 'underline',
  },
  tint: {
    minHeight: layout.touchMin,
    paddingHorizontal: spacing[4],
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.dangerDotBorder,
    backgroundColor: colors.dangerDotTint,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2],
    maxWidth: '100%',
  },
  tintLabel: {
    ...font(600),
    flexShrink: 1,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    color: colors.dangerText,
  },
  overlay: {
    backgroundColor: colors.pressOverlay,
  },
  inactive: {
    opacity: 0.5,
  },
  chip: {
    alignSelf: 'flex-start',
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing['2_5'],
    borderRadius: radii.full,
    backgroundColor: colors.tealTint,
  },
  chipTablet: {
    minHeight: 28,
    paddingHorizontal: spacing[3],
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: radii.full,
    backgroundColor: colors.teal,
  },
  chipLabel: {
    ...font(600),
    fontSize: 12,
    lineHeight: 16,
    color: colors.teal,
  },
  chipLabelTablet: {
    fontSize: 13,
    lineHeight: 18,
  },
  statusBox: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    padding: spacing[4],
  },
  statusTitle: {
    ...font(700),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  warning: {
    flexDirection: 'row',
    gap: spacing[3],
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    backgroundColor: colors.warningFill,
    paddingVertical: spacing['3_5'],
    paddingHorizontal: spacing[4],
  },
  warningIcon: {
    paddingTop: 1,
  },
  warningText: {
    flex: 1,
    minWidth: 0,
    gap: spacing[1],
  },
  warningTitle: {
    ...font(700),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  warningBodyBanner: {
    ...font(400),
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  // UX §0.4 draws the notice text in warning-light (no token): the ladder places
  // it on text-strong-2 (reported).
  warningBody: {
    ...font(400),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textStrong2,
  },
  warningBodyTablet: {
    fontSize: 15,
    lineHeight: 22,
  },
});
