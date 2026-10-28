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
import ExerciseImage, { muscleColor, muscleTextColor, TILE_ALPHA } from '../../../../shared/components/ExerciseImage';
// Review M4/M5: the v2 image chain (w400 first) and media_type.
import { thumbImageProps } from '../../../../shared/images/remoteImageSources';
import FeedbackIcon from '../../../../shared/components/FeedbackIcon';
import GradientFill from '../../../../shared/components/GradientFill';
import IconButton from '../../../../shared/components/IconButton';
import { NAME_TEXT } from '../../../../shared/components/largeText';
import Select from '../../../../shared/components/Select';
import { useKeyboardOverlap } from '../../../../shared/hooks/useKeyboardHeight';
import { useReducedMotion } from '../../../../shared/hooks/useReducedMotion';
import { useSheetFocus } from '../../../../shared/hooks/useSheetFocus';
import {
  blur,
  breakpoints,
  colors,
  font,
  motion,
  radii,
  shadows,
  spacing,
  textInputColors,
  textScale,
  titleTracking,
  typography,
} from '../../../../shared/theme/tokens';
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
// The tablet dialog's drawn 165° fill folds onto surface-raised (UX §8.4)
// → surface, as drawn.
export const TABLET_DIALOG_FILL = Object.freeze({ angle: 165, colors: Object.freeze([colors.surfaceRaised, colors.surface]) });

