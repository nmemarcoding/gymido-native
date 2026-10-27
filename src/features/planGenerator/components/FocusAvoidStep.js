import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import ExerciseImage from '../../../shared/components/ExerciseImage';
import GradientFill from '../../../shared/components/GradientFill';
import { colors, font, gradients, radii, spacing, textInputColors, textScale } from '../../../shared/theme/tokens';
import { searchExercises } from '../api/generatorApi';
import { COPY, pickUpTo, reasonLabel, removeLabel } from '../generatorCopy';
import { BODY_TEXT, PressOverlay } from '../generatorLayout';
import {
  addExclusion,
  focusHint,
  goEasyAreaLabel,
  goEasyAreasOf,
  goEasyHint,
  goEasyNotice,
  imageUrlOf,
  isAreaBlocked,
  isFocusBlocked,
  isFocusPillDisabled,
  optionCode,
  removeExclusion,
  searchTerm,
  setExclusionReason,
  toggleFocus,
  toggleGoEasyArea,
  visibleSearchResults,
} from '../generatorLogic';
import { OptionPill, PillRow } from './GeneratorControls';
import { CloseIcon, SearchIcon } from './GeneratorIcons';

const SEARCH_DELAY_MS = 300;
// The remove disc: 38 visual, 44 hit.
const REMOVE_SIZE = 38;
const REMOVE_SLOP = (44 - REMOVE_SIZE) / 2;
const REMOVE_HIT_SLOP = Object.freeze({ top: REMOVE_SLOP, bottom: REMOVE_SLOP, left: REMOVE_SLOP, right: REMOVE_SLOP });

// T-18/T-40: a step-6 pill's hint is its section label; a blocked pill also
// gets the block hint (web: `aria-describedby` on the hint).
const pillHint = (sectionLabel, blockHint) => (blockHint ? `${sectionLabel}. ${blockHint}` : sectionLabel);

