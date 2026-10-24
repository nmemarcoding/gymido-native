import { useNavigation } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import Spinner from '../../../shared/components/Spinner';
import { ToastTone, addToast } from '../../../shared/components/toastStore';
import { colors, radii, shadows } from '../../../shared/theme/tokens';
import { copyToMyPlans } from '../api/myPlansApi';
import { copyErrorMessage } from '../myPlanFormat';
import { myPlanRoutes } from '../myPlanRoutes';

// M5 (§M5): "Copy to my plans" on S2. The parent shows it only when S2's
// GET /plans/{id} succeeded (⚠M-5: an admin sees it on private plans too).
export default function CopyToMyPlansCard({ planId, style }) {
  const navigation = useNavigation();
  const mounted = useRef(true);
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState('');

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function copy() {
    setCopying(true);
    setCopyError('');
    try {
      const plan = await copyToMyPlans(planId);
      addToast(ToastTone.success, 'Plan copied', 'You’re now on your copy in My plans. Give it a name.');
      if (!mounted.current) {
        // The user left mid-request: never pull them forward.
        return;
      }
      // `copying` stays set: the screen is left. C9: M3 opens Edit details once.
      if (plan?.id === undefined || plan?.id === null || plan?.id === '') {
        // The 201 had no plan id: never open /my-custom-plans/undefined. The
        // copy exists, so open My plans, where it is listed.
        navigation.push(myPlanRoutes.MyPlans);
        return;
      }
      navigation.push(myPlanRoutes.MyPlan, { planId: plan.id, nameTheCopy: true });
    } catch (error) {
      if (mounted.current) {
        setCopyError(copyErrorMessage(error));
        setCopying(false);
      }
    }
  }

  return (
    <View testID="copy-to-my-plans" style={[styles.card, style]}>
      <Text style={styles.title}>Want to change it?</Text>
      <Text style={styles.body}>
        Copy it to My plans, then edit the copy any way you like. This plan stays as it is.
      </Text>
      <Pressable
        testID="copy-to-my-plans-button"
        accessibilityRole="button"
        accessibilityLabel="Copy to my plans"
        accessibilityState={{ disabled: copying, busy: copying }}
        disabled={copying}
        onPress={copy}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, copying && styles.buttonDisabled]}
      >
        {copying ? <Spinner size={16} thickness={2} color={colors.textPrimary} track={colors.border} /> : null}
        <Text style={styles.buttonLabel}>Copy to my plans</Text>
      </Pressable>
      {copyError ? (
        <Text testID="copy-to-my-plans-error" accessibilityRole="alert" style={styles.error}>
          {copyError}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xxxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 20,
    boxShadow: shadows.soft,
  },
  title: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  body: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  button: {
    marginTop: 16,
    width: '100%',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 12,
  },
  buttonPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  error: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 20,
    color: colors.danger,
  },
});
