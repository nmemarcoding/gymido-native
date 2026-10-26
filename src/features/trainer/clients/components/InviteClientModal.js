import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, View } from 'react-native';

import { getServerMessage, getStatus } from '../../../../shared/api/apiError';
import AppModal from '../../../../shared/components/AppModal';
import EmptyState from '../../../../shared/components/EmptyState';
import ErrorAlert from '../../../../shared/components/ErrorAlert';
import FormField from '../../../../shared/components/FormField';
import PillButton from '../../../../shared/components/PillButton';
import Spinner from '../../../../shared/components/Spinner';
import { ToastTone, addToast } from '../../../../shared/components/toastStore';
import { colors, motion, radii } from '../../../../shared/theme/tokens';
import { inviteClient, searchMembers } from '../api/clientsApi';
import { isEmailShaped } from '../clientFormat';

const DEBOUNCE_MS = 300;
const SEARCHING_STATUS = 'Searching…';

// C1a (trainer clients spec §C3.3, exact-email invite T-32 M1). Lifecycle
// pairing: everything resets on the open → closed edge; the debounce timer is
// created per keystroke and cancelled by the next keystroke, Enter or unmount.
export default function InviteClientModal({ isOpen, onClose, onInvited }) {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Whether an answer (found, none or error) has arrived for the current
  // email-shaped stretch; until then nothing shows below the field.
  const [answered, setAnswered] = useState(false);
  const [invitedIds, setInvitedIds] = useState(() => new Set());
  const [invitingId, setInvitingId] = useState(null);
  const timer = useRef(null);
  const wasOpen = useRef(isOpen);

  useEffect(() => {
    if (wasOpen.current && !isOpen) {
      clearTimeout(timer.current);
      setInput('');
      setQuery('');
      setResults([]);
      setError('');
      setAnswered(false);
      setInvitedIds(new Set());
    }
    wasOpen.current = isOpen;
  }, [isOpen]);

  useEffect(() => () => clearTimeout(timer.current), []);

  // iOS has no live regions, so the hidden "Searching…" status is announced
  // explicitly (Android reads it from the live region below).
  useEffect(() => {
    if (loading && Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(SEARCHING_STATUS);
    }
  }, [loading]);

  // Every new email-shaped query fires; responses aren't cancelled (⚠C-2).
  // The previous answer stays on screen until this one arrives.
  async function search(term) {
    setLoading(true);
    try {
      const found = await searchMembers(term);
      setResults(found);
      setError('');
    } catch (failure) {
      setError(getServerMessage(failure));
    }
    setAnswered(true);
    setLoading(false);
  }

  // Not email-shaped (incl. empty) → no request and nothing below the field.
  function apply(text) {
    const term = text.trim();
    setQuery(term);
    if (isEmailShaped(term)) {
      search(term);
    } else {
      setResults([]);
      setError('');
      setAnswered(false);
    }
  }

  function onChange(text) {
    setInput(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => apply(text), DEBOUNCE_MS);
  }

  // Enter/return searches at once instead of waiting for the debounce.
  function onSubmit() {
    clearTimeout(timer.current);
    apply(input);
  }

  async function invite(user) {
    setInvitingId(user.id);
    try {
      await inviteClient(user.id);
      setInvitedIds((current) => new Set(current).add(user.id));
      addToast(ToastTone.success, 'Invitation sent', `${user.email} can accept or decline it.`);
      onInvited();
    } catch (failure) {
      const status = getStatus(failure);
      let message = 'We could not send the invitation. Please try again.';
      if (status === 409) {
        message = getServerMessage(failure);
      } else if (status === 404) {
        message = 'That user no longer exists.';
      }
      addToast(ToastTone.error, 'Could not invite', message);
    }
    setInvitingId(null);
  }

  return (
    <AppModal
      testID="invite-client-modal"
      isOpen={isOpen}
      onClose={onClose}
      title="Invite a client"
      description="Enter your client's full email address to invite them."
      size="lg"
      footer={<PillButton testID="invite-done" title="Done" variant="secondary" fullWidth onPress={onClose} />}
    >
      <View style={styles.body}>
        <FormField
          testID="invite-search"
          label="Client's email"
          helperText={isEmailShaped(query) ? undefined : 'Enter their full email address.'}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="off"
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          value={input}
          onChangeText={onChange}
          onSubmitEditing={onSubmit}
          trailing={
            loading ? (
              <Spinner size={18} thickness={2} color={colors.brand700} track={colors.border} reducedMotionLoopMs={motion.spinnerReducedLoopMs} />
            ) : null
          }
        />
        {loading ? (
          <View testID="invite-searching-status" accessibilityLiveRegion="polite" style={styles.hiddenStatus}>
            <Text style={styles.hiddenText}>{SEARCHING_STATUS}</Text>
          </View>
        ) : null}
        {renderResults()}
      </View>
    </AppModal>
  );

  function renderResults() {
    if (!isEmailShaped(query) || !answered) {
      return null;
    }
    if (error) {
      return <ErrorAlert title="Could not search" description={error} onRetry={() => search(query)} />;
    }
    if (results.length === 0) {
      // The same for a typo, an unknown or an inactive account; never say which.
      return (
        <EmptyState
          title="No member found"
          message="Check the spelling. If they're new to Gymido, ask them to sign up first."
        />
      );
    }
    return (
      <View style={styles.list}>
        {results.map((user, index) => (
          <View key={user.id} style={[styles.row, index > 0 && styles.divider]}>
            <Text numberOfLines={1} style={styles.email}>
              {user.email}
            </Text>
            {invitedIds.has(user.id) ? (
              <Text style={styles.invited}>Invited</Text>
            ) : (
              <PillButton
                testID={`invite-user-${user.id}`}
                title="Invite"
                variant="secondary"
                loading={invitingId === user.id}
                disabled={invitingId !== null}
                onPress={() => invite(user)}
              />
            )}
          </View>
        ))}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  body: {
    gap: 16,
  },
  // Off screen but still read: the "Searching…" status of a running request.
  hiddenStatus: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
  },
  hiddenText: {
    color: 'transparent',
  },
  list: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  email: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  invited: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: '#22c55e',
  },
});
