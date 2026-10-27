import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import FeedbackIcon from '../../../shared/components/FeedbackIcon';
import GradientFill from '../../../shared/components/GradientFill';
import { muscleColor } from '../../../shared/components/ExerciseImage';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { colors, font, gradients, layout, radii, spacing, textScale, typography } from '../../../shared/theme/tokens';
import { CheckIcon } from './GeneratorIcons';

// Controls of RN-SPEC-PLAN-GENERATOR §G1.2 and the G2 callouts. v2 Phase 4 J
// look (UX phase4/J-generator.md + its rulings Look 1–5): selected = the gold
// ring + ✓ only (no glows), disabled = 0.5 with the ✓ slot reserved, the
// callouts in the kit info / warning tone with their icon. Pressed = the rest
// colour + a 4 % overlay (§8.6 STATE RULE).

// UX §9 large text: every label here is body/label text (scales to 2×, never
// truncated: labels wrap and the controls grow from their min heights).
const BODY_TEXT = Object.freeze({ maxFontSizeMultiplier: textScale.body });

// The §8.6 press overlay: a full-bleed View over the rest colour.
function PressOverlay({ pressed, ink = false }) {
  return pressed ? (
    <View testID="press-overlay" pointerEvents="none" style={[StyleSheet.absoluteFill, ink ? styles.overlayInk : styles.overlay]} />
  ) : null;
}

// The Choice's trailing 30 px indicator: a 1.5 px hairline-bright ring when
// off, the gold disc with ✓ when on. Always present, so the row never shifts.
function Check({ on }) {
  return (
    <View
      testID={on ? 'choice-check' : 'choice-check-slot'}
      style={[styles.check, on && styles.checkOn]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {on ? <CheckIcon size={16} color={colors.onGold} /> : null}
    </View>
  );
}

// Step 1's 52 icon tile (radius 16). Selected: gold + on-gold icon; off:
// fill-glass + text-strong-2 icon, or the teal tile (teal-tint + teal) as
// drawn on the third goal. Decorative.
function IconTile({ selected, tone, renderIcon }) {
  const teal = tone === 'teal';
  const color = selected ? colors.onGold : teal ? colors.teal : colors.textStrong2;
  return (
    <View
      testID="choice-icon-tile"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.iconTile, selected ? styles.iconTileOn : teal ? styles.iconTileTeal : styles.iconTileOff]}
    >
      {renderIcon({ color })}
    </View>
  );
}

// The choice card (radio). PlanGenerator board: row, gap 14, padding 0 18,
// radius 26 drawn (no token → radius-2xl 28), min-height 88 with the icon tile
// (step 1, label 20/24/700) and 72 without (steps 2 and 5, label 18/22/700).
// Off = gradient-card + 1 px 0.08 edge; selected = gradient-gold-select + the
// 2 px inset gold ring (U7). The fill layer mounts with the card (SVG; never
// added on a state change) and only its colours change. Pressed: the overlay,
// scale 0.98 (not with reduced motion) and the ring in gold-deep. A disabled
// preset: dashed 0.12 edge, no fill, muted text + its hint, opacity 0.5.
export function Choice({ label, hint, selected, disabled = false, onPress, testID, renderIcon, iconTone }) {
  const reduced = useReducedMotion();
  const withIcon = typeof renderIcon === 'function';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityLabel={hint ? `${label}, ${hint}` : label}
      accessibilityState={{ selected, checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        withIcon ? styles.choiceWithIcon : styles.choicePlain,
        disabled ? styles.choiceDisabled : selected ? styles.choiceOn : styles.choiceOff,
        pressed && !disabled && selected && styles.choiceOnPressed,
        pressed && !disabled && !reduced && styles.choicePressedScale,
        disabled && styles.disabled,
      ]}
    >
      {({ pressed }) => (
        <>
          {disabled ? null : <GradientFill angle={selected ? gradients.goldSelect.angle : gradients.card.angle} colors={selected ? gradients.goldSelect.colors : gradients.card.colors} />}
          <PressOverlay pressed={pressed && !disabled} />
          {withIcon ? <IconTile selected={selected} tone={iconTone} renderIcon={renderIcon} /> : null}
          <View style={styles.flex}>
            <Text {...BODY_TEXT} style={[withIcon ? styles.choiceLabel : styles.choiceLabelPlain, disabled && styles.textMuted]}>
              {label}
            </Text>
            {hint ? (
              <Text {...BODY_TEXT} style={styles.choiceHint}>
                {hint}
              </Text>
            ) : null}
          </View>
          <Check on={Boolean(selected)} />
        </>
      )}
    </Pressable>
  );
}

