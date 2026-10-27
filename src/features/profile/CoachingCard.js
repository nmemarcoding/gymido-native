import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { routes } from '../../navigation/routes';
import GradientFill from '../../shared/components/GradientFill';
import { CAP_BODY, useLargeTextReflow } from '../../shared/components/largeText';
import { useFocusRemountKey } from '../../shared/hooks/useFocusRemountKey';
import { colors, font, gradients, radii, spacing, typography } from '../../shared/theme/tokens';
import { getMyTrainer, listPendingTrainerRequests } from '../myTrainer/api/myTrainerApi';
import { coachingStatus } from '../myTrainer/myTrainerFormat';
import ProfileIcon from './ProfileIcon';

// Profile P1.3 2a (5-tab nav, 23 Oct): the door into the trainer hub, pushed
// in the Profile stack. Renders at once; the status fills in on each focus,
// and any failure leaves it empty.
// v2 (UX K, Q1 teal accents as drawn):
//   layout="pair"  phone: the left half of the Coaching · Add weight pair,
//                  teal-line edge, teal title, the status under it.
//   layout="row"   tablet: gradient card, teal icon tile, title, status, chevron.
export default function CoachingCard({ layout = 'row' }) {
  const remountKey = useFocusRemountKey();
  return <Card key={remountKey} layout={layout} />;
}

function Card({ layout }) {
  const navigation = useNavigation();
  const [status, setStatus] = useState('');
  const reflow = useLargeTextReflow();

  useEffect(() => {
    let alive = true;
    Promise.all([getMyTrainer(), listPendingTrainerRequests()])
      .then(([mine, requests]) => {
        if (alive) {
          setStatus(coachingStatus(mine, requests));
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const pair = layout === 'pair';
  // One line as drawn; past 1.3× text the status wraps instead (UX §9 rule 2).
  const statusLines = reflow ? undefined : 1;

  return (
    <Pressable
      testID="profile-coaching-card"
      // UX K accessibility: one link named "Coaching" + the status.
      accessibilityRole="link"
      accessibilityLabel={['Coaching', status].filter(Boolean).join(', ')}
      onPress={() => navigation.push(routes.MyTrainer)}
      style={pair ? styles.pair : styles.row}
    >
      {({ pressed }) => (
        <>
          {pair ? null : (
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <GradientFill angle={gradients.card.angle} colors={gradients.card.colors} />
            </View>
          )}
          {pressed ? <View testID="profile-coaching-card-pressed" pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pressed]} /> : null}
          {pair ? null : (
            <View style={styles.tile} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <ProfileIcon name="coaching" size={20} color={colors.teal} />
            </View>
          )}
          <View style={styles.text}>
            <Text {...CAP_BODY} style={[styles.title, pair && styles.titlePair]}>
              Coaching
            </Text>
            <Text {...CAP_BODY} numberOfLines={statusLines} style={[styles.status, pair ? styles.statusPair : styles.statusRow]}>
              {status}
            </Text>
          </View>
          {pair ? null : <ProfileIcon name="chevron" size={16} color={colors.textDisabled} />}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Phone pair card: radius-lg 20, padding 14, surface, the 0.25 teal edge
  // (ladder: teal-line 0.30).
  pair: {
    flex: 1,
    minWidth: 0,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.tealLine,
    backgroundColor: colors.surface,
    padding: spacing['3_5'],
    overflow: 'hidden',
  },
  // Tablet card: radius 24, padding 16 18, gradient-card (the drawn
  // 1B1D24 → 13151A folds into it), hairline.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing['4_5'],
    overflow: 'hidden',
  },
  // UX §8.6 STATE RULE: the rest fill + a 4 % white overlay.
  pressed: {
    backgroundColor: colors.pressOverlay,
  },
  tile: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealTint,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...typography.body,
    ...font(600),
    color: colors.textPrimary,
  },
  titlePair: {
    color: colors.teal,
  },
  status: {
    minHeight: 16,
    color: colors.textMuted,
  },
  statusPair: {
    ...typography.caption,
    marginTop: 3,
  },
  statusRow: {
    ...typography.label,
    ...font(400),
    marginTop: spacing['0_5'],
  },
});
