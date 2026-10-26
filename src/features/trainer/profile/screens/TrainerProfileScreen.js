import { useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import ErrorAlert from '../../../../shared/components/ErrorAlert';
import FormField from '../../../../shared/components/FormField';
import PillButton from '../../../../shared/components/PillButton';
import { ToastTone, addToast } from '../../../../shared/components/toastStore';
import { useFocusRemountKey } from '../../../../shared/hooks/useFocusRemountKey';
import { breakpoints, colors, radii, shadows } from '../../../../shared/theme/tokens';
import ShellPage from '../../../shell/ShellPage';
import TrainerOnly from '../../TrainerOnly';
import { CoachingHeader } from '../../clients/components/ClientsUi';
import { updateTrainerProfile } from '../api/trainerProfileApi';
import {
  BIO_MAX_LENGTH,
  BIO_ROWS,
  DISPLAY_NAME_MAX_LENGTH,
  SAVED_TOAST_MESSAGE,
  SAVED_TOAST_TITLE,
  buildTrainerProfilePayload,
  initialTrainerProfileValues,
  trainerProfileSaveError,
} from '../trainerProfileForm';

const NO_AUTOFILL = { autoComplete: 'off', textContentType: 'none', importantForAutofill: 'no' };

// RN-SPEC-trainer-profile TP1 (`/trainer/profile`, the TProfile tab root).
// ⚠TP-1: no load; every focus remounts the form blank, as the web route does.
export default function TrainerProfileScreen() {
  const remountKey = useFocusRemountKey();
  return (
    <TrainerOnly>
      <ShellPage testID="trainer-profile-screen">
        <TrainerProfileForm key={remountKey} />
      </ShellPage>
    </TrainerOnly>
  );
}

function TrainerProfileForm() {
  const { width } = useWindowDimensions();
  const [values, setValues] = useState(initialTrainerProfileValues);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  // Guards a second press landing before `saving` re-renders.
  const savingRef = useRef(false);

  const setField = (key) => (text) => {
    setValues((current) => ({ ...current, [key]: text }));
    setSaved(false);
  };

  async function submit() {
    if (savingRef.current) {
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      await updateTrainerProfile(buildTrainerProfilePayload(values));
      setSaved(true);
      // ⚠TP-4: "Saved." and the toast both show.
      addToast(ToastTone.success, SAVED_TOAST_TITLE, SAVED_TOAST_MESSAGE);
    } catch (failure) {
      setError(trainerProfileSaveError(failure));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <View style={styles.column}>
      <CoachingHeader title="Trainer profile" subtitle="How you appear to members browsing for a trainer." />
      <View testID="trainer-profile-card" style={[styles.card, width >= breakpoints.sm ? styles.cardWide : null]}>
        <Text style={styles.intro}>
          Saving this makes you discoverable under Find a trainer. Members see your name and bio there.
        </Text>
        {error ? (
          <View testID="trainer-profile-error" style={styles.mt20}>
            <ErrorAlert title="Could not save" description={error} />
          </View>
        ) : null}
        <View style={[styles.mt20, styles.fields]}>
          <FormField
            testID="trainer-profile-display-name"
            label="Display name"
            placeholder="Coach K"
            helperText="Shown instead of your email."
            value={values.display_name}
            onChangeText={setField('display_name')}
            maxLength={DISPLAY_NAME_MAX_LENGTH}
            editable={!saving}
            returnKeyType="go"
            onSubmitEditing={submit}
            {...NO_AUTOFILL}
          />
          <FormField
            testID="trainer-profile-bio"
            label="Bio"
            placeholder="What you coach, and how you work with clients."
            value={values.bio}
            onChangeText={setField('bio')}
            maxLength={BIO_MAX_LENGTH}
            multiline
            rows={BIO_ROWS}
            numberOfLines={BIO_ROWS}
            editable={!saving}
            {...NO_AUTOFILL}
          />
        </View>
        <View style={styles.actions}>
          <PillButton testID="trainer-profile-save" title="Save profile" loading={saving} onPress={submit} />
          {saved ? (
            <Text testID="trainer-profile-saved" style={styles.saved}>
              Saved.
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    width: '100%',
    maxWidth: 672,
    alignSelf: 'center',
    gap: 20,
    paddingBottom: 24,
  },
  // surface-card (app-shell §6.4 Card A). No clipping, so nothing here changes at runtime.
  card: {
    borderRadius: radii.surfaceCard,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
    boxShadow: shadows.soft,
    padding: 24,
  },
  cardWide: {
    padding: 32,
  },
  intro: {
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  mt20: {
    marginTop: 20,
  },
  fields: {
    gap: 20,
  },
  actions: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  saved: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.success700,
  },
});
