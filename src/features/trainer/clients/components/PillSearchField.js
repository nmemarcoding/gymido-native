import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { CAP_BODY } from '../../../../shared/components/largeText';
import { colors, font, radii, spacing, textInputColors } from '../../../../shared/theme/tokens';
import { SearchGlyph } from './clientIcons';

// The trainer pages' pill search field (Clients; T-121 H1 Plans uses the same
// one): 52 tall on the phone, 48 on the tablet, the gold focus ring. The box
// is `${testID}-box`, the input `testID`.
export default function PillSearchField({ testID, label, value, onChangeText, tablet = false }) {
  const [focused, setFocused] = useState(false);
  return (
    <View testID={`${testID}-box`} style={[styles.search, tablet && styles.searchTablet, focused && styles.searchFocused]}>
      <View style={styles.searchIcon}>
        <SearchGlyph size={18} color={colors.textMuted} />
      </View>
      <TextInput
        {...textInputColors}
        {...CAP_BODY}
        testID={testID}
        accessibilityLabel={label}
        placeholder={label}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        style={[styles.searchInput, tablet && styles.searchInputTablet]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.choiceBorder,
    backgroundColor: colors.surface,
  },
  searchTablet: {
    minHeight: 48,
  },
  searchFocused: {
    borderColor: colors.gold,
    outlineWidth: 4,
    outlineColor: colors.goldFocus,
    outlineStyle: 'solid',
  },
  searchIcon: {
    paddingLeft: spacing[4],
    paddingRight: spacing['2_5'],
  },
  searchInput: {
    ...font(400),
    flex: 1,
    minHeight: 50,
    paddingRight: spacing[4],
    fontSize: 16,
    color: colors.textPrimary,
  },
  searchInputTablet: {
    minHeight: 46,
    fontSize: 15,
  },
});
