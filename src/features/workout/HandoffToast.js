import { useNavigation } from '@react-navigation/native';
import { useEffect } from 'react';

import { InlineToast } from '../../shared/components/ToastHost';
import { ToastTone } from '../../shared/components/toastStore';

const SAVED_TOAST_MS = 3500;

// RN-SPEC-plans §4.8 / workout §3.5: a hand-off `message` param shows once in
// the "Saved" toast, then clears after 3500 ms. Clearing the param is the
// teardown; a new hand-off (a new param) is the only re-arm.
export default function HandoffToast({ message }) {
  const navigation = useNavigation();

  useEffect(() => {
    const timer = setTimeout(() => navigation.setParams({ message: undefined }), SAVED_TOAST_MS);
    return () => clearTimeout(timer);
  }, [message, navigation]);

  return <InlineToast testID="workout-saved-toast" tone={ToastTone.success} title="Saved" message={message} />;
}
