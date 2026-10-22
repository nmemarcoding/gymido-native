import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BlurLayer from '../../../../shared/components/BlurLayer';
import Select from '../../../../shared/components/Select';
import { useKeyboardHeight } from '../../../../shared/hooks/useKeyboardHeight';
import { useReducedMotion } from '../../../../shared/hooks/useReducedMotion';
import { breakpoints, colors, motion, radii, shadows } from '../../../../shared/theme/tokens';
import { ALL_EQUIPMENT, ALL_MUSCLE_GROUPS, countLabel, filterCatalog } from '../planFormat';
import ExerciseThumb from './ExerciseThumb';
import { CheckIcon, ChevronIcon, SearchIcon } from './pickerIcons';

const EASE_OUT = Easing.bezier(0, 0, 0.58, 1);

// T5 (spec §A7.2–§A7.3). `onAddSelected(exercises)` runs the add loop; the
// sheet closes when it settles. No in-flight guard (⚠T5-2).
export default function ExercisePickerSheet({
  isOpen,
  onClose,
  catalog,
  loading,
  muscleGroups,
  equipmentTypes,
  addedIds,
  onAddSelected,
}) {
  const { width, height } = useWindowDimensions();
  const wide = width >= breakpoints.sm;
  const narrow = width <= 400;
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const keyboardHeight = useKeyboardHeight();
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState(ALL_MUSCLE_GROUPS);
  const [equipment, setEquipment] = useState(ALL_EQUIPMENT);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [searchFocused, setSearchFocused] = useState(false);
  const scrim = useRef(new Animated.Value(0)).current;
  const sheet = useRef(new Animated.Value(0)).current;
  const wasOpen = useRef(isOpen);

  // Lifecycle pairing: everything resets on the open → closed edge.
  useEffect(() => {
    if (wasOpen.current && !isOpen) {
      setSearch('');
      setMuscle(ALL_MUSCLE_GROUPS);
      setEquipment(ALL_EQUIPMENT);
      setSelectedIds(new Set());
    }
    wasOpen.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      scrim.setValue(0);
      sheet.setValue(0);
      return undefined;
    }
    if (reducedMotion) {
      scrim.setValue(1);
      sheet.setValue(1);
      return undefined;
    }
    // ⚠ No entrance animation for the sheet at ≥640 (its web keyframes are missing).
    const animations = [
      Animated.timing(scrim, { toValue: 1, duration: motion.fadeMs, easing: EASE_OUT, useNativeDriver: true }),
    ];
    if (wide) {
      sheet.setValue(1);
    } else {
      animations.push(
        Animated.timing(sheet, { toValue: 1, duration: motion.slideUpMs, easing: EASE_OUT, useNativeDriver: true })
      );
    }
    const animation = Animated.parallel(animations);
    animation.start();
    return () => animation.stop();
  }, [isOpen, reducedMotion, scrim, sheet, wide]);

  const visible = useMemo(
    () => filterCatalog(catalog, { search, muscle, equipment }),
    [catalog, search, muscle, equipment]
  );

  function toggle(id) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function addSelected() {
    // Catalog order, not tap order.
    const selected = catalog.filter((exercise) => selectedIds.has(exercise.id));
    await onAddSelected(selected);
    setSelectedIds(new Set());
    onClose();
  }

  const selectedCount = selectedIds.size;
  const gutter = wide ? 28 : 20;
  const muscleOptions = [
    { value: ALL_MUSCLE_GROUPS, label: ALL_MUSCLE_GROUPS },
    ...muscleGroups.map((group) => ({ value: group.name, label: group.name })),
  ];
  const equipmentOptions = [
    { value: ALL_EQUIPMENT, label: ALL_EQUIPMENT },
    ...equipmentTypes.map((type) => ({ value: String(type.id), label: type.name })),
  ];
  const sheetTranslate = sheet.interpolate({ inputRange: [0, 1], outputRange: [motion.slideUpOffsetY, 0] });

  return (
    <Modal transparent visible={isOpen} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View
        style={[
          styles.scrim,
          wide ? styles.scrimWide : styles.scrimPhone,
          { opacity: scrim, paddingBottom: keyboardHeight },
        ]}
      >
        <BlurLayer blurPx={4} overApp />
        <Pressable style={[styles.inset, styles.scrimColor]} onPress={onClose} accessibilityLabel="Close" />
        <Animated.View
          testID="exercise-picker"
          accessibilityViewIsModal
          style={[
            styles.sheet,
            wide ? styles.sheetWide : styles.sheetPhone,
            {
              // An open keyboard lifts the sheet and takes its space.
              height: keyboardHeight > 0 ? Math.min(height * 0.86, height - keyboardHeight - insets.top - 24) : height * 0.86,
              opacity: sheet,
              transform: [{ translateY: sheetTranslate }],
            },
          ]}
        >
          {wide ? null : <View style={styles.grabber} />}
          <View style={{ paddingHorizontal: gutter, paddingTop: wide ? 24 : 16, paddingBottom: wide ? 16 : 12 }}>
            <Text accessibilityRole="header" style={[styles.title, wide && styles.titleWide]}>
              Add exercise
            </Text>
            <Text style={styles.subtitle}>Search and select exercises to add to this day.</Text>
          </View>

          <View style={[styles.filters, { paddingHorizontal: gutter, paddingBottom: wide ? 16 : 12, gap: wide ? 12 : 8 }]}>
            <View style={wide ? styles.thirdCell : styles.fullCell}>
              <Text style={[styles.filterLabel, wide && styles.filterLabelWide]}>Search</Text>
              {/* The border lives on the row, so the icon and its 36 px inset stay
                  put on Android once text is entered. */}
              <View style={[styles.searchField, searchFocused && styles.searchFocused]}>
                <View style={styles.searchIcon}>
                  <SearchIcon />
                </View>
                <TextInput
                  testID="exercise-picker-search"
                  accessibilityLabel="Search"
                  placeholder="Search exercises"
                  placeholderTextColor={colors.textMuted}
                  value={search}
                  onChangeText={setSearch}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.searchInput}
                />
              </View>
            </View>
            <View style={wide ? styles.thirdCell : styles.halfCell}>
              <Select
                testID="exercise-picker-muscle"
                label="Muscle group"
                value={muscle}
                options={muscleOptions}
                onChange={setMuscle}
                boxStyle={[styles.filterSelect, muscle !== ALL_MUSCLE_GROUPS && styles.filterSelectActive]}
                textStyle={styles.filterSelectText}
                trailing={<ChevronIcon />}
                labelStyle={[styles.filterLabel, wide && styles.filterLabelWide]}
              />
            </View>
            <View style={wide ? styles.thirdCell : styles.halfCell}>
              <Select
                testID="exercise-picker-equipment"
                label="Equipment"
                value={equipment}
                options={equipmentOptions}
                onChange={setEquipment}
                boxStyle={[styles.filterSelect, equipment !== ALL_EQUIPMENT && styles.filterSelectActive]}
                textStyle={styles.filterSelectText}
                trailing={<ChevronIcon />}
                labelStyle={[styles.filterLabel, wide && styles.filterLabelWide]}
              />
            </View>
          </View>

          <View style={[styles.divider, { marginHorizontal: gutter }]} />
          <View style={[styles.meta, { paddingHorizontal: gutter }]}>
            <Text style={styles.metaCount}>{countLabel(visible.length, 'exercise', 'exercises')}</Text>
            {selectedCount > 0 ? <Text style={styles.metaSelected}>{selectedCount} selected</Text> : null}
          </View>

          {/* Virtualized: the catalog runs to hundreds of rows. Same look as a plain list. */}
          <FlatList
            style={styles.list}
            contentContainerStyle={[styles.listContent, { paddingHorizontal: gutter }]}
            keyboardShouldPersistTaps="handled"
            data={visible}
            keyExtractor={(exercise) => String(exercise.id)}
            extraData={{ selectedIds, addedIds }}
            initialNumToRender={8}
            ListHeaderComponent={
              loading ? (
                <Text style={styles.loading}>Loading exercises...</Text>
              ) : visible.length === 0 ? (
                <Text style={styles.noMatch}>No exercises match the current filters.</Text>
              ) : null
            }
            renderItem={({ item: exercise }) => (
              <PickerRow
                exercise={exercise}
                isAdded={addedIds.has(exercise.id)}
                isSelected={selectedIds.has(exercise.id)}
                onToggle={() => toggle(exercise.id)}
              />
            )}
          />

          <View
            style={[
              styles.footer,
              narrow ? styles.footerNarrow : styles.footerRow,
              { paddingHorizontal: gutter, paddingBottom: Math.max(12, insets.bottom) },
            ]}
          >
            <Pressable
              testID="exercise-picker-cancel"
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [styles.cancel, pressed && styles.cancelPressed]}
            >
              <Text style={styles.footerLabel}>Cancel</Text>
            </Pressable>
            <Pressable
              testID="exercise-picker-add"
              accessibilityRole="button"
              accessibilityState={{ disabled: selectedCount === 0 }}
              disabled={selectedCount === 0}
              onPress={addSelected}
              style={({ pressed }) => [
                styles.add,
                selectedCount === 0 ? styles.addDisabled : styles.addGlow,
                pressed && styles.addPressed,
              ]}
            >
              <Text style={[styles.footerLabel, styles.addLabel]}>Add Selected</Text>
              {selectedCount > 0 ? (
                <View style={styles.bubble}>
                  <Text style={styles.bubbleText}>{selectedCount}</Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function PickerRow({ exercise, isAdded, isSelected, onToggle }) {
  const equipmentName = exercise.equipment_type?.name || exercise.equipment_type_name || 'Any equipment';
  return (
    <Pressable
      testID={`exercise-picker-row-${exercise.id}`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected, disabled: isAdded }}
      disabled={isAdded}
      onPress={onToggle}
      style={({ pressed }) => [
        styles.row,
        isSelected ? styles.rowSelected : isAdded ? styles.rowAdded : styles.rowIdle,
        !isSelected && !isAdded && pressed && styles.rowPressed,
      ]}
    >
      <ExerciseThumb exercise={exercise} />
      <View style={styles.rowMiddle}>
        <Text style={styles.rowName}>{exercise.name}</Text>
        <Text style={styles.rowSlug}>{exercise.slug}</Text>
        <View style={styles.chips}>
          <Text style={styles.chip}>{exercise.primary_muscle_group?.name || 'Any'}</Text>
          <Text style={styles.chip}>{equipmentName}</Text>
        </View>
      </View>
      <View style={styles.rowTrailing}>
        {isAdded ? <Text style={styles.added}>Added</Text> : null}
        {!isAdded && isSelected ? (
          <View style={styles.check}>
            <CheckIcon />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
  },
  scrimColor: {
    backgroundColor: colors.pickerScrim,
  },
  scrimPhone: {
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  scrimWide: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  inset: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  sheet: {
    width: '100%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: shadows.soft,
    overflow: 'hidden',
  },
  sheetPhone: {
    borderTopLeftRadius: radii.xxxl,
    borderTopRightRadius: radii.xxxl,
    borderBottomLeftRadius: radii.xxl,
    borderBottomRightRadius: radii.xxl,
    marginBottom: 12,
  },
  sheetWide: {
    maxWidth: 660,
    borderRadius: radii.xxxl,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: colors.border,
    marginTop: 12,
  },
  title: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
    color: colors.textPrimary,
  },
  titleWide: {
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.6,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 19.25,
    color: colors.textSecondary,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  fullCell: {
    width: '100%',
  },
  halfCell: {
    flexBasis: '45%',
    flexGrow: 1,
  },
  thirdCell: {
    flexBasis: '30%',
    flexGrow: 1,
  },
  filterLabel: {
    marginBottom: 4,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  filterLabelWide: {
    fontSize: 12,
  },
  searchIcon: {
    position: 'absolute',
    left: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  searchField: {
    height: 48,
    borderRadius: radii.xl,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingLeft: 36,
    paddingRight: 12,
    justifyContent: 'center',
  },
  searchInput: {
    height: '100%',
    padding: 0,
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  searchFocused: {
    borderColor: colors.brand500,
    outlineWidth: 2,
    outlineColor: colors.focusRing,
    outlineStyle: 'solid',
  },
  filterSelect: {
    height: 48,
    minHeight: 48,
    borderRadius: radii.xl,
    borderWidth: 1.5,
    paddingVertical: 0,
    paddingLeft: 12,
    paddingRight: 12,
    boxShadow: undefined,
  },
  filterSelectActive: {
    borderColor: colors.brand500,
    backgroundColor: colors.brand50,
  },
  filterSelectText: {
    fontSize: 16,
    fontWeight: '500',
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  meta: {
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaCount: {
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  metaSelected: {
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '900',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.brand600,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingTop: 10,
    paddingBottom: 12,
    gap: 10,
  },
  loading: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  noMatch: {
    borderRadius: radii.xxl,
    backgroundColor: colors.surfaceMuted,
    paddingVertical: 20,
    paddingHorizontal: 16,
    overflow: 'hidden',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  rowIdle: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowSelected: {
    borderColor: colors.brand500,
    backgroundColor: colors.brand50,
  },
  rowAdded: {
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    opacity: 0.55,
  },
  rowPressed: {
    borderColor: colors.pickerRowPressedBorder,
    backgroundColor: colors.surfaceMuted,
    transform: [{ scale: 0.99 }],
  },
  rowMiddle: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    fontSize: 15,
    lineHeight: 18.75,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  rowSlug: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  chips: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 4,
    columnGap: 8,
  },
  chip: {
    borderRadius: radii.full,
    backgroundColor: colors.surfaceMuted,
    paddingVertical: 2,
    paddingHorizontal: 10,
    overflow: 'hidden',
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '900',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  rowTrailing: {
    alignSelf: 'center',
  },
  added: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: colors.textMuted,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: radii.full,
    backgroundColor: colors.brand400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 14,
    gap: 10,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  footerNarrow: {
    flexDirection: 'column-reverse',
  },
  footerLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cancel: {
    minHeight: 48,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelPressed: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.pickerCancelPressedBorder,
    transform: [{ scale: 0.97 }],
  },
  add: {
    minHeight: 48,
    borderRadius: radii.full,
    backgroundColor: colors.brand400,
    paddingVertical: 12,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addGlow: {
    boxShadow: shadows.pickerAddSelected,
  },
  addDisabled: {
    opacity: 0.5,
  },
  addPressed: {
    backgroundColor: colors.brand500,
    transform: [{ scale: 0.97 }],
  },
  addLabel: {
    color: colors.navy,
  },
  bubble: {
    width: 20,
    height: 20,
    borderRadius: radii.full,
    backgroundColor: colors.pickerBubble,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    color: colors.navy,
  },
});
