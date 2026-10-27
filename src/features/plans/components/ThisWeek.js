import { Pressable, StyleSheet, Text, View } from 'react-native';

import ExerciseImage from '../../../shared/components/ExerciseImage';
import GradientFill from '../../../shared/components/GradientFill';
import { CAP_BODY, CAP_PILL } from '../../../shared/components/largeText';
import StatusPill from '../../../shared/components/StatusPill';
import { colors, font, gradients, radii, spacing, typography } from '../../../shared/theme/tokens';
import { compactSetSummary, stripCells } from '../libraryFormat';
import { thumbImageProps } from '../planImages';
import PlanIcon from './planIcons';
import { PressOverlay, useReflow } from './planUi';

const HIDDEN = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' };

// Approved #9 "This week" on Plan detail (current plan only): the week's
// training days from GET /my-plans/current/week, in week order (review M6:
// nothing is pinned first; the Done card comes last). Today = the gold-card with
// the ONE gold action (Start, announced "Start {day}") and a photo strip;
// missed / upcoming = surface cards (missed adds the warning pill); the done
// days fold into one summary card. Rest days have no card. Phone: a column
// (gap 12); tablet (N5): a 2-column grid under the hero.
// `cards` = thisWeekCards(...) (never null here).
export default function ThisWeek({ cards, tablet = false, onStart, onOpenExercise }) {
  const reflow = useReflow();
  const items = [];
  // Review M6: week order (a missed Monday before today), then Done.
  cards.open.forEach((card) =>
    items.push(
      card.status === 'today' ? (
        <TodayCard key="today" card={card} onStart={onStart} onOpenExercise={onOpenExercise} reflow={reflow} />
      ) : (
        <UpcomingCard key={card.key} card={card} />
      )
    )
  );
  if (cards.done) {
    items.push(<DoneCard key="done" done={cards.done} />);
  }
  if (items.length === 0) {
    return null;
  }
  const grid = tablet && !reflow;
  return (
    <View testID="plan-this-week" style={styles.section}>
      <Text {...CAP_BODY} accessibilityRole="header" style={styles.heading}>
        This week
      </Text>
      {grid ? (
        <View testID="plan-this-week-grid" style={styles.grid}>
          {items.map((item) => (
            <View key={item.key} style={styles.gridCell}>
              {item}
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.column}>{items}</View>
      )}
    </View>
  );
}

function DateTile({ card, gold = false }) {
  return (
    <View {...HIDDEN} style={[styles.dateTile, gold ? styles.dateTileGold : styles.dateTileQuiet]}>
      <Text allowFontScaling={false} style={[styles.dateDay, gold ? styles.inkOnGold : styles.dateDayQuiet]}>
        {(card.weekday?.label ?? '').toUpperCase()}
      </Text>
      {card.date ? (
        <Text allowFontScaling={false} style={[styles.dateNumber, gold ? styles.inkOnGold : styles.dateNumberQuiet]}>
          {card.date}
        </Text>
      ) : null}
    </View>
  );
}

function TodayCard({ card, onStart, onOpenExercise, reflow }) {
  const cells = stripCells(card.exercises);
  return (
    <View testID="plan-week-today" style={styles.todayCard}>
      <GradientFill angle={gradients.goldCard.angle} colors={gradients.goldCard.colors} />
      <Pressable
        testID="plan-week-start"
        accessibilityRole="link"
        accessibilityLabel={`Start ${card.title}`}
        onPress={() => onStart(card)}
        style={styles.todayRow}
      >
        {({ pressed }) => (
          <>
            <PressOverlay pressed={pressed} radius={radii.md} />
            <DateTile card={card} gold />
            <View style={styles.middle}>
              <View style={styles.titleRow}>
                <Text {...CAP_BODY} style={styles.cardTitle}>
                  {card.title}
                </Text>
                <Text {...CAP_PILL} style={styles.todayTag}>
                  Today
                </Text>
              </View>
              <Text {...CAP_BODY} style={styles.meta}>
                {card.meta}
              </Text>
            </View>
            <View {...HIDDEN} testID="plan-week-start-circle" style={styles.startCircle}>
              <PlanIcon name="play" size={16} color={colors.onGold} filled />
            </View>
          </>
        )}
      </Pressable>
      {cells.length ? (
        <View style={[styles.strip, reflow && styles.stripWrap]}>
          {cells.map(({ item, more }) => {
            const name = item.exercise?.name ?? '';
            return (
              <Pressable
                key={item.id}
                testID={`plan-week-exercise-${item.id}`}
                accessibilityRole="link"
                accessibilityLabel={`Open ${name}`}
                onPress={() => onOpenExercise(item)}
                style={[styles.stripCell, reflow && styles.stripCellWrap]}
              >
                <View>
                  <ExerciseImage
                    exercise={item.exercise}
                    {...thumbImageProps(item.exercise)}
                    size={60}
                    accessibilityLabel={name}
                    testID={`plan-week-image-${item.id}`}
                    style={[styles.stripImage, more ? styles.dimmed : null]}
                  />
                  {more ? (
                    <View {...HIDDEN} style={[StyleSheet.absoluteFill, styles.moreBox]}>
                      <Text allowFontScaling={false} style={styles.moreText}>{`+${more}`}</Text>
                    </View>
                  ) : null}
                </View>
                <Text {...CAP_BODY} numberOfLines={2} style={styles.stripCaption}>
                  {`${name} · ${compactSetSummary(item)}`}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function UpcomingCard({ card }) {
  const missed = card.status === 'missed';
  const thumbs = card.exercises.slice(0, 3);
  return (
    <View
      testID={`plan-week-${card.status}-${card.key}`}
      accessible
      accessibilityLabel={[card.weekday?.name, card.title, missed ? 'Missed' : null, card.meta].filter(Boolean).join(', ')}
      style={styles.quietCard}
    >
      <DateTile card={card} />
      <View style={styles.middle}>
        <Text {...CAP_BODY} style={styles.cardTitle}>
          {card.title}
        </Text>
        <Text {...CAP_BODY} style={styles.meta}>
          {card.meta}
        </Text>
        {missed ? <StatusPill testID="plan-week-missed-pill" label="Missed" tone="missed" style={styles.missedPill} /> : null}
      </View>
      {thumbs.length ? (
        <View {...HIDDEN} style={styles.stack}>
          {thumbs.map((item, index) => (
            <ExerciseImage
              key={item.id}
              exercise={item.exercise}
              {...thumbImageProps(item.exercise)}
              size={36}
              testID={`plan-week-thumb-${item.id}`}
              style={[styles.stackThumb, index > 0 && styles.stackOverlap]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function DoneCard({ done }) {
  return (
    <View testID="plan-week-done" accessible accessibilityLabel={`${done.titles}, ${done.label}`} style={[styles.quietCard, styles.doneCard]}>
      <View {...HIDDEN} style={[styles.dateTile, styles.doneTile]}>
        <PlanIcon name="check" size={20} color={colors.gold} strokeWidth={2.6} />
      </View>
      <View style={styles.middle}>
        <Text {...CAP_BODY} style={styles.cardTitle}>
          {done.titles}
        </Text>
        <Text {...CAP_BODY} style={styles.meta}>
          {done.label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing[3],
  },
  // 15/600 (label-lg), margin 8 4 0.
  heading: {
    ...font(600),
    marginTop: spacing[2],
    paddingHorizontal: spacing[1],
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  column: {
    gap: spacing[3],
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  gridCell: {
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: 0,
  },
  // gradient-gold-card + the gold border (0.5 → gold-strong 0.60 on the ladder).
  todayCard: {
    overflow: 'hidden',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.goldStrong,
  },
  todayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['3_5'],
    minHeight: 48,
  },
  quietCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['3_5'],
    padding: spacing[4],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  doneCard: {
    opacity: 0.8,
  },
  dateTile: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateTileGold: {
    backgroundColor: colors.gold,
  },
  // White 0.06 tile → fill-glass 0.08 (U8).
  dateTileQuiet: {
    backgroundColor: colors.fillGlass,
  },
  doneTile: {
    backgroundColor: colors.goldTint,
  },
  dateDay: {
    ...font(600),
    fontSize: 11,
    lineHeight: 13,
  },
  dateDayQuiet: {
    color: colors.textSecondary,
  },
  dateNumber: {
    ...font(700),
    fontSize: 16,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
  dateNumberQuiet: {
    color: colors.textPrimary,
  },
  inkOnGold: {
    color: colors.onGold,
  },
  middle: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: spacing[2],
  },
  cardTitle: {
    ...font(600),
    fontSize: 17,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  todayTag: {
    ...font(600),
    fontSize: 12,
    lineHeight: 16,
    color: colors.gold,
  },
  meta: {
    ...typography.label,
    ...font(400),
    marginTop: spacing['0_5'],
    color: colors.textMuted,
  },
  // 36 gold circle with the play icon (inside the 48+ row link).
  startCircle: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
  },
  strip: {
    flexDirection: 'row',
    gap: spacing['1_5'],
  },
  stripWrap: {
    flexWrap: 'wrap',
  },
  stripCell: {
    flex: 1,
    minWidth: 0,
    gap: spacing[1],
  },
  stripCellWrap: {
    flexGrow: 1,
    flexBasis: '45%',
  },
  stripImage: {
    width: '100%',
    height: 60,
    borderRadius: radii.sm,
  },
  dimmed: {
    opacity: 0.5,
  },
  moreBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: {
    ...font(700),
    fontSize: 14,
    lineHeight: 18,
    color: colors.textPrimary,
  },
  stripCaption: {
    ...font(400),
    fontSize: 11,
    lineHeight: 13,
    color: colors.textSecondary,
  },
  missedPill: {
    marginTop: spacing['1_5'],
  },
  stack: {
    flexDirection: 'row',
  },
  stackThumb: {
    borderWidth: 2,
    borderColor: colors.surface,
    borderRadius: radii.sm,
  },
  stackOverlap: {
    marginLeft: -10,
  },
});
