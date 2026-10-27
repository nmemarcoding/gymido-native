import { StyleSheet, Text, View } from 'react-native';

import Banner, { BannerText } from '../../../../shared/components/Banner';
import { colors, font, radii, spacing } from '../../../../shared/theme/tokens';
import { formatAffectsNotice, formatClientsOnPlan } from '../planFormat';

// Spec §B1. Every count UI hides when the count is null (unknown/failed) or 0.
const hasCount = (count) => typeof count === 'number' && count > 0;

// v2 look (RN-SPEC-v2-foundation §5 AffectedClients): a plain card.
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

// v2 look (§5 Banners): the warning banner, its title in warning with the icon.
export function InactiveBanner({ body }) {
  return (
    <Banner testID="plan-inactive-banner" title="This plan is inactive" warningTitle>
      <BannerText>{body}</BannerText>
    </Banner>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    padding: spacing['4_5'],
    gap: spacing[1],
  },
  bannerTitle: {
    ...font(600),
    fontSize: 15,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  bannerBody: {
    ...font(400),
    fontSize: 13,
    lineHeight: 18,
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
