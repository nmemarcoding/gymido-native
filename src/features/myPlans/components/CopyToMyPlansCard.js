import { useNavigation } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CAP_BODY } from '../../../shared/components/largeText';
import PillButton from '../../../shared/components/PillButton';
import { ToastTone, addToast } from '../../../shared/components/toastStore';
import { colors, font, radii, spacing } from '../../../shared/theme/tokens';
import { copyToMyPlans } from '../api/myPlansApi';
import { copyErrorMessage } from '../myPlanFormat';
import { myPlanRoutes } from '../myPlanRoutes';

export const COPY_SUCCESS_TITLE = 'Plan copied';
export const COPY_SUCCESS_MESSAGE = 'You’re now on your copy in My plans. Give it a name.';
// UX H / RN-SPEC-v2-phase4 §2: a 201 without a plan id.
export const COPY_NO_ID_MESSAGE = 'Your copy is in My plans.';

// M5 (§M5): "Copy to my plans" on S2. The parent shows it only when S2's
// GET /plans/{id} succeeded (⚠M-5: an admin sees it on private plans too).
// v2 look (UX H CopyToMyPlansCard): radius 28, padding 22, the surface card;
// "Want to change it?" 16/600, body 14/21 secondary, a full-width glass
// button (spinner before the label and disabled while copying), the error
// line 14 danger-text under it (role alert).
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
      const hasId = !(plan?.id === undefined || plan?.id === null || plan?.id === '');
      addToast(ToastTone.success, COPY_SUCCESS_TITLE, hasId ? COPY_SUCCESS_MESSAGE : COPY_NO_ID_MESSAGE);
      if (!mounted.current) {
        // The user left mid-request: never pull them forward.
        return;
      }
      // `copying` stays set: the screen is left. C9: M3 opens Edit details once.
      if (!hasId) {
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
      <Text {...CAP_BODY} accessibilityRole="header" style={styles.title}>
        Want to change it?
      </Text>
      <Text {...CAP_BODY} style={styles.body}>
        Copy it to My plans, then edit the copy any way you like. This plan stays as it is.
      </Text>
      <PillButton
        testID="copy-to-my-plans-button"
        title="Copy to my plans"
        variant="secondary"
        fullWidth
        loading={copying}
        disabled={copying}
        onPress={copy}
        style={styles.button}
      />
      {copyError ? (
        <Text {...CAP_BODY} testID="copy-to-my-plans-error" accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
          {copyError}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    padding: spacing['5_5'],
  },
  title: {
    ...font(600),
    fontSize: 16,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  body: {
    ...font(400),
    marginTop: spacing[1],
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  button: {
    marginTop: spacing[4],
  },
  error: {
    ...font(400),
    marginTop: spacing[3],
    fontSize: 14,
    lineHeight: 20,
    color: colors.dangerText,
  },
});
