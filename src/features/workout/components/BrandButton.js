import { StyleSheet } from 'react-native';

import PillButton from '../../../shared/components/PillButton';

// RN-SPEC-v2-foundation §4.1: v1's gold-gradient HeroButton is retired; the
// gold actions (START TODAY'S WORKOUT, Resume) are the flat gold primary
// Button with the gold glow. The v1 props stay so call sites need no change.
// The Button owns its shape and type (pill, size, label), so `style` keeps
// only outer layout and `labelStyle` is accepted but no longer applied.
const BUTTON_OWNED = ['borderRadius', 'height', 'minHeight', 'padding', 'paddingVertical', 'paddingHorizontal', 'paddingTop', 'paddingBottom', 'boxShadow', 'backgroundColor'];

export function outerLayout(style) {
  const flat = StyleSheet.flatten(style);
  if (!flat) {
    return undefined;
  }
  const kept = { ...flat };
  BUTTON_OWNED.forEach((key) => delete kept[key]);
  return kept;
}

// `labelStyle` (v1) is still accepted by callers; it is not read.
export default function BrandButton({ label, onPress, loading = false, disabled = false, style, size, testID }) {
  return (
    <PillButton
      testID={testID}
      title={label}
      variant="primary"
      size={size}
      loading={loading}
      disabled={disabled}
      onPress={onPress}
      style={outerLayout(style)}
    />
  );
}
