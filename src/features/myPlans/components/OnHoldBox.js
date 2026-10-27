import { StyleSheet } from 'react-native';

import Banner, { BannerText } from '../../../shared/components/Banner';
import { colors, radii } from '../../../shared/theme/tokens';
import { ON_HOLD_TAIL } from '../myPlanFormat';

// §M1 / §M3.3: shown on a 403 (chosen by status, never by text). v2 look:
// the warning banner (RN-SPEC-v2-foundation §5).
export default function OnHoldBox({ message }) {
  return (
    <Banner testID="my-plans-on-hold" title="Your plans are on hold" accessibilityLiveRegion="polite">
      {message ? <BannerText>{message}</BannerText> : null}
      <BannerText>{ON_HOLD_TAIL}</BannerText>
    </Banner>
  );
}

// M3's "This is your current plan" box (no longer shared with the on-hold
// banner; restyled with My plans in its own phase).
export const statusBoxStyles = StyleSheet.create({
  box: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: 16,
  },
  title: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  body: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSecondary,
  },
});

