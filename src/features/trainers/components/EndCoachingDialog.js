import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import AppModal, { isTabletWidth } from '../../../shared/components/AppModal';
import { useLargeTextReflow } from '../../../shared/components/largeText';
import PillButton from '../../../shared/components/PillButton';
import { colors, radii, spacing } from '../../../shared/theme/tokens';

// The End coaching confirm (UX L "End coaching" / "Tablet: End coaching" =
// the member, `variant="member"`; UX M "End coaching client" / "Tablet: End
// coaching client" = the trainer, `variant="client"`). Behaviour, copy and
// testIDs are the ConfirmDialog ones it replaces (Cancel = `${testID}-cancel`,
// the verb = `${testID}-confirm`, `dismissible` false makes Cancel / scrim /
// Back do nothing). LOOK: the danger icon tile above the title (AppModal
// `eyebrow` slot), the board footers (phone stacked, verb on top; tablet a row,
// Cancel left, the verb wider on the right, both 60).
//
// Board values without a token (reported): the member phone tile radius 18
// (→ radii.lg 20), the tile fill danger-text at 14 % (→ dangerTint, the
// danger-dot at 14 % the member tablet board draws), the tile / card danger
// glows and the confirm's red drop shadow (not built: they need AppModal).
export const END_COACHING_TILE = Object.freeze({
  member: Object.freeze({ phone: { size: 56, radius: radii.lg, icon: 26 }, tablet: { size: 64, radius: radii.lg, icon: 28 } }),
  client: Object.freeze({ phone: { size: 72, radius: radii.xl, icon: 26 }, tablet: { size: 76, radius: radii.xl, icon: 34 } }),
});

// Tablet row: Cancel flex 1, the verb 1.4 (member board) / 1.3 (client board).
const CONFIRM_FLEX = Object.freeze({ member: 1.4, client: 1.3 });

function EndCoachingIcon({ size, tablet }) {
  // Phone boards: a person with a minus line; tablet boards: a person with ×.
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colors.dangerText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={9} cy={8} r={4} />
      <Path d={tablet ? 'M2 21a7 7 0 0 1 14 0M17 8l5 5M22 8l-5 5' : 'M2 21a7 7 0 0 1 14 0M16 11h6'} />
    </Svg>
  );
}

export default function EndCoachingDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  loading = false,
  dismissible = true,
  variant = 'member',
  testID,
}) {
  const { width } = useWindowDimensions();
  const tablet = isTabletWidth(width);
  const stacked = useLargeTextReflow();
  const row = tablet && !stacked;
  const kind = variant === 'client' ? 'client' : 'member';
  const tile = END_COACHING_TILE[kind][tablet ? 'tablet' : 'phone'];

  const close = () => {
    if (dismissible) {
      onClose();
    }
  };

  const icon = (
    <View
      testID={testID ? `${testID}-icon` : undefined}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.tile, tablet && styles.tileTablet, { width: tile.size, height: tile.size, borderRadius: tile.radius }]}
    >
      <EndCoachingIcon size={tile.icon} tablet={tablet} />
    </View>
  );

  // Phone: the member's verb is 60 and Cancel 56; the client's both 56.
  // Tablet: both 60 (cta).
  const confirmButton = (
    <PillButton
      testID={testID ? `${testID}-confirm` : undefined}
      title={confirmLabel}
      variant="danger"
      size={tablet || kind === 'member' ? 'cta' : 'default'}
      style={!tablet && kind === 'client' ? styles.phone56 : undefined}
      fullWidth
      loading={loading}
      onPress={onConfirm}
    />
  );
  const cancelButton = (
    <PillButton
      testID={testID ? `${testID}-cancel` : undefined}
      title={cancelLabel}
      variant="secondary"
      size={tablet ? 'cta' : 'default'}
      style={tablet ? undefined : styles.phone56}
      fullWidth
      onPress={close}
    />
  );

  return (
    <AppModal
      testID={testID}
      isOpen={isOpen}
      onClose={close}
      title={title}
      description={description}
      size="md"
      eyebrow={icon}
      // UX M: the trainer's confirm has Cancel and no ✕; UX L keeps the tablet
      // Close (36 glass, 44 hit) on the member's.
      hideClose={kind === 'client'}
      footer={
        <View testID={testID ? `${testID}-actions` : undefined} style={row ? styles.actionsRow : styles.actionsStacked}>
          {row ? <View style={styles.cancelCell}>{cancelButton}</View> : cancelButton}
          {row ? <View style={{ flex: CONFIRM_FLEX[kind] }}>{confirmButton}</View> : confirmButton}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerTint,
    marginBottom: spacing[4],
  },
  tileTablet: {
    marginBottom: spacing[5],
  },
  phone56: {
    minHeight: 56,
  },
  // Phone (and tablet past 1.3×): stacked, the verb on top, gap 10.
  actionsStacked: {
    flexDirection: 'column-reverse',
    gap: spacing['2_5'],
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  cancelCell: {
    flex: 1,
  },
});
