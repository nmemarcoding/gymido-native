import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';

import { colors, font, radii, spacing } from '../theme/tokens';
import FeedbackIcon from './FeedbackIcon';
import GradientFill from './GradientFill';
import { CAP_BODY } from './largeText';

// RN-SPEC-v2-foundation §5 FeedbackBox / ErrorBox (native inline result):
// radius 16, padding 12 14, the tone's fill + border at 0.25, always an icon,
// a bold title over the muted message.
export const FEEDBACK_TONES = Object.freeze({
  error: Object.freeze({ icon: 'error', iconColor: colors.dangerText, backgroundColor: colors.dangerTextFill, borderColor: colors.dangerTextBorder }),
  success: Object.freeze({ icon: 'check', iconColor: colors.success, backgroundColor: colors.successFeedbackFill, borderColor: colors.successFeedbackBorder }),
});

export function FeedbackBox({ tone, title, message, testID, accessibilityRole, accessibilityLiveRegion, titleStyle, messageStyle, ref }) {
  const look = FEEDBACK_TONES[tone] ?? FEEDBACK_TONES.error;
  return (
    <View
      ref={ref}
      testID={testID}
      accessibilityRole={accessibilityRole ?? (tone === 'success' ? 'summary' : 'alert')}
      accessibilityLiveRegion={accessibilityLiveRegion}
      style={[styles.box, { borderColor: look.borderColor, backgroundColor: look.backgroundColor }]}
    >
      <View style={styles.icon}>
        <FeedbackIcon name={look.icon} size={18} color={look.iconColor} />
      </View>
      <View style={styles.text}>
        {title ? <Text {...CAP_BODY} style={[styles.title, titleStyle]}>{title}</Text> : null}
        {message ? <Text {...CAP_BODY} style={[styles.message, messageStyle]}>{message}</Text> : null}
      </View>
    </View>
  );
}

// InlineError and SuccessState (profile-create spec §6): a title (600) and
// the message under it.
// InlineError (RN-SPEC-v2-phase2 §D1; the State boards' colours, D's kit
// folds): the danger card (fill dangerFaint, edge dangerLine), an icon tile
// with the 150° dangerLine → dangerFaint gradient and a dangerLine edge, the
// icon and title in dangerText (U1: icons take the text colour) and the
// message in dangerTextSoft. Role alert, announced when it mounts (and when
// its text changes), assertive on Android.
export const INLINE_ERROR_TILE = 32;

export function InlineError({ title = 'Something went wrong', message, testID, ref }) {
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility([title, message].filter(Boolean).join('. '));
  }, [title, message]);
  return (
    <View
      ref={ref}
      testID={testID}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={[styles.box, styles.inlineErrorBox]}
    >
      <View testID="inline-error-icon" style={styles.inlineErrorTile}>
        {/* Mounted with the tile, never added on a state change (SVG). */}
        <GradientFill angle={150} colors={[colors.dangerLine, colors.dangerFaint]} />
        <FeedbackIcon name="error" size={18} color={colors.dangerText} />
      </View>
      <View style={styles.text}>
        {title ? <Text {...CAP_BODY} style={[styles.title, styles.inlineErrorTitle]}>{title}</Text> : null}
        {message ? <Text {...CAP_BODY} style={[styles.message, styles.inlineErrorMessage]}>{message}</Text> : null}
      </View>
    </View>
  );
}

export function SuccessState({ title = 'Success', message, testID }) {
  return <FeedbackBox tone="success" title={title} message={message} testID={testID} />;
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing['2_5'],
    borderRadius: radii.md,
    borderWidth: 1,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing['3_5'],
  },
  icon: {
    marginTop: 1,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...font(600),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  inlineErrorBox: {
    backgroundColor: colors.dangerFaint,
    borderColor: colors.dangerLine,
  },
  inlineErrorTile: {
    width: INLINE_ERROR_TILE,
    height: INLINE_ERROR_TILE,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.dangerLine,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineErrorTitle: {
    color: colors.dangerText,
  },
  inlineErrorMessage: {
    color: colors.dangerTextSoft,
  },
  message: {
    ...font(400),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
});
