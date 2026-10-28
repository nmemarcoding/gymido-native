import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import ExerciseImage from '../../../../shared/components/ExerciseImage';
import { CAP_BODY, TITLE_TEXT } from '../../../../shared/components/largeText';
import Spinner from '../../../../shared/components/Spinner';
import { NBSP } from '../../../../shared/format/counts';
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

// UX M3 (RN-SPEC T-76): names wrap between words only, 2 lines then an
// ellipsis; the photo is 40 while the hub's content is under 20rem (320 ×
// the text scale, as a web rem) and hidden under 15rem.
export function rowPhotoSize(contentWidth, fontScale = 1) {
  if (!contentWidth) {
    return 56;
  }
  if (contentWidth < 240 * fontScale) {
    return 0;
  }
  return contentWidth < 320 * fontScale ? 40 : 56;
}

// T-74 carry (iPad, large text): a wrapped meta line must never START with
// "·". Each " · " becomes NBSP + "· ", so the separator stays on the line of
// the text before it and a break can only fall after it.
export function keepSeparatorsWithText(text) {
  return String(text ?? '').replace(/ · /g, `${NBSP}· `);
}

export default function HubDayRows({ copy, rows, exercisesByDay, startingDayId, onStart, cards = false, contentWidth = 0, fontScale = 1, style }) {
  const photoSize = rowPhotoSize(contentWidth, fontScale);
  const [width, setWidth] = useState(0);
  const columns = cards && width > 0 ? Math.max(1, Math.floor((width + CARD_GAP) / (CARD_MIN_WIDTH + CARD_GAP))) : 1;
  const cardWidth = columns > 1 ? (width - CARD_GAP * (columns - 1)) / columns : undefined;
  const rowNodes = rows.map((row, index) => (
    <DayRow
      key={row.dayId}
      row={row}
      last={cards || index === rows.length - 1}
      exercises={exercisesByDay[row.dayId]}
      photoSize={photoSize}
      starting={startingDayId === row.dayId}
      disabled={startingDayId != null}
      onPress={(ref) => onStart(row, ref)}
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

// `onPress(ref)`: the row's own ref, so a dialog can return focus to it.
function DayRow({ row, last, exercises, photoSize = 56, starting, disabled, onPress, style }) {
  const first = exercises?.[0]?.exercise;
  const ref = useRef(null);
  return (
    <Pressable
      ref={ref}
      testID={`workout-day-start-${row.dayId}`}
      accessibilityRole="button"
      accessibilityLabel={row.action}
      accessibilityState={{ disabled, busy: starting }}
      disabled={disabled}
      onPress={() => onPress(ref)}
      style={[styles.row, !last && styles.divider, style]}
    >
      {({ pressed }) => (
        <>
          {pressed ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pressed]} /> : null}
          {photoSize ? (
            <View style={row.done && styles.faded}>
              <ExerciseImage
                testID={`workout-day-photo-${row.dayId}`}
                exercise={first ?? null}
                name={first ? undefined : row.title}
                loading={exercises === undefined}
                size={photoSize}
                style={[styles.photo, photoSize === 40 && styles.photoSmall]}
              />
            </View>
          ) : null}
          <View style={styles.text}>
            <Text
              testID={`workout-day-name-${row.dayId}`}
              {...CAP_BODY}
              numberOfLines={2}
              ellipsizeMode="tail"
              textBreakStrategy="simple"
              android_hyphenationFrequency="none"
              lineBreakStrategyIOS="standard"
              style={[styles.name, row.done && styles.nameDone]}
            >
              {row.title}
            </Text>
            {row.done ? (
              <View style={styles.metaRow}>
                <View testID={`workout-day-done-${row.dayId}`} style={styles.doneMark}>
                  <CheckIcon size={13} color={colors.teal} strokeWidth={3.2} />
                  <Text {...CAP_BODY} style={[styles.meta, styles.doneText]}>
                    Done
                  </Text>
                  {/* The "·" stays with "✓ Done" (one unbreakable group). */}
                  <Text {...CAP_BODY} testID={`workout-day-done-separator-${row.dayId}`} style={styles.meta}>
                    ·
                  </Text>
                </View>
                <Text {...CAP_BODY} style={[styles.meta, styles.metaAfter]}>{keepSeparatorsWithText(row.meta)}</Text>
              </View>
            ) : (
              <Text {...CAP_BODY} style={[styles.meta, styles.metaGap]}>
                {keepSeparatorsWithText(row.meta)}
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
  photoSmall: {
    width: 40,
    height: 40,
    borderRadius: 12,
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