// Dated change 27 Oct: the single-choice steps are a radio group (native:
// role radiogroup + its name; each option a radio with its checked state).
export function ChoiceList({ children, label, testID }) {
  return (
    <View testID={testID} accessibilityRole={label ? 'radiogroup' : undefined} accessibilityLabel={label} style={styles.choiceList}>
      {children}
    </View>
  );
}

// Option pills. Sizes (UX J, Look 1–3):
// - default: 40 tall glass pill (kept for callers outside the steps);
// - large (steps 3–4, derived): 52 tall, min-width 96, padding 0 20, 16/600,
//   flat gold when selected (no shadow);
// - focus (phone step 6): 46 tall, padding 0 18, 14/20; off = surface + 1 px
//   0.12 edge + text-strong-2 500; on = gold + on-gold 700 + ✓;
// - focusTablet: the same at 44 tall and 15 px;
// - reason (avoided row): 38 tall, padding 0 14, 14; on = the light fill +
//   on-light 600; off = transparent + 1 px hairline-strong + text-strong-2.
// Every pill has a 44 hit area and a reserved ✓ slot (never changes width).
const PILL_SIZES = {
  default: { height: 40, pad: spacing['3_5'], fontSize: 14, lineHeight: 20 },
  large: { height: 52, pad: spacing[5], fontSize: 16, lineHeight: 20, minWidth: 96 },
  focus: { height: 46, pad: spacing['4_5'], fontSize: 14, lineHeight: 20 },
  focusTablet: { height: 44, pad: spacing['4_5'], fontSize: 15, lineHeight: 20 },
  reason: { height: 38, pad: spacing['3_5'], fontSize: 14, lineHeight: 18 },
};
export const PILL_SIZE_NAMES = Object.freeze(Object.keys(PILL_SIZES));

const hitSlopFor = (height) => {
  const slop = Math.max(0, (layout.touchMin - height) / 2);
  return { top: slop, bottom: slop, left: 0, right: 0 };
};

function pillLook(size, selected) {
  if (size === 'reason') {
    return selected
      ? { box: styles.reasonOn, text: styles.reasonTextOn, ink: true, check: colors.onLight }
      : { box: styles.reasonOff, text: styles.reasonTextOff, ink: false, check: colors.onLight };
  }
  if (size === 'focus' || size === 'focusTablet') {
    return selected
      ? { box: styles.pillOn, text: styles.focusTextOn, ink: true, check: colors.onGold }
      : { box: styles.focusOff, text: styles.focusTextOff, ink: false, check: colors.onGold };
  }
  return selected
    ? { box: styles.pillOn, text: styles.pillTextOn, ink: true, check: colors.onGold }
    : { box: styles.pillRest, text: styles.pillTextOff, ink: false, check: colors.onGold };
}

