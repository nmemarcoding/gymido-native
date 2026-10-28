import { useNavigation } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CAP_BODY } from '../../../shared/components/largeText';
import PillButton from '../../../shared/components/PillButton';
import { ToastTone, addToast } from '../../../shared/components/toastStore';
import { colors, font, radii, spacing } from '../../../shared/theme/tokens';
import { getServerMessage } from '../../../shared/api/apiError';
import { createPlanWrites, listDifficultyLevels, listPlanCategories } from '../../trainer/plans/api/plansApi';
import EditPlanDetailsModal from '../../trainer/plans/components/EditPlanDetailsModal';
import { COPY_KEPT_MESSAGE, COPY_KEPT_TITLE, COPY_SAVE_FAILED_TITLE, planFieldErrors, saveCopy } from '../../trainer/plans/copyOnSave';
import { copyToMyPlans } from '../api/myPlansApi';
import { copyErrorMessage } from '../myPlanFormat';
import { myPlanRoutes } from '../myPlanRoutes';

export const COPY_SUCCESS_TITLE = 'Plan copied';
// T-78 (C10): the copy is named in "Name your copy" before it exists.
export const COPY_SUCCESS_MESSAGE = 'You’re now on your copy in My plans.';
// UX H / RN-SPEC-v2-phase4 §2: a 201 without a plan id.
export const COPY_NO_ID_MESSAGE = 'Your copy is in My plans.';

// M5 (§M5): "Copy to my plans" on S2. The parent shows it only when S2's
// GET /plans/{id} succeeded (⚠M-5: an admin sees it on private plans too).
// v2 look (UX H CopyToMyPlansCard): radius 28, padding 22, the surface card;
// "Want to change it?" 16/600, body 14/21 secondary, a full-width glass
// button (spinner before the label and disabled while copying), the error
// line 14 danger-text under it (role alert).
// T-78 (RN-SPEC-TRAINER-PLANS C10, supersedes C9): the button opens "Name
// your copy" (Edit details prefilled from THIS plan) on this screen; the copy
// is created only on "Save copy" (POST, then a PATCH of the changed fields).
// Dismissing creates nothing and is ignored while the save runs.
export default function CopyToMyPlansCard({ planId, plan, dayCount = 0, style }) {
  const navigation = useNavigation();
  const mounted = useRef(true);
  const [copying, setCopying] = useState(false);
  const copyingRef = useRef(false);
  const [copyError, setCopyError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  // The dialog mounts on the first open (and stays, for its close animation).
  const [dialogMounted, setDialogMounted] = useState(false);
  const [categories, setCategories] = useState([]);
  const [levels, setLevels] = useState([]);
  const lookupsLoaded = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function openDialog() {
    if (copyingRef.current) {
      return;
    }
    setCopyError('');
    if (!lookupsLoaded.current) {
      lookupsLoaded.current = true;
      listPlanCategories()
        .catch(() => [])
        .then((items) => mounted.current && setCategories(items));
      listDifficultyLevels()
        .catch(() => [])
        .then((items) => mounted.current && setLevels(items));
    }
    setDialogMounted(true);
    setDialogOpen(true);
  }

  function closeDialog() {
    if (!copyingRef.current) {
      setDialogOpen(false);
    }
  }

  // Resolves to the dialog's field errors (a 422 on the copy's PATCH), else null.
  async function saveFromDialog(changes) {
    if (copyingRef.current) {
      return null;
    }
    copyingRef.current = true;
    setCopying(true);
    const outcome = await saveCopy({
      copy: () => copyToMyPlans(planId),
      writesFor: (copyId) => createPlanWrites(`/my-custom-plans/${copyId}`),
      changes,
    });
    copyingRef.current = false;
    if (!mounted.current) {
      // The user left mid-request: never pull them forward.
      return null;
    }
    setCopying(false);
    switch (outcome.kind) {
      case 'copied':
        setDialogOpen(false);
        addToast(ToastTone.success, COPY_SUCCESS_TITLE, COPY_SUCCESS_MESSAGE);
        navigation.push(myPlanRoutes.MyPlan, { planId: outcome.id });
        return null;
      case 'noId':
        // The 201 had no plan id: never open /my-custom-plans/undefined. The
        // copy exists, so open My plans, where it is listed.
        setDialogOpen(false);
        addToast(ToastTone.success, COPY_SUCCESS_TITLE, COPY_NO_ID_MESSAGE);
        navigation.push(myPlanRoutes.MyPlans);
        return null;
      case 'kept':
        setDialogOpen(false);
        addToast(ToastTone.error, COPY_KEPT_TITLE, COPY_KEPT_MESSAGE);
        navigation.push(myPlanRoutes.MyPlan, { planId: outcome.id });
        return null;
      case 'patchFailed': {
        // The copy is deleted; the dialog stays open for another Save.
        const fieldErrors = planFieldErrors(outcome.error);
        if (!fieldErrors) {
          addToast(ToastTone.error, COPY_SAVE_FAILED_TITLE, getServerMessage(outcome.error));
        }
        return fieldErrors;
      }
      default:
        // The copy POST failed: nothing exists; the texts under the button.
        setDialogOpen(false);
        setCopyError(copyErrorMessage(outcome.error));
        return null;
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
        onPress={openDialog}
        style={styles.button}
      />
      {copyError ? (
        <Text {...CAP_BODY} testID="copy-to-my-plans-error" accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
          {copyError}
        </Text>
      ) : null}
      {dialogMounted ? (
        <EditPlanDetailsModal
          copy
          isOpen={dialogOpen}
          onClose={closeDialog}
          plan={plan}
          dayCount={dayCount}
          categories={categories}
          levels={levels}
          affectedCount={0}
          onSubmit={saveFromDialog}
        />
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
