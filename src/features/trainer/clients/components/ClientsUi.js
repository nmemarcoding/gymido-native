import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import GradientFill from '../../../../shared/components/GradientFill';
import { CAP_BODY, CAP_PILL, DISPLAY_TITLE_TEXT, TITLE_TEXT } from '../../../../shared/components/largeText';
import TextLink from '../../../../shared/components/TextLink';
import { colors, font, gradients, layout, radii, spacing, textScale, typography } from '../../../../shared/theme/tokens';
import { AlertGlyph, CheckGlyph } from './clientIcons';

// Shared pieces of the trainer Today / Clients / Client detail pages
// (RN-SPEC-v2-phase6 §2, UX phase6/N-trainer-home). v1 behaviour of
// RN-SPEC-TRAINER-CLIENTS §C1; v2 look.

// ---------------------------------------------------------------------------
// v2 pieces (this team's pages).

// X-7 the teal "Coaching" eyebrow pill (26 tall phone, 28 tablet; 6 px dot).
export function CoachingPill({ tablet = false }) {
  return (
    <View testID="coaching-pill" style={[styles.pill, tablet && styles.pillTablet]}>
      <View style={styles.pillDot} />
      <Text {...CAP_PILL} style={[styles.pillText, tablet && styles.pillTextTablet]}>
        Coaching
      </Text>
    </View>
  );
}

// The page intro under the shell header: the Coaching pill, the page title
// (h2; the shell title is the h1), a subline, then optional actions. `aside`
// sits at the right of the title block (the Clients "+" button).
// `titleRef` / `titleTestID`: the title as a focus target (t55m, Clients
// heading after the last client's coaching ends in the tablet pane).
export function PageIntro({ title, subtitle, tablet = false, pill = true, aside, children, testID, titleRef, titleTestID }) {
  return (
    <View testID={testID} style={styles.intro}>
      <View style={styles.introRow}>
        <View style={styles.introText}>
          {pill ? <CoachingPill tablet={tablet} /> : null}
          <Text
            {...(tablet ? DISPLAY_TITLE_TEXT : TITLE_TEXT)}
            ref={titleRef}
            testID={titleTestID}
            accessibilityRole="header"
            style={[styles.introTitle, tablet && styles.introTitleTablet, pill && styles.introTitleAfterPill]}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text {...CAP_BODY} style={[styles.introSub, tablet && styles.introSubTablet]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {aside ? <View style={styles.introAside}>{aside}</View> : null}
      </View>
      {children ? <View style={styles.introActions}>{children}</View> : null}
    </View>
  );
}

// A list card (surface, hairline, radius-xl) with hairline dividers.
export function ListCard({ children, style, testID }) {
  const rows = (Array.isArray(children) ? children.flat() : [children]).filter(Boolean);
  return (
    <View testID={testID} style={[styles.listCard, style]}>
      {rows.map((row, index) => (
        <View key={row.key ?? index} style={index > 0 && styles.divider}>
          {row}
        </View>
      ))}
    </View>
  );
}

// A row; pressable when `onPress` is set (STATE RULE: pressed = the rest
// colour + a 4 % white overlay).
// `rowRef` (t55m): the pressable as a focus target (tablet Clients).
export function ListRow({ onPress, children, testID, style, accessibilityLabel, accessibilityRole = 'button', selected, rowRef }) {
  if (!onPress) {
    return (
      <View testID={testID} style={[styles.row, style]}>
        {children}
      </View>
    );
  }
  return (
    <Pressable
      ref={rowRef}
      testID={testID}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={selected === undefined ? undefined : { selected }}
      onPress={onPress}
      style={[styles.row, style]}
    >
      {({ pressed }) => (
        <>
          {pressed ? (
            <View testID={testID ? `${testID}-pressed` : undefined} pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pressOverlay]} />
          ) : null}
          {children}
        </>
      )}
    </Pressable>
  );
}

// A section title (15/600, sentence case).
export function SectionHeading({ children, style }) {
  return (
    <Text {...TITLE_TEXT} accessibilityRole="header" style={[styles.sectionHeading, style]}>
      {children}
    </Text>
  );
}

// Heading + an optional trailing link ("Manage →", "See all").
export function SectionHead({ title, children, style }) {
  return (
    <View style={[styles.sectionHead, style]}>
      <SectionHeading style={styles.sectionHeadTitle}>{title}</SectionHeading>
      {children}
    </View>
  );
}

// "Manage →" / "See all": the kit TextLink (14/600 gold, 44 tall).
export function BrandLink({ label, onPress, testID, accessibilityLabel }) {
  return <TextLink testID={testID} label={label} onPress={onPress} accessibilityLabel={accessibilityLabel} />;
}

