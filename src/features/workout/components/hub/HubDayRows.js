import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import ExerciseImage from '../../../../shared/components/ExerciseImage';
import { CAP_BODY, TITLE_TEXT } from '../../../../shared/components/largeText';
import Spinner from '../../../../shared/components/Spinner';
import { colors, font, radii, spacing, titleTracking } from '../../../../shared/theme/tokens';
import { CheckIcon, ChevronRightIcon } from './HubIcons';

// T-76 "Other days" (and its per-state names): one row per plan day, the
// whole row is the one tap target that starts the day ("Start Lower B"), a
// done day is faded with a teal "✓ Done" and repeats it ("Repeat Upper A").
// The photo is the day's first exercise (lazy; none → the initials tile).
// `cards` (tablet landscape): each row its own card, in as many columns of at
// least 300 as fit.
export const CARD_MIN_WIDTH = 300;
const CARD_GAP = 12;

export default function HubDayRows({ copy, rows, exercisesByDay, startingDayId, onStart, cards = false, style }) {
  const [width, setWidth] = useState(0);
  const columns = cards && width > 0 ? Math.max(1, Math.floor((width + CARD_GAP) / (CARD_MIN_WIDTH + CARD_GAP))) : 1;
  const cardWidth = columns > 1 ? (width - CARD_GAP * (columns - 1)) / columns : undefined;
  const rowNodes = rows.map((row, index) => (
    <DayRow
      key={row.dayId}
      row={row}
      last={cards || index === rows.length - 1}
      exercises={exercisesByDay[row.dayId]}
      starting={startingDayId === row.dayId}
      disabled={startingDayId != null}
      onPress={() => onStart(row.dayId)}
      style={cards ? [styles.card, cardWidth ? { width: cardWidth } : styles.fullWidth] : null}
    />
  ));
  return (
    <View testID="workout-other-days" style={[styles.block, style]}>
      <View style={styles.head}>
        <Text accessibilityRole="header" {...TITLE_TEXT} style={styles.title}>
          {copy.title}
        </Text>
        <Text {...CAP_BODY} style={styles.help}>
          {copy.help}
        </Text>
      </View>
      {cards ? (
        <View testID="workout-day-cards" style={styles.cards} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
          {rowNodes}
        </View>
      ) : (
        <View style={styles.list}>{rowNodes}</View>
      )}
    </View>
  );
}

function DayRow({ row, last, exercises, starting, disabled, onPress, style }) {
  const first = exercises?.[0]?.exercise;
  return (
    <Pressable
      testID={`workout-day-start-${row.dayId}`}
      accessibilityRole="button"
      accessibilityLabel={row.action}
      accessibilityState={{ disabled, busy: starting }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.row, !last && styles.divider, style]}
    >
      {({ pressed }) => (
        <>
          {pressed ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pressed]} /> : null}
          <View style={row.done && styles.faded}>
            <ExerciseImage
              testID={`workout-day-photo-${row.dayId}`}
              exercise={first ?? null}
              name={first ? undefined : row.title}
              loading={exercises === undefined}
              size={56}
              style={styles.photo}
            />
          </View>
          <View style={styles.text}>
            <Text {...CAP_BODY} style={[styles.name, row.done && styles.nameDone]}>
              {row.title}
            </Text>
            {row.done ? (
              <View style={styles.metaRow}>
                <View testID={`workout-day-done-${row.dayId}`} style={styles.doneMark}>
                  <CheckIcon size={13} color={colors.teal} strokeWidth={3.2} />
                  <Text {...CAP_BODY} style={[styles.meta, styles.doneText]}>
                    Done
                  </Text>
                </View>
                <Text {...CAP_BODY} style={[styles.meta, styles.metaAfter]}>{`· ${row.meta}`}</Text>
              </View>
            ) : (
              <Text {...CAP_BODY} style={[styles.meta, styles.metaGap]}>
                {row.meta}
              </Text>
            )}
          </View>
          {starting ? <Spinner size={18} thickness={2} color={colors.textMuted} /> : <ChevronRightIcon size={18} color={colors.textMuted} />}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 10,
  },
  head: {
    paddingHorizontal: spacing[1],
  },
  title: {
    ...font(700),
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: titleTracking(20, -0.02),
    color: colors.textPrimary,
  },
  help: {
    ...font(400),
    marginTop: 2,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  list: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  cards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  card: {
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  fullWidth: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 56,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  pressed: {
    backgroundColor: colors.pressOverlay,
  },
  faded: {
    opacity: 0.55,
  },
  photo: {
    width: 56,
    height: 56,
    borderRadius: 14,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    ...font(600),
    fontSize: 17,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  nameDone: {
    color: colors.textSecondary,
  },
  meta: {
    ...font(400),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  metaGap: {
    marginTop: 2,
  },
  metaRow: {
    marginTop: 2,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 4,
  },
  doneMark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  doneText: {
    ...font(600),
    color: colors.teal,
  },
  metaAfter: {
    flexShrink: 1,
  },
});