// Large text (UX §9): role caps; the title wraps by word (max 3 lines) and a
// single long word shrinks it instead of breaking inside it.
const TITLE_TEXT = Object.freeze({
  textBreakStrategy: 'simple',
  maxFontSizeMultiplier: textScale.display,
  numberOfLines: 3,
  adjustsFontSizeToFit: true,
  minimumFontScale: 0.7,
});
const BODY_TEXT = Object.freeze({ maxFontSizeMultiplier: textScale.body });
const PILL_TEXT = Object.freeze({ maxFontSizeMultiplier: textScale.pill });
const BADGE_TEXT = Object.freeze({ maxFontSizeMultiplier: textScale.badge });


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
  const { width, height, fontScale } = useWindowDimensions();
  const tablet = width >= breakpoints.md;
  // UX §9 reflow past 1.3×: one column of filters and cards, the button pair
  // stacks (Add on top), row trailing marks drop below the text, and the
  // header scrolls with the list so nothing is lost at the largest sizes.
  const stacked = fontScale > textScale.reflowAbove;
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  // Batch k (PM, 27 Oct 2026; ruling 12): what the keyboard COVERS of the
  // window; the raw height leaves out the Android nav bar (edge-to-edge).
  const keyboardHeight = useKeyboardOverlap();
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
  const columns = tablet && !stacked ? 2 : 1;
  const countText = countLabel(visible.length, 'exercise', 'exercises');

  // §D4 lifecycle: loading wins; then the alert; then the real empty case.
  let listHeader = null;
  if (loading) {
    listHeader = (
      <Text {...BODY_TEXT} style={styles.loading}>
        Loading exercises...
      </Text>
    );
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
        <Text {...BODY_TEXT} style={styles.noMatch}>
          No exercises match the current filters.
        </Text>
      </View>
    );
  }

  const header = (
    <View style={[styles.header, tablet && styles.headerTablet]}>
      <View style={styles.headerText}>
        <Text
          {...TITLE_TEXT}
          ref={titleRef}
          testID="exercise-picker-title"
          accessibilityRole="header"
          style={tablet ? styles.titleTablet : styles.title}
        >
          Add exercise
        </Text>
        <Text {...BODY_TEXT} style={[styles.subtitle, tablet && styles.subtitleTablet]}>
          Search and select exercises to add to this day.
        </Text>
      </View>
      {tablet ? (
        <IconButton testID="exercise-picker-close" accessibilityLabel="Close" onPress={onClose}>
          {({ color }) => <FeedbackIcon name="close" size={18} color={color} />}
        </IconButton>
      ) : null}
    </View>
  );

  const filters = (
    <View testID="exercise-picker-filters" style={[styles.filters, tablet && !stacked && styles.filtersTablet]}>
      <View style={tablet && !stacked ? styles.searchCellTablet : styles.fullCell}>
        <Text {...BODY_TEXT} style={filterLabel}>
          Search
        </Text>
        {/* Search field variant (UX ruling): pill, well fill, search icon.
            The border lives on the row, so the icon and its inset stay
            put on Android once text is entered. A typed search is an active
            filter: the gold-strong edge (drawn 0.55, UX §8.5). */}
        <View
          testID="exercise-picker-search-field"
          style={[
            styles.searchField,
            tablet && styles.fieldTablet,
            search.length > 0 && styles.searchActive,
            searchFocused && styles.searchFocused,
          ]}
        >
          <View style={styles.searchIcon}>
            <SearchIcon />
          </View>
          <TextInput
            {...textInputColors}
            {...BODY_TEXT}
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
            returnKeyType="search"
            style={styles.searchInput}
          />
        </View>
      </View>
      <View style={tablet && !stacked ? styles.selectCellTablet : stacked ? styles.fullCell : styles.halfCell}>
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
      <View style={tablet && !stacked ? styles.selectCellTablet : stacked ? styles.fullCell : styles.halfCell}>
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
  );

  // The count is a polite live region so a new selection is announced.
  const meta = tablet ? (
    <Text {...BODY_TEXT} testID="exercise-picker-meta" accessibilityLiveRegion="polite" style={styles.metaTablet}>
      {selectedCount > 0 ? `${countText} · ` : countText}
      {selectedCount > 0 ? <Text {...BODY_TEXT} style={styles.metaTabletSelected}>{`${selectedCount} selected`}</Text> : null}
    </Text>
  ) : (
    <View testID="exercise-picker-meta" accessibilityLiveRegion="polite" style={[styles.meta, stacked && styles.metaStacked]}>
      <Text {...BODY_TEXT} textBreakStrategy="simple" style={styles.metaCount}>
        {countText}
      </Text>
      {selectedCount > 0 ? (
        <View testID="exercise-picker-selected-pill" style={styles.selectedPill}>
          <Text {...PILL_TEXT} textBreakStrategy="simple" style={styles.selectedPillText}>{`${selectedCount} selected`}</Text>
        </View>
      ) : null}
    </View>
  );

  const cancelButton = (
    <Pressable
      key="cancel"
      testID="exercise-picker-cancel"
      accessibilityRole="button"
      onPress={onClose}
      style={({ pressed }) => [
        styles.cancel,
        tablet && styles.footerButtonTablet,
        stacked && styles.footerButtonStacked,
        pressed && styles.buttonPressed,
      ]}
    >
      {({ pressed }) => (
        <>
          {pressed ? <PressOverlay radius={radii.full} testID="exercise-picker-cancel-pressed" /> : null}
          <Text {...BODY_TEXT} style={[styles.cancelLabel, tablet && styles.footerLabelTablet]}>
            Cancel
          </Text>
        </>
      )}
    </Pressable>
  );
  const addButton = (
    <Pressable
      key="add"
      testID="exercise-picker-add"
      accessibilityRole="button"
      accessibilityState={{ disabled: selectedCount === 0 }}
      disabled={selectedCount === 0}
      onPress={addSelected}
      style={({ pressed }) => [
        styles.add,
        tablet && styles.addTablet,
        tablet && styles.footerButtonTablet,
        stacked && styles.footerButtonStacked,
        // T-86: no gold glow on a button inside a sheet.
        selectedCount === 0 && styles.addDisabled,
        pressed && styles.buttonPressed,
      ]}
    >
      {({ pressed }) => (
        <>
          {pressed ? <PressOverlay ink radius={radii.full} testID="exercise-picker-add-pressed" /> : null}
          <Text {...BODY_TEXT} style={[styles.addLabel, tablet && styles.footerLabelTablet, tablet && styles.addLabelTablet]}>
            Add Selected
          </Text>
          {selectedCount > 0 ? (
            <View testID="exercise-picker-add-count" style={[styles.bubble, tablet && styles.bubbleTablet]}>
              <Text {...BADGE_TEXT} textBreakStrategy="simple" style={[styles.bubbleText, tablet && styles.bubbleTextTablet]}>
                {selectedCount}
              </Text>
            </View>
          ) : null}
        </>
      )}
    </Pressable>
  );

  return (
    <Modal transparent visible={isOpen} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View
        style={[styles.scrim, tablet ? styles.scrimTablet : styles.scrimPhone, { opacity: scrim, paddingBottom: keyboardHeight }]}
      >
        <BlurLayer blurPx={tablet ? blur.scrimTablet : blur.scrim} overApp />
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
          {tablet ? <GradientFill angle={TABLET_DIALOG_FILL.angle} colors={TABLET_DIALOG_FILL.colors} /> : null}
          <View
            testID="exercise-picker-handle"
            style={[styles.grabber, tablet && styles.grabberTablet]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
          {stacked ? null : (
            <>
              {header}
              {filters}
              {meta}
            </>
          )}

          {/* Virtualized: the catalog runs to hundreds of rows. */}
          <FlatList
            key={columns === 2 ? 'grid' : 'list'}
            testID="exercise-picker-list"
            style={styles.list}
            contentContainerStyle={[styles.listContent, tablet && styles.listContentTablet]}
            columnWrapperStyle={columns === 2 ? styles.gridRow : undefined}
            numColumns={columns}
            keyboardShouldPersistTaps="handled"
            data={visible}
            keyExtractor={(exercise) => String(exercise.id)}
            extraData={{ selectedIds, addedIds }}
            initialNumToRender={8}
            ListHeaderComponent={
              stacked ? (
                <View style={styles.scrollingTop}>
                  {header}
                  {filters}
                  {meta}
                  {listHeader}
                </View>
              ) : (
                listHeader
              )
            }
            renderItem={({ item: exercise }) => {
              const Item = tablet ? PickerCard : PickerRow;
              return (
                <Item
                  stacked={stacked}
                  exercise={exercise}
                  isAdded={addedIds.has(exercise.id)}
                  isSelected={selectedIds.has(exercise.id)}
                  onToggle={() => toggle(exercise.id)}
                />
              );
            }}
          />

          <View
            testID="exercise-picker-footer"
            style={[
              styles.footer,
              tablet && styles.footerTablet,
              stacked && styles.footerStacked,
              { paddingBottom: tablet ? spacing[7] : Math.max(spacing[7], insets.bottom + spacing[3]) },
            ]}
          >
            {stacked ? [addButton, cancelButton] : [cancelButton, addButton]}
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
function PickerRow({ exercise, isAdded, isSelected, onToggle, stacked }) {
  const trailing = (
    <View testID={`exercise-picker-trailing-${exercise.id}`} style={stacked ? styles.rowTrailingBelow : styles.rowTrailing}>
      {isAdded ? (
        <Text {...BODY_TEXT} style={styles.added}>
          Added
        </Text>
      ) : null}
      {!isAdded && isSelected ? (
        <View testID={`exercise-picker-check-${exercise.id}`} style={styles.check}>
          <CheckIcon color={colors.onGold} size={13} />
        </View>
      ) : null}
    </View>
  );
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
      {({ pressed }) => (
        <>
          {!isSelected && !isAdded && pressed ? (
            <PressOverlay radius={ROW_RADIUS} testID={`exercise-picker-row-${exercise.id}-pressed`} />
          ) : null}
          <ExerciseImage exercise={exercise} {...thumbImageProps(exercise)} size={ROW_IMAGE.height} style={styles.rowImage} />
          <View style={styles.rowMiddle}>
            <Text {...NAME_TEXT} style={styles.rowName}>
              {exercise.name}
            </Text>
            <View style={styles.chips}>
              <View style={styles.chip}>
                <Text {...PILL_TEXT} textBreakStrategy="simple" style={styles.chipText}>
                  {exercise.primary_muscle_group?.name || 'Any'}
                </Text>
              </View>
              <View style={styles.chip}>
                <Text {...PILL_TEXT} textBreakStrategy="simple" style={styles.chipText}>
                  {equipmentNameOf(exercise)}
                </Text>
              </View>
            </View>
            {stacked ? trailing : null}
          </View>
          {stacked ? null : trailing}
        </>
      )}
    </Pressable>
  );
}

// Tablet card: a 150 photo on top, the name and chips under it; a check
// bubble (selected) or an empty ring (not selected, so selection is not
// colour only); added cards dim their photo and carry an "Added" pill.
function PickerCard({ exercise, isAdded, isSelected, onToggle }) {
  // Added cards draw both chips neutral (the drawn 0.06 fill folds to 0.08).
  const hue = isAdded ? null : muscleColor(exercise.primary_muscle_group?.code);
  // Text on the 16 % muscle tint: the muscle's lighter text colour (UX §8.4).
  const hueText = isAdded ? null : muscleTextColor(exercise.primary_muscle_group?.code);
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
      {({ pressed }) => (
        <>
          <View style={[styles.cardPhoto, isAdded && styles.cardPhotoAdded]}>
            <ExerciseImage exercise={exercise} {...thumbImageProps(exercise)} size={CARD_PHOTO} style={styles.cardImage} />
          </View>
          {isAdded ? (
            <View testID={`exercise-picker-added-${exercise.id}`} style={styles.addedPill}>
              <Text {...PILL_TEXT} style={styles.addedPillText}>
                Added
              </Text>
            </View>
          ) : isSelected ? (
            <View testID={`exercise-picker-check-${exercise.id}`} style={[styles.cardMark, styles.cardMarkOn]}>
              <CheckIcon color={colors.onGold} size={15} />
            </View>
          ) : (
            <View testID={`exercise-picker-ring-${exercise.id}`} style={[styles.cardMark, styles.cardMarkOff]} />
          )}
          <View style={styles.cardBody}>
            <Text {...NAME_TEXT} style={[styles.cardName, isAdded && styles.cardNameAdded]}>
              {exercise.name}
            </Text>
            <View style={styles.cardChips}>
              <View
                testID={`exercise-picker-muscle-chip-${exercise.id}`}
                style={[styles.cardChip, !hue && styles.cardChipNeutral]}
              >
                {hue ? <View style={[StyleSheet.absoluteFill, styles.cardChipTint, { backgroundColor: hue }]} /> : null}
                <Text
                  {...PILL_TEXT}
                  style={[
                    styles.cardChipText,
                    hue && styles.cardChipTextHue,
                    isAdded && styles.cardChipTextAdded,
                    hueText && { color: hueText },
                  ]}
                >
                  {exercise.primary_muscle_group?.name || 'Any'}
                </Text>
              </View>
              <View style={[styles.cardChip, styles.cardChipNeutral]}>
                <Text {...PILL_TEXT} style={[styles.cardChipText, styles.cardChipTextPlain, isAdded && styles.cardChipTextAdded]}>
                  {equipmentNameOf(exercise)}
                </Text>
              </View>
            </View>
          </View>
          {!isAdded && pressed ? <PressOverlay testID={`exercise-picker-row-${exercise.id}-pressed`} /> : null}
        </>
      )}
    </Pressable>
  );
}

