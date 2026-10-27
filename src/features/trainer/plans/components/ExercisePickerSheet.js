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
import ErrorAlert from '../../../../shared/components/ErrorAlert';
import ExerciseImage, { muscleColor, TILE_ALPHA } from '../../../../shared/components/ExerciseImage';
import FeedbackIcon from '../../../../shared/components/FeedbackIcon';
import IconButton from '../../../../shared/components/IconButton';
import Select from '../../../../shared/components/Select';
import { useKeyboardHeight } from '../../../../shared/hooks/useKeyboardHeight';
import { useReducedMotion } from '../../../../shared/hooks/useReducedMotion';
import { useSheetFocus } from '../../../../shared/hooks/useSheetFocus';
import { breakpoints, colors, font, motion, radii, shadows, spacing, typography } from '../../../../shared/theme/tokens';
import { ALL_EQUIPMENT, ALL_MUSCLE_GROUPS, countLabel, filterCatalog } from '../planFormat';
import { CheckIcon, ChevronIcon, SearchIcon } from './pickerIcons';

const EASE_OUT = Easing.bezier(0, 0, 0.58, 1);

// v2 Phase 2 C2 (UX C §Exercise picker / §Tablet). Phone (< 768): a bottom
// sheet, 86 % tall; tablet (≥ 768): a centred 620 dialog with a Close button
// (same action as Cancel), a 3-column filter row and a 2-column card grid.
// Drawn off the token scale ([no token], built as drawn).
export const CATALOG_UNAVAILABLE_TITLE = 'Exercise catalog unavailable';
const SHEET_RADIUS = 32;
const DIALOG_RADIUS = 36;
const ROW_RADIUS = 22;
const ROW_IMAGE = Object.freeze({ width: 76, height: 64 });
const CARD_PHOTO = 150;
const TABLET_DIALOG = Object.freeze({ width: 620, height: 1040 });

