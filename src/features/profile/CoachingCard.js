import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { routes } from '../../navigation/routes';
import { useFocusRemountKey } from '../../shared/hooks/useFocusRemountKey';
import { colors, radii, shadows } from '../../shared/theme/tokens';
import { getMyTrainer, listPendingTrainerRequests } from '../myTrainer/api/myTrainerApi';
import { coachingStatus } from '../myTrainer/myTrainerFormat';

// Profile P1.3 2a (5-tab nav, 23 Oct): the door into the trainer hub, pushed
// in the Profile stack. Renders at once; the status fills in on each focus,
// and any failure leaves it empty.
export default function CoachingCard() {
  const remountKey = useFocusRemountKey();
  return <Card key={remountKey} />;
}

function Card() {
  const navigation = useNavigation();
  const [status, setStatus] = useState('');

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

  return (
    <Pressable
      testID="profile-coaching-card"
      accessibilityRole="button"
      accessibilityLabel={['Coaching', status].filter(Boolean).join(', ')}
      onPress={() => navigation.push(routes.MyTrainer)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.tile} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={styles.glyph}>◎</Text>
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>Coaching</Text>
        <Text numberOfLines={1} style={styles.status}>
          {status}
        </Text>
      </View>
      <Text style={styles.chevron} accessibilityElementsHidden importantForAccessibility="no">
        ›
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    boxShadow: shadows.soft,
  },
  cardPressed: {
    backgroundColor: colors.rowPressedStrong,
  },
  tile: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  glyph: {
    fontSize: 18,
    lineHeight: 22,
    color: colors.brand700,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  status: {
    minHeight: 16,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  chevron: {
    fontSize: 18,
    lineHeight: 24,
    color: colors.textMuted,
  },
});
