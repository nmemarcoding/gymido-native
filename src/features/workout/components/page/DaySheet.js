import { StyleSheet, Text, View } from 'react-native';

import AppModal from '../../../../shared/components/AppModal';
import { CAP_BADGE, CAP_BODY, LINE_TEXT } from '../../../../shared/components/largeText';
import PillButton from '../../../../shared/components/PillButton';
import Skeleton from '../../../../shared/components/Skeleton';
import { colors, font } from '../../../../shared/theme/tokens';
import { PlayIcon } from '../hub/HubIcons';

// T-140 (UX build ruling §5): one sheet per day type. Phone: the kit bottom
// sheet (AppModal: handle, eyebrow, title, ×; scrim / swipe / × close);
// tablet: AppModal's centred card. The list shows at most 6 rows, then
// "+N more". The action only hands back to the page, which runs today's
// existing start flows (start / catch-up confirm / start-early confirm).

const TONES = Object.freeze({ today: colors.gold, done: colors.teal, missed: colors.warning, future: colors.textStrong2, rest: colors.textMuted });
const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' };

function Rows({ list, rows }) {
  if (rows === undefined) {
    return (
      <View testID="workout-sheet-loading" style={styles.list}>
        <Skeleton style={styles.skeletonRow} />
        <Skeleton style={styles.skeletonRow} />
        <Skeleton style={styles.skeletonRow} />
      </View>
    );
  }
  if (!rows?.rows.length) {
    return null;
  }
  const done = list === 'done';
  return (
    <View testID="workout-sheet-list" style={styles.list}>
      {rows.rows.map((row) => (
        <View key={row.key} accessible accessibilityLabel={`${row.name}${done ? ', done' : ''}, ${row.meta}`} style={styles.row}>
          <View {...hidden} style={[styles.mark, done ? styles.markDone : styles.markOpen]}>
            {done ? <Text {...CAP_BADGE} style={styles.markText}>✓</Text> : null}
          </View>
          <Text {...LINE_TEXT} style={styles.rowName}>
            {row.name}
          </Text>
          <Text {...CAP_BODY} style={styles.rowMeta}>
            {row.meta}
          </Text>
        </View>
      ))}
      {rows.more > 0 ? (
        <View testID="workout-sheet-more" style={styles.row}>
          <Text {...CAP_BODY} style={styles.moreText}>{`+${rows.more} more`}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function DaySheet({ sheet, rows, isOpen, onClose, onAction, starting = false }) {
  const tone = TONES[sheet?.tone] ?? colors.textMuted;
  let footer = null;
  if (sheet?.action === 'early') {
    footer = <PillButton testID="workout-sheet-action" variant="secondary" fullWidth title="Start early" loading={starting} onPress={onAction} />;
  } else if (sheet?.action) {
    footer = (
      <PillButton
        testID="workout-sheet-action"
        fullWidth
        title={`Start ${sheet.title}`}
        loading={starting}
        icon={({ color }) => <PlayIcon size={16} color={color} />}
        onPress={onAction}
      />
    );
  }
  return (
    <AppModal
      testID="workout-day-sheet"
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      eyebrow={
        sheet ? (
          <Text {...CAP_BODY} testID="workout-sheet-eyebrow" style={[styles.eyebrow, { color: tone }]}>
            {sheet.eyebrow}
          </Text>
        ) : null
      }
      title={sheet?.title ?? ''}
      description={sheet?.meta || undefined}
      footer={
        footer || sheet?.note ? (
          <View style={styles.footer}>
            {footer}
            {sheet?.note ? (
              <Text {...CAP_BODY} testID="workout-sheet-note" style={styles.note}>
                {sheet.note}
              </Text>
            ) : null}
          </View>
        ) : undefined
      }
    >
      {sheet?.list ? <Rows list={sheet.list} rows={rows} /> : null}
    </AppModal>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    ...font(600),
    fontSize: 13,
    lineHeight: 18,
  },
  list: {
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 40,
    borderTopWidth: 1,
    borderTopColor: colors.hairlineFaint,
  },
  mark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markDone: {
    backgroundColor: colors.teal,
  },
  markOpen: {
    borderWidth: 1.5,
    borderColor: colors.markRing,
  },
  markText: {
    ...font(700),
    fontSize: 12,
    color: colors.onGold,
  },
  rowName: {
    ...font(400),
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  rowMeta: {
    ...font(400),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  moreText: {
    ...font(400),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  skeletonRow: {
    height: 40,
    marginTop: 4,
    borderRadius: 8,
  },
  footer: {
    gap: 12,
  },
  note: {
    ...font(400),
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
