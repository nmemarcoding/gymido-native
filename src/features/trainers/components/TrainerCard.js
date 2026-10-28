import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { CardHeroFill } from '../../../shared/components/Card';
import GradientFill from '../../../shared/components/GradientFill';
import { CAP_BODY, CAP_PILL, NAME_TITLE_TEXT } from '../../../shared/components/largeText';
import StatusPill from '../../../shared/components/StatusPill';
import { colors, font, muscleGlow, radii, spacing, typography } from '../../../shared/theme/tokens';
import { trainerDisplayName, trainerInitials } from '../../myTrainer/myTrainerFormat';
import PersonAvatar, { avatarColor } from '../personAvatar';

// The tablet card's soft corner glow: a 200 circle of the person's colour.
export const CARD_GLOW_SIZE = 200;

// TR1.3: the whole card is one pressable; "View profile" is part of it.
// v2 (UX L §Trainers / §Tablet: Trainers): phone = row card, 64 rounded-square
// avatar, "Trainer" pill; tablet = column card, 72 circle avatar, "Trainer"
// eyebrow, "View profile →" glass pill pinned to the bottom.
export default function TrainerCard({ trainer, onPress, style, tablet = false }) {
  const name = trainerDisplayName(trainer);
  const userId = trainer.user_id;
  return (
    <Pressable
      testID={`trainers-card-${userId}`}
      accessibilityRole="button"
      accessibilityLabel={`${name}, View profile`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, tablet ? styles.cardTablet : styles.cardPhone, pressed && styles.cardPressed, style]}
    >
      {({ pressed }) => (
        <>
          <CardHeroFill />
          {tablet ? (
            <View
              testID={`trainers-card-${userId}-glow`}
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={styles.glow}
            >
              <GradientFill {...muscleGlow(avatarColor(userId))} />
            </View>
          ) : null}
          {/* §8.6 state rule: pressed = rest + the 4 % overlay. */}
          {pressed ? (
            <View testID={`trainers-card-${userId}-pressed`} pointerEvents="none" style={[StyleSheet.absoluteFill, styles.overlay]} />
          ) : null}
          {tablet ? <TabletBody trainer={trainer} name={name} /> : <PhoneBody trainer={trainer} name={name} />}
        </>
      )}
    </Pressable>
  );
}

function Bio({ trainer, tablet = false }) {
  return trainer.bio ? (
    <Text {...CAP_BODY} numberOfLines={3} ellipsizeMode="tail" style={[styles.bio, tablet && styles.bioTablet]}>
      {trainer.bio}
    </Text>
  ) : (
    <Text {...CAP_BODY} style={[styles.bio, tablet && styles.bioTablet, styles.noBio]}>
      No bio yet.
    </Text>
  );
}

function PhoneBody({ trainer, name }) {
  return (
    <View style={styles.row}>
      <PersonAvatar
        testID={`trainers-card-${trainer.user_id}-avatar`}
        userId={trainer.user_id}
        name={name}
        initials={trainerInitials(trainer)}
        size={64}
        radius={radii.lgPlus}
        initialsSize={22}
      />
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text {...NAME_TITLE_TEXT} style={styles.name}>
            {name}
          </Text>
          <StatusPill label="Trainer" tone="gold" compact />
        </View>
        <Bio trainer={trainer} />
        <View style={styles.viewRow}>
          <Text {...CAP_BODY} style={styles.view}>
            View profile
          </Text>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M9 6l6 6-6 6" stroke={colors.gold} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
      </View>
    </View>
  );
}

function TabletBody({ trainer, name }) {
  return (
    <View style={styles.column}>
      <PersonAvatar
        testID={`trainers-card-${trainer.user_id}-avatar`}
        userId={trainer.user_id}
        name={name}
        initials={trainerInitials(trainer)}
        size={72}
        initialsSize={24}
        ring={{ gap: 4, gapColor: colors.surfaceInput, alpha: 0.5 }}
        style={styles.avatarTablet}
      />
      <View>
        <Text {...CAP_BODY} style={styles.eyebrowTablet}>
          Trainer
        </Text>
        <Text {...NAME_TITLE_TEXT} style={styles.nameTablet}>
          {name}
        </Text>
      </View>
      <Bio trainer={trainer} tablet />
      <View testID={`trainers-card-${trainer.user_id}-view`} style={styles.viewPill}>
        <Text {...CAP_PILL} style={styles.viewPillText}>
          View profile →
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.choiceBorder,
  },
  cardPhone: {
    borderRadius: radii.xxl,
    padding: spacing['4_5'],
  },
  // The board's radius 30 has no token: folded to radii.xxl 28 (reported).
  cardTablet: {
    borderRadius: radii.xxl,
    padding: spacing['5_5'],
    minHeight: 230,
  },
  // UX L: pressed border = gold 0.4, folded to the goldBorder step (0.35).
  cardPressed: {
    borderColor: colors.goldBorder,
  },
  overlay: {
    backgroundColor: colors.pressOverlay,
  },
  glow: {
    position: 'absolute',
    top: -CARD_GLOW_SIZE / 2,
    right: -CARD_GLOW_SIZE / 2,
    width: CARD_GLOW_SIZE,
    height: CARD_GLOW_SIZE,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[4],
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  name: {
    ...font(700),
    flexShrink: 1,
    fontSize: 19,
    lineHeight: 22,
    letterSpacing: -0.57,
    color: colors.textPrimary,
  },
  bio: {
    ...typography.bodySm,
    marginTop: spacing['1_5'],
    color: colors.textSecondary,
  },
  bioTablet: {
    marginTop: 0,
    fontSize: 15,
    lineHeight: 23,
  },
  noBio: {
    fontStyle: 'italic',
    color: colors.textFaint,
  },
  viewRow: {
    marginTop: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  view: {
    ...font(700),
    fontSize: 14,
    lineHeight: 20,
    color: colors.gold,
  },
  column: {
    flex: 1,
    gap: spacing[4],
  },
  avatarTablet: {
    alignSelf: 'flex-start',
  },
  eyebrowTablet: {
    ...font(600),
    fontSize: 13,
    lineHeight: 18,
    color: colors.gold,
  },
  nameTablet: {
    ...typography.titleMd,
    color: colors.textPrimary,
  },
  viewPill: {
    marginTop: 'auto',
    alignSelf: 'flex-start',
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing[4],
    borderRadius: radii.full,
    backgroundColor: colors.fillButton,
  },
  viewPillText: {
    ...font(600),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
});