// T5 (spec §A7.2–§A7.3). `onAddSelected(exercises)` runs the add loop; the
// sheet closes when it settles. No in-flight guard (⚠T5-2).
// §D4: `catalogError` (the failed request's message) shows the
// "Exercise catalog unavailable" alert in place of the empty line, with
// `onRetryCatalog` as its Retry. `returnFocusRef` is the control that opened
// the picker: screen-reader focus goes back to it on close.
export default function ExercisePickerSheet({
  isOpen,
  onClose,
  catalog,
  loading,
  catalogError = null,
  onRetryCatalog,
  muscleGroups,
  equipmentTypes,
  addedIds,
  onAddSelected,
  returnFocusRef,
}) {
  const { width, height } = useWindowDimensions();
  const tablet = width >= breakpoints.md;
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
  const titleRef = useRef(null);

  // Focus in on open, back to the opener on close (PM parity rule).
  useSheetFocus(isOpen, { initialRef: titleRef, returnRef: returnFocusRef });

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
    // The tablet dialog fades in with the scrim; the phone sheet slides up.
    const animations = [
      Animated.timing(scrim, { toValue: 1, duration: motion.fadeMs, easing: EASE_OUT, useNativeDriver: true }),
    ];
    if (tablet) {
      sheet.setValue(1);
    } else {
      animations.push(
        Animated.timing(sheet, { toValue: 1, duration: motion.slideUpMs, easing: EASE_OUT, useNativeDriver: true })
      );
    }
    const animation = Animated.parallel(animations);
    animation.start();
    return () => animation.stop();
  }, [isOpen, reducedMotion, scrim, sheet, tablet]);

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
  const muscleOptions = [
    { value: ALL_MUSCLE_GROUPS, label: ALL_MUSCLE_GROUPS },
    ...muscleGroups.map((group) => ({ value: group.name, label: group.name })),
  ];
  const equipmentOptions = [
    { value: ALL_EQUIPMENT, label: ALL_EQUIPMENT },
    ...equipmentTypes.map((type) => ({ value: String(type.id), label: type.name })),
  ];
  const sheetTranslate = sheet.interpolate({ inputRange: [0, 1], outputRange: [motion.slideUpOffsetY, 0] });

  // An open keyboard lifts the sheet / dialog and takes its space.
  const room = height - keyboardHeight - insets.top - spacing[6];
  const sheetHeight = tablet
    ? Math.min(TABLET_DIALOG.height, height - insets.top - insets.bottom - 2 * spacing[6], room)
    : keyboardHeight > 0
      ? Math.min(height * 0.86, room)
      : height * 0.86;

  const filterLabel = [styles.filterLabel, tablet && styles.filterLabelTablet];
  const selectBox = (active) => [styles.filterSelect, tablet && styles.fieldTablet, active && styles.filterSelectActive];
  const countText = countLabel(visible.length, 'exercise', 'exercises');

  // §D4 lifecycle: loading wins; then the alert; then the real empty case.
  let listHeader = null;
  if (loading) {
    listHeader = <Text style={styles.loading}>Loading exercises...</Text>;
  } else if (catalogError) {
    listHeader = (
      <ErrorAlert
        testID="exercise-picker-catalog-error"
        title={CATALOG_UNAVAILABLE_TITLE}
        description={catalogError}
        onRetry={onRetryCatalog}
        style={tablet ? styles.alertTablet : null}
      />
    );
  } else if (visible.length === 0) {
    listHeader = (
      <View style={[styles.noMatchBox, tablet && styles.alertTablet]}>
        <Text style={styles.noMatch}>No exercises match the current filters.</Text>
      </View>
    );
  }

  return (
    <Modal transparent visible={isOpen} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View
        style={[
          styles.scrim,
          tablet ? styles.scrimTablet : styles.scrimPhone,
          { opacity: scrim, paddingBottom: keyboardHeight },
        ]}
      >
        <BlurLayer blurPx={tablet ? 6 : 4} overApp />
        <Pressable style={[StyleSheet.absoluteFill, styles.scrimColor]} onPress={onClose} accessibilityLabel="Close" />
        <Animated.View
          testID="exercise-picker"
          accessibilityViewIsModal
          style={[
            styles.sheet,
            tablet ? styles.sheetTablet : styles.sheetPhone,
            { height: sheetHeight, opacity: sheet, transform: [{ translateY: sheetTranslate }] },
          ]}
        >
          <View
            testID="exercise-picker-handle"
            style={[styles.grabber, tablet && styles.grabberTablet]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
          <View style={[styles.header, tablet && styles.headerTablet]}>
            <View style={styles.headerText}>
              <Text
                ref={titleRef}
                testID="exercise-picker-title"
                textBreakStrategy="simple"
                accessibilityRole="header"
                style={tablet ? styles.titleTablet : styles.title}
              >
                Add exercise
              </Text>
              <Text style={[styles.subtitle, tablet && styles.subtitleTablet]}>Search and select exercises to add to this day.</Text>
            </View>
            {tablet ? (
              <IconButton testID="exercise-picker-close" accessibilityLabel="Close" onPress={onClose}>
                {({ color }) => <FeedbackIcon name="close" size={18} color={color} />}
              </IconButton>
            ) : null}
          </View>

          <View style={[styles.filters, tablet && styles.filtersTablet]}>
            <View style={tablet ? styles.searchCellTablet : styles.fullCell}>
              <Text style={filterLabel}>Search</Text>
              {/* Search field variant (UX ruling): pill, sunk fill, search icon.
                  The border lives on the row, so the icon and its inset stay
                  put on Android once text is entered. */}
              <View
                testID="exercise-picker-search-field"
                style={[styles.searchField, tablet && styles.fieldTablet, searchFocused && styles.searchFocused]}
              >
                <View style={styles.searchIcon}>
                  <SearchIcon />
                </View>
                <TextInput
                  testID="exercise-picker-search"
                  accessibilityLabel="Search"
                  placeholder="Search exercises"
                  placeholderTextColor={colors.textMuted}
                  selectionColor={colors.gold}
                  cursorColor={colors.gold}
                  value={search}
                  onChangeText={setSearch}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                  style={styles.searchInput}
                />
              </View>
            </View>
            <View style={tablet ? styles.selectCellTablet : styles.halfCell}>
              <Select
                testID="exercise-picker-muscle"
                label="Muscle group"
                value={muscle}
                options={muscleOptions}
                onChange={setMuscle}
                boxStyle={selectBox(muscle !== ALL_MUSCLE_GROUPS)}
                textStyle={[styles.filterSelectText, tablet && styles.filterSelectTextTablet]}
                trailing={<ChevronIcon />}
                labelStyle={filterLabel}
              />
            </View>
            <View style={tablet ? styles.selectCellTablet : styles.halfCell}>
              <Select
                testID="exercise-picker-equipment"
                label="Equipment"
                value={equipment}
                options={equipmentOptions}
                onChange={setEquipment}
                boxStyle={selectBox(equipment !== ALL_EQUIPMENT)}
                textStyle={[styles.filterSelectText, tablet && styles.filterSelectTextTablet]}
                trailing={<ChevronIcon />}
                labelStyle={filterLabel}
              />
            </View>
          </View>

          {/* The count is a polite live region so a new selection is announced. */}
          {tablet ? (
            <Text testID="exercise-picker-meta" accessibilityLiveRegion="polite" numberOfLines={1} style={styles.metaTablet}>
              {selectedCount > 0 ? `${countText} · ` : countText}
              {selectedCount > 0 ? <Text style={styles.metaTabletSelected}>{`${selectedCount} selected`}</Text> : null}
            </Text>
          ) : (
            <View testID="exercise-picker-meta" accessibilityLiveRegion="polite" style={styles.meta}>
              <Text numberOfLines={1} textBreakStrategy="simple" style={styles.metaCount}>
                {countText}
              </Text>
              {selectedCount > 0 ? (
                <View testID="exercise-picker-selected-pill" style={styles.selectedPill}>
                  <Text numberOfLines={1} textBreakStrategy="simple" style={styles.selectedPillText}>{`${selectedCount} selected`}</Text>
                </View>
              ) : null}
            </View>
          )}

          {/* Virtualized: the catalog runs to hundreds of rows. */}
          <FlatList
            key={tablet ? 'grid' : 'list'}
            testID="exercise-picker-list"
            style={styles.list}
            contentContainerStyle={[styles.listContent, tablet && styles.listContentTablet]}
            columnWrapperStyle={tablet ? styles.gridRow : undefined}
            numColumns={tablet ? 2 : 1}
            keyboardShouldPersistTaps="handled"
            data={visible}
            keyExtractor={(exercise) => String(exercise.id)}
            extraData={{ selectedIds, addedIds }}
            initialNumToRender={8}
            ListHeaderComponent={listHeader}
            renderItem={({ item: exercise }) => {
              const Item = tablet ? PickerCard : PickerRow;
              return (
                <Item
                  exercise={exercise}
                  isAdded={addedIds.has(exercise.id)}
                  isSelected={selectedIds.has(exercise.id)}
                  onToggle={() => toggle(exercise.id)}
                />
              );
            }}
          />

          <View
            style={[
              styles.footer,
              tablet && styles.footerTablet,
              { paddingBottom: tablet ? spacing[7] : Math.max(spacing[7], insets.bottom + spacing[3]) },
            ]}
          >
            <Pressable
              testID="exercise-picker-cancel"
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [styles.cancel, tablet && styles.footerButtonTablet, pressed && styles.cancelPressed]}
            >
              <Text style={[styles.cancelLabel, tablet && styles.footerLabelTablet]}>Cancel</Text>
            </Pressable>
            <Pressable
              testID="exercise-picker-add"
              accessibilityRole="button"
              accessibilityState={{ disabled: selectedCount === 0 }}
              disabled={selectedCount === 0}
              onPress={addSelected}
              style={({ pressed }) => [
                styles.add,
                tablet && styles.addTablet,
                tablet && styles.footerButtonTablet,
                selectedCount === 0 ? styles.addDisabled : styles.addGlow,
                pressed && styles.addPressed,
              ]}
            >
              <Text style={[styles.addLabel, tablet && styles.footerLabelTablet, tablet && styles.addLabelTablet]}>Add Selected</Text>
              {selectedCount > 0 ? (
                <View testID="exercise-picker-add-count" style={[styles.bubble, tablet && styles.bubbleTablet]}>
                  <Text numberOfLines={1} textBreakStrategy="simple" style={[styles.bubbleText, tablet && styles.bubbleTextTablet]}>
                    {selectedCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function equipmentNameOf(exercise) {
  return exercise.equipment_type?.name || exercise.equipment_type_name || 'Any equipment';
}

// Phone row: 76×64 photo, name, muscle + equipment chips; the check bubble
// when selected, "Added" when already in the day. The slug is not drawn (UX).
function PickerRow({ exercise, isAdded, isSelected, onToggle }) {
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
      <ExerciseImage exercise={exercise} size={ROW_IMAGE.height} style={styles.rowImage} />
      <View style={styles.rowMiddle}>
        <Text style={styles.rowName}>{exercise.name}</Text>
        <View style={styles.chips}>
          <Text numberOfLines={1} textBreakStrategy="simple" style={styles.chip}>{exercise.primary_muscle_group?.name || 'Any'}</Text>
          <Text numberOfLines={1} textBreakStrategy="simple" style={styles.chip}>{equipmentNameOf(exercise)}</Text>
        </View>
      </View>
      <View style={styles.rowTrailing}>
        {isAdded ? <Text style={styles.added}>Added</Text> : null}
        {!isAdded && isSelected ? (
          <View testID={`exercise-picker-check-${exercise.id}`} style={styles.check}>
            <CheckIcon color={colors.onGold} size={13} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

// Tablet card: a 150 photo on top, the name and chips under it; a check
// bubble (selected) or an empty ring (not selected, so selection is not
// colour only); added cards dim their photo and carry an "Added" pill.
function PickerCard({ exercise, isAdded, isSelected, onToggle }) {
  const hue = muscleColor(exercise.primary_muscle_group?.code);
  return (
    <Pressable
      testID={`exercise-picker-row-${exercise.id}`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected, disabled: isAdded }}
      disabled={isAdded}
      onPress={onToggle}
      style={({ pressed }) => [
        styles.card,
        isSelected ? styles.cardSelected : isAdded ? styles.cardAdded : styles.cardIdle,
        !isAdded && pressed && styles.cardPressed,
      ]}
    >
      <View style={[styles.cardPhoto, isAdded && styles.cardPhotoAdded]}>
        <ExerciseImage exercise={exercise} size={CARD_PHOTO} style={styles.cardImage} />
      </View>
      {isAdded ? (
        <View style={styles.addedPill}>
          <Text style={styles.addedPillText}>Added</Text>
        </View>
      ) : isSelected ? (
        <View testID={`exercise-picker-check-${exercise.id}`} style={[styles.cardMark, styles.cardMarkOn]}>
          <CheckIcon color={colors.onGold} size={15} />
        </View>
      ) : (
        <View testID={`exercise-picker-ring-${exercise.id}`} style={[styles.cardMark, styles.cardMarkOff]} />
      )}
      <View style={styles.cardBody}>
        <Text numberOfLines={2} style={[styles.cardName, isAdded && styles.cardNameAdded]}>
          {exercise.name}
        </Text>
        <View style={styles.cardChips}>
          <View style={styles.cardChip}>
            {hue ? <View style={[StyleSheet.absoluteFill, styles.cardChipTint, { backgroundColor: hue }]} /> : null}
            <Text numberOfLines={1} style={[styles.cardChipText, { color: hue ?? colors.textStrong2 }]}>
              {exercise.primary_muscle_group?.name || 'Any'}
            </Text>
          </View>
          <View style={[styles.cardChip, styles.cardChipNeutral]}>
            <Text numberOfLines={1} style={styles.cardChipText}>
              {equipmentNameOf(exercise)}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
  },
  scrimColor: {
    backgroundColor: colors.scrim,
  },
  scrimPhone: {
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  scrimTablet: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[6],
  },
  sheet: {
    width: '100%',
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    boxShadow: shadows.float,
    overflow: 'hidden',
  },
  sheetPhone: {
    borderBottomWidth: 0,
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    paddingTop: 10,
    paddingHorizontal: spacing[4],
  },
  sheetTablet: {
    maxWidth: TABLET_DIALOG.width,
    borderRadius: DIALOG_RADIUS,
    paddingTop: spacing[3],
    paddingHorizontal: spacing[7],
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: radii.full,
    backgroundColor: colors.grabHandle,
  },
  grabberTablet: {
    width: 44,
    height: 6,
  },
  header: {
    marginTop: spacing[3],
    paddingHorizontal: spacing[1],
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  headerTablet: {
    marginTop: 18,
    paddingHorizontal: 0,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...typography.titleXl,
    fontSize: 34,
    lineHeight: 36,
    letterSpacing: -1.7,
    color: colors.textPrimary,
  },
  titleTablet: {
    ...typography.titleXl,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.bodySm,
    marginTop: spacing[1],
    color: colors.textSecondary,
  },
  subtitleTablet: {
    ...typography.bodyLg,
    lineHeight: 22,
    marginTop: spacing[2],
  },
  filters: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  filtersTablet: {
    marginTop: spacing[5],
    flexWrap: 'nowrap',
    gap: 10,
  },
  fullCell: {
    width: '100%',
  },
  halfCell: {
    flexBasis: '45%',
    flexGrow: 1,
  },
  searchCellTablet: {
    flex: 1.4,
    minWidth: 0,
  },
  selectCellTablet: {
    flex: 1,
    minWidth: 0,
  },
  filterLabel: {
    ...typography.caption,
    ...font(600),
    marginBottom: 6,
    color: colors.textStrong2,
  },
  filterLabelTablet: {
    ...typography.label,
    ...font(600),
    marginBottom: 6,
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
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surfaceSunk,
    paddingLeft: 38,
    paddingRight: 14,
    justifyContent: 'center',
  },
  fieldTablet: {
    height: 52,
    minHeight: 52,
    borderColor: colors.hairlineButton,
  },
  searchInput: {
    height: '100%',
    padding: 0,
    ...typography.labelLg,
    ...font(400),
    color: colors.textPrimary,
  },
  // Focused: gold border + the gold focus ring.
  searchFocused: {
    borderColor: colors.gold,
    outlineWidth: 4,
    outlineColor: colors.goldFocus,
    outlineStyle: 'solid',
  },
  filterSelect: {
    height: 48,
    minHeight: 48,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surfaceSunk,
    paddingVertical: 0,
    paddingLeft: spacing[3],
    paddingRight: spacing[3],
    boxShadow: undefined,
  },
  filterSelectActive: {
    borderColor: colors.goldBorder,
    backgroundColor: colors.goldTintWeak,
  },
  filterSelectText: {
    ...typography.bodySm,
    ...font(500),
  },
  filterSelectTextTablet: {
    ...typography.body,
    ...font(500),
  },
  meta: {
    marginTop: 14,
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
    paddingHorizontal: spacing[1],
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  metaCount: {
    ...typography.caption,
    ...font(600),
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  selectedPill: {
    height: 26,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: radii.full,
    backgroundColor: colors.goldTint,
  },
  selectedPillText: {
    ...typography.caption,
    ...font(700),
    color: colors.gold,
    fontVariant: ['tabular-nums'],
  },
  metaTablet: {
    marginTop: spacing[4],
    ...typography.bodySm,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  metaTabletSelected: {
    ...font(600),
    color: colors.gold,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingTop: spacing[1],
    paddingBottom: spacing[3],
    gap: spacing[2],
  },
  listContentTablet: {
    paddingTop: spacing[3],
    gap: spacing[3],
  },
  gridRow: {
    gap: spacing[3],
  },
  alertTablet: {
    marginBottom: spacing[1],
  },
  loading: {
    ...typography.bodySm,
    color: colors.textMuted,
  },
  noMatchBox: {
    borderRadius: radii.lg,
    backgroundColor: colors.fillSkeleton,
    paddingVertical: spacing[5],
    paddingHorizontal: spacing[4],
  },
  noMatch: {
    ...typography.bodySm,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingTop: spacing[2],
    paddingBottom: spacing[2],
    paddingLeft: spacing[2],
    paddingRight: spacing[3],
    borderRadius: ROW_RADIUS,
    borderWidth: 1.5,
  },
  rowIdle: {
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  rowSelected: {
    borderColor: colors.gold,
    backgroundColor: colors.goldTintWeak,
  },
  rowAdded: {
    borderColor: colors.hairline,
    backgroundColor: colors.fillWell,
    opacity: 0.6,
  },
  rowPressed: {
    borderColor: colors.goldBorder,
    backgroundColor: colors.fillWell,
    transform: [{ scale: 0.99 }],
  },
  rowImage: {
    width: ROW_IMAGE.width,
    height: ROW_IMAGE.height,
    borderRadius: radii.md,
  },
  rowMiddle: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    ...typography.labelLg,
    ...font(700),
    letterSpacing: -0.16,
    color: colors.textPrimary,
  },
  chips: {
    marginTop: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    height: 22,
    borderRadius: radii.full,
    backgroundColor: colors.fillButton,
    paddingHorizontal: spacing[2],
    overflow: 'hidden',
    ...typography.micro,
    ...font(600),
    lineHeight: 22,
    color: colors.textStrong2,
  },
  rowTrailing: {
    alignSelf: 'center',
  },
  added: {
    ...typography.caption,
    ...font(700),
    color: colors.textSecondary,
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: radii.full,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    borderRadius: radii.xl,
    borderWidth: 1,
  },
  cardIdle: {
    borderColor: colors.choiceBorder,
    backgroundColor: colors.surfaceRaised,
  },
  cardSelected: {
    borderWidth: 1.5,
    borderColor: colors.gold,
    backgroundColor: colors.surfaceRaised,
    boxShadow: shadows.goldGlow,
  },
  cardAdded: {
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceSunk,
  },
  cardPressed: {
    transform: [{ scale: 0.99 }],
  },
  cardPhoto: {
    height: CARD_PHOTO,
  },
  cardPhotoAdded: {
    opacity: 0.45,
  },
  cardImage: {
    width: '100%',
    height: CARD_PHOTO,
    borderRadius: 0,
  },
  cardMark: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMarkOn: {
    backgroundColor: colors.gold,
  },
  cardMarkOff: {
    borderWidth: 2,
    borderColor: colors.textSecondary,
    backgroundColor: colors.scrim,
  },
  addedPill: {
    position: 'absolute',
    top: 10,
    right: 10,
    height: 28,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: radii.full,
    backgroundColor: colors.stickyHeaderFill,
  },
  addedPillText: {
    ...typography.caption,
    ...font(600),
    color: colors.textStrong2,
  },
  cardBody: {
    paddingTop: spacing[3],
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  cardName: {
    ...typography.labelLg,
    fontSize: 17,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  cardNameAdded: {
    color: colors.textMuted,
  },
  cardChips: {
    marginTop: spacing[2],
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  cardChip: {
    height: 24,
    justifyContent: 'center',
    paddingHorizontal: 9,
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  cardChipTint: {
    opacity: TILE_ALPHA,
  },
  cardChipNeutral: {
    backgroundColor: colors.fillButton,
  },
  cardChipText: {
    ...typography.caption,
    ...font(600),
    color: colors.textStrong2,
  },
  footer: {
    marginHorizontal: -spacing[4],
    paddingHorizontal: spacing[4],
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    backgroundColor: colors.surfaceRaised,
    flexDirection: 'row',
    gap: 10,
  },
  footerTablet: {
    marginHorizontal: 0,
    paddingHorizontal: 0,
    paddingTop: spacing[5],
    borderTopWidth: 0,
    gap: spacing[3],
  },
  cancel: {
    flex: 1,
    height: 56,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.fillSkeleton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelPressed: {
    backgroundColor: colors.hairlineButton,
    transform: [{ scale: 0.97 }],
  },
  cancelLabel: {
    ...typography.body,
    ...font(600),
    color: colors.textPrimary,
  },
  footerButtonTablet: {
    height: 60,
  },
  footerLabelTablet: {
    fontSize: 17,
    lineHeight: 22,
  },
  add: {
    flex: 1.4,
    height: 56,
    borderRadius: radii.full,
    backgroundColor: colors.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  addTablet: {
    flex: 1.6,
    gap: 10,
  },
  addGlow: {
    boxShadow: shadows.goldGlow,
  },
  addDisabled: {
    opacity: 0.5,
  },
  addPressed: {
    backgroundColor: colors.goldDeep,
    transform: [{ scale: 0.97 }],
  },
  addLabel: {
    ...typography.body,
    ...font(700),
    color: colors.onGold,
  },
  addLabelTablet: {
    ...font(700),
  },
  bubble: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: radii.full,
    backgroundColor: colors.ground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleTablet: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: spacing[2],
  },
  bubbleText: {
    ...typography.caption,
    ...font(700),
    color: colors.gold,
    fontVariant: ['tabular-nums'],
  },
  bubbleTextTablet: {
    fontSize: 14,
    lineHeight: 18,
  },
});