export function OptionPill({
  label,
  selected,
  disabled = false,
  onPress,
  testID,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityHint,
  size = 'default',
}) {
  const metrics = PILL_SIZES[size] ?? PILL_SIZES.default;
  const look = pillLook(size, selected);
  const radio = accessibilityRole === 'radio';
  return (
    <Pressable
      testID={testID}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={radio ? { selected, checked: selected, disabled } : { selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={hitSlopFor(metrics.height)}
      style={[
        styles.pill,
        { minHeight: metrics.height, paddingHorizontal: metrics.pad, minWidth: metrics.minWidth },
        look.box,
        disabled && styles.disabled,
      ]}
    >
      {({ pressed }) => (
        <>
          {/* §8.6: pressed gold/light = + ink 4 %; pressed dark = + white 4 %. */}
          <PressOverlay pressed={pressed && !disabled} ink={look.ink} />
          <View style={styles.pillContent}>
            {/* Design system v1 #15 (kept in v2): a leading ✓ when selected; its
                space is always reserved (transparent when off). */}
            <View testID={selected ? 'pill-check' : 'pill-check-slot'} style={[styles.pillCheck, !selected && styles.pillCheckOff]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <CheckIcon size={12} color={look.check} />
            </View>
            <Text {...BODY_TEXT} style={[styles.pillText, { fontSize: metrics.fontSize, lineHeight: metrics.lineHeight }, look.text]}>
              {label}
            </Text>
          </View>
        </>
      )}
    </Pressable>
  );
}

// A wrapping pill row; `label` makes it a named radio group (steps 3–4).
export function PillRow({ children, style, gap, label, testID }) {
  return (
    <View
      testID={testID}
      accessibilityRole={label ? 'radiogroup' : undefined}
      accessibilityLabel={label}
      style={[styles.pillRow, gap !== undefined && { gap }, style]}
    >
      {children}
    </View>
  );
}

// §4.6 Checkbox: 24 × 24, radius 8. Off: a 1.5 px border; on: gold fill + a
// dark ✓. The caller's row (min-height 44) is the hit target.
export function Checkbox({ checked }) {
  return (
    <View
      style={[styles.checkbox, checked ? styles.checkboxOn : styles.checkboxOff]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {checked ? (
        <Svg testID="checkbox-mark" width={14} height={14} viewBox="0 0 24 24" fill="none">
          <Path d="M5 12l5 5L20 7" stroke={colors.onGold} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ) : null}
    </View>
  );
}

// The step progress: 6 segments, done/current gold, the rest white 0.12
// (hairline-button). Phone 4 tall gap 5, tablet 5 tall gap 6. Read once as
// "Step n of 6" (never per segment).
export function ProgressSegments({ step, total, tablet = false, label }) {
  const segments = [];
  for (let index = 1; index <= total; index += 1) {
    segments.push(
      <View
        key={index}
        testID={index <= step ? 'progress-segment-on' : 'progress-segment-off'}
        style={[styles.segment, tablet ? styles.segmentTablet : styles.segmentPhone, index <= step ? styles.segmentOn : styles.segmentOff]}
      />
    );
  }
  return (
    <View
      testID="generator-progress"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: total, now: step }}
      style={[styles.segments, tablet ? styles.segmentsTablet : styles.segmentsPhone]}
    >
      {segments}
    </View>
  );
}

// Look 5: the muscle label = text-muted with a 6 px muscle-colour dot first
// (an unknown muscle: a text-muted dot). The colour is never the only cue.
export function MuscleLabel({ name, code, style, testID = 'muscle-label' }) {
  if (!name) {
    return null;
  }
  return (
    <View testID={testID} style={styles.muscleRow}>
      <View testID="muscle-dot" style={[styles.muscleDot, { backgroundColor: muscleColor(code) ?? colors.textMuted }]} />
      <Text {...BODY_TEXT} style={[styles.muscleText, style]}>
        {name}
      </Text>
    </View>
  );
}

// §5 Callout, v2 J (Look 4): the info tone (info fill + line, text-primary,
// the info icon) and the warning tone (warning tint + line, text-primary,
// the "!" icon); never colour alone. The teal tone (the refusal's
// what-to-change) keeps teal-faint / teal-line / teal-text with no icon.
const CALLOUT_TONES = {
  info: { box: { borderColor: colors.infoLine, backgroundColor: colors.infoFaint }, icon: 'info', iconColor: colors.info },
  warning: { box: { borderColor: colors.warningLine, backgroundColor: colors.warningTint }, icon: 'warning', iconColor: colors.warning },
  teal: { box: { borderColor: colors.tealLine, backgroundColor: colors.tealFaint }, icon: null, text: { color: colors.tealText } },
};

// `role` is passed through (T-18: the GO_EASY_AREAS note is role="note").
export function Callout({ tone = 'info', children, testID, style, role }) {
  const look = CALLOUT_TONES[tone] ?? CALLOUT_TONES.info;
  return (
    <View testID={testID} role={role} style={[styles.callout, look.box, style]}>
      {look.icon ? (
        <View testID={testID ? `${testID}-icon` : 'callout-icon'} style={styles.calloutIcon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <FeedbackIcon name={look.icon} size={16} color={look.iconColor} />
        </View>
      ) : null}
      <Text {...BODY_TEXT} style={[styles.calloutText, look.text]}>
        {children}
      </Text>
    </View>
  );
}

// Batch B #2: a decorative sparkle.
export function SparkleIcon({ size = 14, color = colors.gold }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Path
        d="M12 2l1.9 5.6c.3.9 1 1.6 1.9 1.9L21.4 11.4c.4.1.4.7 0 .8l-5.6 1.9c-.9.3-1.6 1-1.9 1.9L12 21.6c-.1.4-.7.4-.8 0l-1.9-5.6c-.3-.9-1-1.6-1.9-1.9L1.8 12.2c-.4-.1-.4-.7 0-.8l5.6-1.9c.9-.3 1.6-1 1.9-1.9L11.2 2c.1-.4.7-.4.8 0z"
        fill={color}
      />
    </Svg>
  );
}

// Batch B #2 why-line, read as one sentence. Phone (GeneratorPreview): the
// gold sparkle + "Why this:" 13/600 gold + the text 13/18 text-secondary.
// Tablet (TabletGeneratorPreview): no icon, 13 text-muted with "Why this:"
// 600 text-strong-2.
export function WhyLine({ text, style, tablet = false }) {
  return (
    <View accessible accessibilityLabel={`Why this: ${text}`} style={[styles.whyRow, style]}>
      {tablet ? null : (
        <View style={styles.whyIcon}>
          <SparkleIcon />
        </View>
      )}
      <Text {...BODY_TEXT} style={[styles.whyText, tablet && styles.whyTextTablet]}>
        <Text style={[styles.whyLabel, tablet && styles.whyLabelTablet]}>Why this: </Text>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    minWidth: 0,
  },
  textMuted: {
    color: colors.textMuted,
  },
  choiceList: {
    gap: spacing['2_5'],
  },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['3_5'],
    // Drawn radius 26: no token, the nearest is radius-2xl 28 (reported).
    borderRadius: radii.xxl,
    // Always 1 px so the card keeps its size when it turns on.
    borderWidth: 1,
    paddingHorizontal: spacing['4_5'],
    paddingVertical: spacing[3],
    // Clips the fill layer and the press overlay to the radius.
    overflow: 'hidden',
  },
  choiceWithIcon: {
    minHeight: 88,
  },
  choicePlain: {
    minHeight: 72,
  },
  choiceOff: {
    borderColor: colors.choiceBorder,
  },
  // The 1 px gold border + a 1 px inset = the 2 px gold ring (U7).
  choiceOn: {
    borderColor: colors.gold,
    boxShadow: `inset 0px 0px 0px 1px ${colors.gold}`,
  },
  choiceOnPressed: {
    borderColor: colors.goldDeep,
    boxShadow: `inset 0px 0px 0px 1px ${colors.goldDeep}`,
  },
  choicePressedScale: {
    transform: [{ scale: 0.98 }],
  },
  choiceDisabled: {
    borderColor: colors.hairlineButton,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  overlay: {
    backgroundColor: colors.pressOverlay,
  },
  overlayInk: {
    backgroundColor: colors.pressOverlayInk,
  },
  disabled: {
    opacity: 0.5,
  },
  choiceLabel: {
    ...font(700),
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.4,
    color: colors.textPrimary,
  },
  choiceLabelPlain: {
    ...font(700),
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: -0.36,
    color: colors.textPrimary,
  },
  choiceHint: {
    ...font(500),
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  iconTile: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTileOn: {
    backgroundColor: colors.gold,
  },
  // Drawn white 0.07 → fill-glass 0.08 (U8: icon tiles).
  iconTileOff: {
    backgroundColor: colors.fillGlass,
  },
  iconTileTeal: {
    backgroundColor: colors.tealTint,
  },
  check: {
    width: 30,
    height: 30,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: colors.hairlineBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: {
    borderColor: colors.gold,
    backgroundColor: colors.gold,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  pill: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radii.full,
    borderWidth: 1,
    // §9: a wrapped label grows the pill from its minimum.
    paddingVertical: spacing[2],
    // Clips the press overlay to the pill.
    overflow: 'hidden',
  },
  pillOn: {
    borderColor: colors.gold,
    backgroundColor: colors.gold,
  },
  pillRest: {
    borderColor: colors.hairlineButton,
    backgroundColor: colors.fillButton,
  },
  focusOff: {
    borderColor: colors.hairlineButton,
    backgroundColor: colors.surface,
  },
  reasonOn: {
    borderColor: colors.textPrimary,
    backgroundColor: colors.textPrimary,
  },
  reasonOff: {
    borderColor: colors.hairlineStrong,
    backgroundColor: 'transparent',
  },
  pillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['1_5'],
  },
  pillCheck: {
    width: 12,
    height: 12,
  },
  pillCheckOff: {
    opacity: 0,
  },
  pillText: {
    ...font(600),
    flexShrink: 1,
  },
  pillTextOn: {
    color: colors.onGold,
  },
  pillTextOff: {
    color: colors.textPrimary,
  },
  focusTextOn: {
    ...font(700),
    color: colors.onGold,
  },
  // Drawn text-strong (the 0xE4E6EA grey) → text-strong-2 (§8.6 fold).
  focusTextOff: {
    ...font(500),
    color: colors.textStrong2,
  },
  reasonTextOn: {
    ...font(600),
    color: colors.onLight,
  },
  reasonTextOff: {
    ...font(500),
    color: colors.textStrong2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOff: {
    borderColor: colors.checkboxBorder,
  },
  checkboxOn: {
    borderColor: colors.gold,
    backgroundColor: colors.gold,
  },
  segments: {
    flexDirection: 'row',
  },
  segmentsPhone: {
    gap: 5,
  },
  segmentsTablet: {
    gap: 6,
  },
  segment: {
    flex: 1,
    borderRadius: radii.full,
  },
  segmentPhone: {
    height: 4,
  },
  segmentTablet: {
    height: 5,
  },
  segmentOn: {
    backgroundColor: colors.gold,
  },
  segmentOff: {
    backgroundColor: colors.hairlineButton,
  },
  muscleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['1_5'],
  },
  muscleDot: {
    width: 6,
    height: 6,
    borderRadius: radii.full,
  },
  muscleText: {
    ...typography.caption,
    flexShrink: 1,
    color: colors.textMuted,
  },
  callout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing['2_5'],
    // Drawn radius 18: no token, the nearest is radius-md 16 (reported).
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing['3_5'],
    paddingVertical: spacing[3],
  },
  calloutIcon: {
    paddingTop: 1,
  },
  calloutText: {
    ...font(400),
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textPrimary,
  },
  whyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing['1_5'],
  },
  whyIcon: {
    paddingTop: 2,
  },
  whyText: {
    ...typography.label,
    ...font(400),
    flex: 1,
    color: colors.textSecondary,
  },
  whyTextTablet: {
    color: colors.textMuted,
  },
  whyLabel: {
    ...font(600),
    color: colors.gold,
  },
  whyLabelTablet: {
    color: colors.textStrong2,
  },
});
