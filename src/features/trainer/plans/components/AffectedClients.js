import { StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '../../../../shared/theme/tokens';
import { formatAffectsNotice, formatClientsOnPlan } from '../planFormat';

// Spec §B1. Every count UI hides when the count is null (unknown/failed) or 0.
const hasCount = (count) => typeof count === 'number' && count > 0;

export function ClientsBanner({ count }) {
  if (!hasCount(count)) {
    return null;
  }
  return (
    <View testID="plan-clients-banner" accessibilityRole="summary" style={styles.banner}>
      <Text style={styles.bannerTitle}>{formatClientsOnPlan(count)}</Text>
      <Text style={styles.bannerBody}>
        Your edits reach them from their next workout. Past and in-progress workouts stay as they are.
      </Text>
    </View>
  );
}

// Boxed notice at the top of the edit modals.
export function AffectsNoticeBox({ count }) {
  if (!hasCount(count)) {
    return null;
  }
  return (
    <Text testID="affects-notice" style={styles.noticeBox}>
      {formatAffectsNotice(count)}
    </Text>
  );
}

// Plain notice line first in the action dialogs.
export function AffectsNoticeLine({ count }) {
  if (!hasCount(count)) {
    return null;
  }
  return (
    <Text testID="affects-notice" style={styles.noticeLine}>
      {formatAffectsNotice(count)}
    </Text>
  );
}

export function InactiveBanner({ body }) {
  return (
    <View testID="plan-inactive-banner" accessibilityRole="summary" style={styles.banner}>
      <Text style={styles.bannerTitle}>This plan is inactive</Text>
      <Text style={styles.bannerBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: 16,
  },
  bannerTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  bannerBody: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  noticeBox: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingVertical: 12,
    paddingHorizontal: 16,
    overflow: 'hidden',
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  noticeLine: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
