import { StyleSheet, Text, View } from 'react-native';

import { colors, font, radii, spacing } from '../theme/tokens';
import FeedbackIcon from './FeedbackIcon';
import { CAP_BODY, TITLE_TEXT, useLargeTextReflow } from './largeText';
import PillButton from './PillButton';

// RN-SPEC-v2-foundation §5: a centred card: 44 px icon tile, title 15/600,
// message 13 muted, optional action; a polite live region. Each screen passes
// its own copy (as in v1); the defaults are UX's. `icon="error"` draws the
// danger-text disc instead of the tile (the route error screen).
export const EMPTY_STATE_DEFAULTS = Object.freeze({
  title: 'Nothing to show yet',
  message: 'Once data is available, it will appear here.',
});

export default function EmptyState({
  title = EMPTY_STATE_DEFAULTS.title,
  message = EMPTY_STATE_DEFAULTS.message,
  actionLabel,
  onAction,
  actionTestID,
  icon = 'empty',
  // Opt-in polite live region (review, 26 Oct): most empty states render with
  // the page and must not be re-announced; a state that appears later can.
  live = false,
  style,
}) {
  const error = icon === 'error';
  // UX §9 rule 4: past 1.3× the action goes full width (primary on top).
  const stacked = useLargeTextReflow();
  return (
    <View accessibilityLiveRegion={live ? 'polite' : undefined} style={[styles.card, style]}>
      <View testID={error ? 'empty-state-error-icon' : 'empty-state-icon'} style={[styles.tile, error && styles.errorDisc]}>
        <FeedbackIcon name={error ? 'error' : 'empty'} size={20} color={error ? colors.dangerText : colors.textSecondary} />
      </View>
      <Text {...TITLE_TEXT} style={styles.title}>
        {title}
      </Text>
      {message ? <Text {...CAP_BODY} style={styles.message}>{message}</Text> : null}
      {actionLabel ? (
        <View testID="empty-state-action" style={[styles.action, stacked && styles.actionStacked]}>
          <PillButton testID={actionTestID} title={actionLabel} variant="secondary" onPress={onAction} fullWidth={stacked} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    padding: spacing[5],
    alignItems: 'center',
    gap: spacing[2],
  },
  tile: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.fillSkeleton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorDisc: {
    borderRadius: radii.full,
    backgroundColor: colors.dangerTextTint,
  },
  title: {
    ...font(600),
    fontSize: 15,
    lineHeight: 22,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  message: {
    ...font(400),
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    textAlign: 'center',
  },
  action: {
    marginTop: spacing[2],
  },
  actionStacked: {
    alignSelf: 'stretch',
  },
});