// The v2 state rule: pressed = the rest look + a 4 % overlay (white on dark
// surfaces, ink on gold); never a new alpha.
function PressOverlay({ ink = false, radius = 0, testID }) {
  return (
    <View
      testID={testID}
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { borderRadius: radius }, ink ? styles.pressOverlayInk : styles.pressOverlayWhite]}
    />
  );
}

const styles = StyleSheet.create({
  pressOverlayWhite: {
    backgroundColor: colors.pressOverlay,
  },
  pressOverlayInk: {
    backgroundColor: colors.pressOverlayInk,
  },
  scrollingTop: {
    paddingBottom: spacing[2],
  },
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
  // The drawn sheet fill is surface-card-2 (UX §8.3); the tablet dialog draws its gradient.
  sheet: {
    width: '100%',
    backgroundColor: colors.surfaceCard2,
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
    backgroundColor: colors.hairlineBright,
  },
  grabberTablet: {
    width: 44,
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
    letterSpacing: titleTracking(34, -0.05),
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
    minHeight: 48,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surfaceWell,
    paddingLeft: 38,
    paddingRight: 14,
    justifyContent: 'center',
  },
  fieldTablet: {
    minHeight: 52,
    borderColor: colors.hairlineButton,
  },
  searchInput: {
    paddingVertical: spacing[2],
    paddingHorizontal: 0,
    ...typography.labelLg,
    ...font(400),
    color: colors.textPrimary,
  },
  searchActive: {
    borderColor: colors.goldStrong,
  },
  // Focused: gold border + the gold focus ring.
  searchFocused: {
    borderColor: colors.gold,
    outlineWidth: 4,
    outlineColor: colors.goldFocus,
    outlineStyle: 'solid',
  },
  filterSelect: {
    minHeight: 48,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surfaceWell,
    paddingVertical: 0,
    paddingLeft: spacing[3],
    paddingRight: spacing[3],
    boxShadow: undefined,
  },
  filterSelectActive: {
    borderColor: colors.goldLine,
    backgroundColor: colors.goldFaint,
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
  metaStacked: {
    flexWrap: 'wrap',
  },
  metaCount: {
    ...typography.caption,
    ...font(600),
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  selectedPill: {
    minHeight: 26,
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
    backgroundColor: colors.goldFaint,
  },
  rowAdded: {
    borderColor: colors.hairline,
    backgroundColor: colors.fillWell,
    opacity: 0.6,
  },
  rowPressed: {
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
    minHeight: 22,
    justifyContent: 'center',
    borderRadius: radii.full,
    backgroundColor: colors.fillButton,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
  },
  chipText: {
    ...typography.micro,
    ...font(600),
    color: colors.textStrong2,
  },
  rowTrailing: {
    alignSelf: 'center',
  },
  rowTrailingBelow: {
    marginTop: spacing[2],
    alignSelf: 'flex-start',
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
    backgroundColor: colors.surfaceCard2,
  },
  cardSelected: {
    borderWidth: 1.5,
    borderColor: colors.gold,
    backgroundColor: colors.surfaceCard2,
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
  // The empty ring: white 0.7 → text-secondary, its 0.4 fill → on-photo (§8.6).
  cardMarkOff: {
    borderWidth: 2,
    borderColor: colors.textSecondary,
    backgroundColor: colors.onPhoto,
  },
  // A solid badge on the photo: 0.75 → on-photo-strong (UX §8.4).
  addedPill: {
    position: 'absolute',
    top: 10,
    right: 10,
    minHeight: 28,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: radii.full,
    backgroundColor: colors.onPhotoStrong,
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
    color: colors.textSecondary,
  },
  cardChips: {
    marginTop: spacing[2],
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  cardChip: {
    minHeight: 24,
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
  // The equipment chip is regular weight (as drawn); the muscle chip is 600.
  cardChipTextPlain: {
    ...font(400),
  },
  cardChipTextHue: {
    ...font(600),
  },
  cardChipTextAdded: {
    ...font(400),
    color: colors.textSecondary,
  },
  footer: {
    marginHorizontal: -spacing[4],
    paddingHorizontal: spacing[4],
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    backgroundColor: colors.surfaceCard2,
    flexDirection: 'row',
    gap: 10,
  },
  footerStacked: {
    flexDirection: 'column',
  },
  footerTablet: {
    marginHorizontal: 0,
    paddingHorizontal: 0,
    paddingTop: spacing[5],
    borderTopWidth: 0,
    gap: spacing[3],
    backgroundColor: undefined,
  },
  cancel: {
    flex: 1,
    minHeight: 56,
    overflow: 'hidden',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.fillSkeleton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    transform: [{ scale: 0.97 }],
  },
  cancelLabel: {
    textAlign: 'center',
    ...typography.body,
    ...font(600),
    color: colors.textPrimary,
  },
  footerButtonTablet: {
    minHeight: 60,
  },
  footerButtonStacked: {
    flex: 0,
    width: '100%',
  },
  footerLabelTablet: {
    fontSize: 17,
    lineHeight: 22,
  },
  add: {
    flex: 1.4,
    minHeight: 56,
    overflow: 'hidden',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
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
  addDisabled: {
    opacity: 0.5,
  },
  addLabel: {
    flexShrink: 1,
    textAlign: 'center',
    ...typography.body,
    ...font(700),
    color: colors.onGold,
  },
  addLabelTablet: {
    ...font(700),
  },
  bubble: {
    minWidth: 22,
    minHeight: 22,
    paddingHorizontal: 6,
    borderRadius: radii.full,
    backgroundColor: colors.ground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleTablet: {
    minWidth: 28,
    minHeight: 28,
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