// A stat tile. `gold` = the gold-gradient card (X-3: a card, not an action);
// `large` = the tablet hero tile; `row` = the §9 reflow (label → value row).
// The gradient mounts with the tile (callers key the tile by `gold`, the
// Android render rule). `onPress` makes the tile a link.
export function StatTile({
  label,
  value,
  sub,
  valueColor = colors.textPrimary,
  gold = false,
  // The tablet hero tiles' gradient-card fill (when not gold).
  hero = false,
  large = false,
  row = false,
  onPress,
  testID,
  accessibilityLabel,
  style,
}) {
  const labelStyle = [styles.statLabel, large && styles.statLabelLarge, gold && styles.onGoldMuted];
  const valueStyle = [styles.statValue, large && styles.statValueLarge, row && styles.statValueRow, { color: gold ? colors.onGold : valueColor }];
  const body = (
    <>
      {gold ? <GradientFill angle={gradients.gold.angle} colors={gradients.gold.colors} stops={gradients.gold.stops} /> : null}
      {!gold && hero ? <GradientFill angle={gradients.card.angle} colors={gradients.card.colors} /> : null}
      {large ? (
        <Text {...CAP_BODY} style={labelStyle}>
          {label}
        </Text>
      ) : null}
      <Text
        testID={testID ? `${testID}-value` : undefined}
        maxFontSizeMultiplier={textScale.display}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        style={valueStyle}
      >
        {value}
      </Text>
      <View style={row ? styles.statRowText : null}>
        {large ? null : (
          <Text {...CAP_BODY} style={labelStyle}>
            {label}
          </Text>
        )}
        {sub ? (
          <Text {...CAP_BODY} style={[styles.statSub, large && styles.statSubLarge, gold && styles.onGoldMuted]}>
            {sub}
          </Text>
        ) : null}
      </View>
    </>
  );
  const frame = [styles.stat, large && styles.statLarge, gold ? styles.statGold : styles.statPlain, row && styles.statRow, style];
  if (onPress) {
    return (
      <Pressable testID={testID} accessibilityRole="link" accessibilityLabel={accessibilityLabel} onPress={onPress} style={frame}>
        {({ pressed }) => (
          <>
            {body}
            {pressed ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, gold ? styles.pressOverlayInk : styles.pressOverlay]} /> : null}
          </>
        )}
      </Pressable>
    );
  }
  return (
    <View testID={testID} accessible accessibilityLabel={accessibilityLabel} style={frame}>
      {body}
    </View>
  );
}

// The amber "Missed n this week" / green "On track" line (icon + text,
// never colour alone).
export function StatusLine({ tone, text, testID }) {
  const color = tone === 'success' ? colors.success : colors.warning;
  return (
    <View testID={testID} style={styles.statusLine}>
      {tone === 'success' ? <CheckGlyph size={12} color={color} /> : <AlertGlyph size={12} color={color} />}
      <Text {...CAP_BODY} style={[styles.statusText, { color }]}>
        {text}
      </Text>
    </View>
  );
}

// The small weekly ring beside "3/4" (decorative; the text carries it).
export const WEEK_RING = 20;
export function WeekRing({ done, planned, size = WEEK_RING }) {
  const stroke = 3;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const share = planned > 0 ? Math.min(1, Math.max(0, done / planned)) : 0;
  return (
    <Svg testID="week-ring" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.track} strokeWidth={stroke} fill="none" />
      {share > 0 ? (
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.gold}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference * share} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      ) : null}
    </Svg>
  );
}

export const clientStyles = StyleSheet.create({
  rowLabel: {
    ...font(600),
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  rowMeta: {
    ...font(400),
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  viewLink: {
    ...font(600),
    flexShrink: 0,
    fontSize: 14,
    lineHeight: 20,
    color: colors.gold,
  },
});

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing['1_5'],
    minHeight: 26,
    paddingHorizontal: spacing['2_5'],
    borderRadius: radii.full,
    backgroundColor: colors.tealTint,
  },
  pillTablet: {
    minHeight: 28,
    paddingHorizontal: spacing[3],
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.teal,
  },
  pillText: {
    ...font(600),
    fontSize: 12,
    lineHeight: 16,
    color: colors.teal,
  },
  pillTextTablet: {
    fontSize: 13,
    lineHeight: 18,
  },
  intro: {
    gap: spacing[3],
  },
  introRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  introText: {
    flex: 1,
    minWidth: 0,
  },
  introAside: {
    flexShrink: 0,
  },
  introTitle: {
    ...typography.titleXl,
    color: colors.textPrimary,
  },
  introTitleTablet: {
    ...typography.displayXl,
  },
  introTitleAfterPill: {
    marginTop: spacing['2_5'],
  },
  introSub: {
    ...typography.bodySm,
    marginTop: spacing[1],
    color: colors.textMuted,
  },
  introSubTablet: {
    fontSize: 17,
    lineHeight: 24,
    marginTop: spacing['2_5'],
    color: colors.textSecondary,
  },
  introActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  listCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  row: {
    minHeight: layout.touchMin,
    paddingVertical: spacing['3_5'],
    paddingHorizontal: spacing[4],
  },
  pressOverlay: {
    backgroundColor: colors.pressOverlay,
  },
  pressOverlayInk: {
    backgroundColor: colors.pressOverlayInk,
  },
  sectionHeading: {
    ...font(600),
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  sectionHead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: spacing[3],
  },
  sectionHeadTitle: {
    flexShrink: 1,
  },
  stat: {
    minHeight: 88,
    padding: spacing['3_5'],
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  statLarge: {
    minHeight: 200,
    padding: spacing[6],
    borderRadius: radii.xxl,
  },
  statPlain: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  statGold: {
    backgroundColor: colors.gold,
  },
  // §9 rule 4: past 1.3× a 3-up stat row becomes label → value rows.
  statRow: {
    minHeight: 0,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  statRowText: {
    flex: 1,
    minWidth: 0,
  },
  statValue: {
    ...font(700),
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -1.04,
    fontVariant: ['tabular-nums'],
  },
  statValueLarge: {
    ...typography.displayTimer,
    marginTop: spacing[2],
  },
  statValueRow: {
    flexShrink: 0,
  },
  statLabel: {
    ...typography.caption,
    marginTop: spacing['0_5'],
    color: colors.textMuted,
  },
  statLabelLarge: {
    fontSize: 15,
    lineHeight: 20,
    marginTop: 0,
    color: colors.textSecondary,
  },
  statSub: {
    ...typography.caption,
    marginTop: spacing['0_5'],
    color: colors.textMuted,
  },
  statSubLarge: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  onGoldMuted: {
    ...font(600),
    color: colors.onGoldMuted,
  },
  statusLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusText: {
    ...font(500),
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