// One step-6 section. Phone (PlanGeneratorGoEasy410): bare, label 20/700.
// Tablet (TabletGenerator): a card (gradient-card, 0.08 edge, radius 26 drawn
// → radius-2xl 28, padding 24), label 17/600. The fill mounts with the card.
function Section({ tablet, label, hint, hintTone = 'muted', testID, children }) {
  return (
    <View testID={testID} style={tablet ? styles.sectionCard : null}>
      {tablet ? <GradientFill angle={gradients.card.angle} colors={gradients.card.colors} /> : null}
      <Text {...BODY_TEXT} style={tablet ? styles.sectionLabelTablet : styles.sectionLabel}>
        {label}
      </Text>
      {hint ? (
        <Text {...BODY_TEXT} style={[tablet ? styles.sectionHintTablet : styles.sectionHint, hintTone === 'secondary' && styles.textSecondary]}>
          {hint}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

// §G1.2 step 6; T-18 adds "Anything to go easy on?" when areas are offered.
// Order: Focus → Go easy → Avoid (all platforms).
export default function FocusAvoidStep({ answers, options, setAnswers, tablet = false, reflow = false, knownExercises, onResults }) {
  const max = options.max_focus_muscles;
  const reasons = (options.exclusion_reasons ?? ['DISLIKE', 'DISCOMFORT']).map(optionCode);
  const focusMuscles = options.focus_muscles ?? [];
  const areas = goEasyAreasOf(options);
  const hasAreas = areas.length > 0;
  const focusBlockHint = hasAreas ? focusHint(answers, areas, focusMuscles) : '';
  const areaBlockHint = hasAreas ? goEasyHint(answers, areas) : '';
  const pillSize = tablet ? 'focusTablet' : 'focus';
  const pillGap = tablet ? spacing['2_5'] : spacing[2];
  const pillsTop = tablet ? styles.mt16 : styles.mt12;

  return (
    <View testID="generator-step6" style={[styles.column, tablet && styles.columnTablet]}>
      <Section tablet={tablet} label={COPY.focusMuscles} hint={pickUpTo(max)} testID="generator-focus-section">
        <PillRow style={pillsTop} gap={pillGap}>
          {focusMuscles.map((muscle) => (
            <OptionPill
              key={muscle.id}
              size={pillSize}
              testID={`generator-focus-${muscle.id}`}
              label={muscle.name}
              selected={answers.focus_muscle_ids.includes(muscle.id)}
              disabled={isFocusPillDisabled(answers, muscle.id, max, areas)}
              accessibilityRole="togglebutton"
              accessibilityHint={pillHint(COPY.focusMuscles, isFocusBlocked(answers, muscle.id, areas) ? focusBlockHint : '')}
              onPress={() =>
                setAnswers((current) =>
                  isFocusBlocked(current, muscle.id, areas)
                    ? current
                    : { ...current, focus_muscle_ids: toggleFocus(current.focus_muscle_ids, muscle.id, max) }
                )
              }
            />
          ))}
        </PillRow>
        {hasAreas ? <BlockHint testID="generator-focus-block-hint" text={focusBlockHint} /> : null}
      </Section>
      {hasAreas ? (
        <Section tablet={tablet} label={COPY.goEasyLabel} hint={goEasyNotice(options)} hintTone="secondary" testID="generator-go-easy">
          <PillRow style={pillsTop} gap={pillGap}>
            {areas.map((area) => {
              const blocked = isAreaBlocked(answers, area);
              return (
                <OptionPill
                  key={area.id}
                  size={pillSize}
                  testID={`generator-go-easy-${area.id}`}
                  label={goEasyAreaLabel(area)}
                  selected={(answers.go_easy_area_ids ?? []).includes(area.id)}
                  disabled={blocked}
                  accessibilityRole="togglebutton"
                  accessibilityHint={pillHint(COPY.goEasyLabel, blocked ? areaBlockHint : '')}
                  onPress={() => setAnswers((current) => toggleGoEasyArea(current, area))}
                />
              );
            })}
          </PillRow>
          <BlockHint testID="generator-go-easy-block-hint" text={areaBlockHint} />
        </Section>
      ) : null}
      <Section tablet={tablet} label={COPY.exercisesToAvoid} testID="generator-avoid-section">
        <AvoidSearch
          tablet={tablet}
          exclusions={answers.exclusions}
          onResults={onResults}
          onChoose={(exercise) => setAnswers((current) => ({ ...current, exclusions: addExclusion(current.exclusions, exercise) }))}
        />
        {answers.exclusions.length ? (
          <View style={[styles.avoidList, tablet ? styles.mt14 : styles.mt12]}>
            {answers.exclusions.map((item) => (
              <AvoidedRow
                key={item.exercise?.id}
                item={item}
                reasons={reasons}
                tablet={tablet}
                reflow={reflow}
                known={knownExercises?.[item.exercise?.id]}
                setAnswers={setAnswers}
              />
            ))}
          </View>
        ) : null}
      </Section>
    </View>
  );
}

// An avoided exercise. Tablet: photo 64 (radius 16) + name 16/600 on the left,
// the reason pills + remove on the right (wrapping). Phone (derived): photo 48
// + name 14/700 + remove on the first line, the reason pills wrapping below.
// §9 reflow: everything stacks under the name. The photo shows only when the
// exercise is already loaded on the client (UX N4), else the §8.1 tile.
function AvoidedRow({ item, reasons, tablet, reflow, known, setAnswers }) {
  const id = item.exercise?.id;
  const name = item.exercise?.name;
  const exercise = known ?? item.exercise;
  const photo = (
    <ExerciseImage
      testID={`generator-avoid-photo-${id}`}
      url={imageUrlOf(known)}
      name={name}
      muscleCode={exercise?.primary_muscle_group?.code ?? null}
      size={tablet ? 64 : 48}
      style={tablet ? styles.avoidPhotoTablet : null}
    />
  );
  const nameText = (
    // §9: a user-facing name in a dense list may clip at 2 lines; the full
    // name stays in the accessibility label.
    <Text {...BODY_TEXT} numberOfLines={2} accessibilityLabel={name} style={[tablet ? styles.avoidNameTablet : styles.avoidName, styles.shrink]}>
      {name}
    </Text>
  );
  const pills = (
    <PillRow gap={spacing[2]}>
      {reasons.map((reason) => (
        <OptionPill
          key={reason}
          size="reason"
          testID={`generator-avoid-${id}-${reason}`}
          label={reasonLabel(reason)}
          selected={item.reason === reason}
          onPress={() => setAnswers((current) => ({ ...current, exclusions: setExclusionReason(current.exclusions, id, reason) }))}
        />
      ))}
    </PillRow>
  );
  const remove = (
    <Pressable
      testID={`generator-avoid-remove-${id}`}
      accessibilityRole="button"
      accessibilityLabel={removeLabel(name)}
      hitSlop={REMOVE_HIT_SLOP}
      onPress={() => setAnswers((current) => ({ ...current, exclusions: removeExclusion(current.exclusions, id) }))}
      style={styles.removeButton}
    >
      {({ pressed }) => (
        <>
          <PressOverlay pressed={pressed} />
          <CloseIcon size={16} color={colors.textSecondary} />
        </>
      )}
    </Pressable>
  );

  if (tablet && !reflow) {
    return (
      <View testID={`generator-avoid-${id}`} style={[styles.avoidRow, styles.avoidRowTablet]}>
        <View style={styles.avoidLeft}>
          {photo}
          {nameText}
        </View>
        <View style={styles.avoidRight}>
          {pills}
          {remove}
        </View>
      </View>
    );
  }
  return (
    <View testID={`generator-avoid-${id}`} style={[styles.avoidRow, styles.avoidRowStacked]}>
      <View style={styles.avoidTop}>
        {photo}
        <View style={styles.flex}>{nameText}</View>
        {remove}
      </View>
      {pills}
    </View>
  );
}

// T-18 block hint: shown only while a block exists (mt 8). A polite live
// region: Android reads the region's change; iOS has none, so it announces.
function BlockHint({ text, testID }) {
  useEffect(() => {
    if (text && Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(text);
    }
  }, [text]);
  return (
    <View accessibilityLiveRegion="polite">
      {text ? (
        <Text testID={testID} {...BODY_TEXT} style={[styles.blockHint, styles.mt8]}>
          {text}
        </Text>
      ) : null}
    </View>
  );
}

// 300 ms after typing stops, a non-empty trimmed term searches (per_page 20).
// A failed search shows no results; a newer term discards older replies.
// Phone: the 48 pill on surface; tablet: the 52 pill on surface-well; both
// with a hairline-strong edge and the search icon at the left.
function AvoidSearch({ exclusions, onChoose, onResults, tablet }) {
  const [text, setText] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const requestId = useRef(0);
  const resultsRef = useRef(onResults);
  resultsRef.current = onResults;

  const run = useCallback((value) => {
    const term = searchTerm(value);
    const id = ++requestId.current;
    if (!term) {
      setResults([]);
      setSearching(false);
      return () => {};
    }
    setSearching(true);
    const timer = setTimeout(() => {
      searchExercises(term)
        .then((items) => {
          if (requestId.current === id) {
            setResults(items);
            resultsRef.current?.(items);
          }
        })
        .catch(() => {
          if (requestId.current === id) {
            setResults([]);
          }
        })
        .finally(() => {
          if (requestId.current === id) {
            setSearching(false);
          }
        });
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => run(text), [text, run]);
  useEffect(
    () => () => {
      requestId.current += 1;
    },
    []
  );

  const visible = visibleSearchResults(results, exclusions);

  return (
    <View style={tablet ? styles.mt14 : styles.mt12}>
      <View style={styles.searchBox}>
        <TextInput
          {...textInputColors}
          testID="generator-avoid-search"
          value={text}
          onChangeText={setText}
          placeholder={COPY.searchPlaceholder}
          placeholderTextColor={colors.textFaint}
          maxFontSizeMultiplier={textScale.body}
          accessibilityLabel={COPY.searchPlaceholder}
          autoCorrect={false}
          autoCapitalize="none"
          style={[styles.search, tablet ? styles.searchTablet : styles.searchPhone]}
        />
        <View pointerEvents="none" style={[styles.searchIcon, tablet && styles.searchIconTablet]}>
          <SearchIcon size={18} color={colors.textFaint} />
        </View>
      </View>
      <View testID="generator-avoid-live" accessibilityLiveRegion="polite">
        {searching ? (
          <Text testID="generator-avoid-searching" {...BODY_TEXT} style={[styles.searching, styles.mt8]}>
            {COPY.searching}
          </Text>
        ) : null}
      </View>
      {visible.length ? (
        <View testID="generator-avoid-results" style={[styles.listCard, styles.mt8]}>
          {visible.map((item, index) => (
            <Pressable
              key={item.id}
              testID={`generator-avoid-result-${item.id}`}
              accessibilityRole="button"
              accessibilityLabel={item.name}
              onPress={() => {
                onChoose(item);
                setText('');
              }}
              style={[styles.resultRow, index > 0 && styles.divider]}
            >
              {({ pressed }) => (
                <>
                  <PressOverlay pressed={pressed} />
                  <ExerciseImage
                    testID={`generator-avoid-result-photo-${item.id}`}
                    url={imageUrlOf(item)}
                    name={item.name}
                    muscleCode={item.primary_muscle_group?.code ?? null}
                    size={40}
                  />
                  <Text {...BODY_TEXT} style={[styles.resultName, styles.flex]}>
                    {item.name}
                  </Text>
                </>
              )}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    minWidth: 0,
  },
  shrink: {
    flexShrink: 1,
  },
  // §G1.2 step 6 sections: 24 apart, areas or not (FE ac21d959 parity; the
  // boards draw 22).
  column: {
    gap: spacing[6],
  },
  columnTablet: {
    gap: spacing[6],
  },
  sectionCard: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.choiceBorder,
    padding: spacing[6],
    overflow: 'hidden',
  },
  sectionLabel: {
    ...font(700),
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.6,
    color: colors.textPrimary,
  },
  sectionLabelTablet: {
    ...font(600),
    fontSize: 17,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  sectionHint: {
    ...font(400),
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  sectionHintTablet: {
    ...font(400),
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  textSecondary: {
    color: colors.textSecondary,
  },
  blockHint: {
    ...font(400),
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  searchBox: {
    justifyContent: 'center',
  },
  search: {
    ...font(400),
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    paddingRight: spacing['3_5'],
    paddingVertical: spacing[3],
    fontSize: 16,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  // PlanGeneratorGoEasy410: 48 tall, surface fill, padding 0 14 0 44.
  searchPhone: {
    minHeight: 48,
    paddingLeft: 44,
    backgroundColor: colors.surface,
  },
  // TabletGenerator: 52 tall, surface-well fill, padding 0 16 0 46.
  searchTablet: {
    minHeight: 52,
    paddingLeft: 46,
    paddingRight: spacing[4],
    backgroundColor: colors.surfaceWell,
  },
  searchIcon: {
    position: 'absolute',
    left: spacing[4],
  },
  searchIconTablet: {
    left: spacing['4_5'],
  },
  searching: {
    ...font(400),
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  listCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: 56,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  resultName: {
    ...font(600),
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  avoidList: {
    gap: spacing['2_5'],
  },
  // TabletGenerator: radius-lg 20, fill-subtle 0.04 + hairline 0.07.
  avoidRow: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.fillWell,
    padding: spacing[3],
    paddingLeft: spacing['4_5'],
  },
  avoidRowTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  avoidRowStacked: {
    gap: spacing['2_5'],
    paddingLeft: spacing[3],
  },
  avoidLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    flexShrink: 1,
    minWidth: 0,
  },
  avoidRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  avoidTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  // Drawn 64 at radius 16 (the kit's 64 thumbnail would be 12).
  avoidPhotoTablet: {
    borderRadius: radii.md,
  },
  avoidName: {
    ...font(700),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  avoidNameTablet: {
    ...font(600),
    fontSize: 16,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  removeButton: {
    width: REMOVE_SIZE,
    height: REMOVE_SIZE,
    borderRadius: radii.full,
    backgroundColor: colors.fillGlass,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  mt8: {
    marginTop: 8,
  },
  mt12: {
    marginTop: 12,
  },
  mt14: {
    marginTop: 14,
  },
  mt16: {
    marginTop: 16,
  },
});
