import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getServerMessage, getStatus } from '../../../../shared/api/apiError';
import AppModal from '../../../../shared/components/AppModal';
import EmptyState from '../../../../shared/components/EmptyState';
import ErrorAlert from '../../../../shared/components/ErrorAlert';
import FormField from '../../../../shared/components/FormField';
import Loader from '../../../../shared/components/Loader';
import PillButton from '../../../../shared/components/PillButton';
import { ToastTone, addToast } from '../../../../shared/components/toastStore';
import { colors, radii } from '../../../../shared/theme/tokens';
import { inviteClient, searchMembers } from '../api/clientsApi';

const DEBOUNCE_MS = 300;

// C1a (trainer clients spec §C3.3). Lifecycle pairing: everything resets on
// the open → closed edge; the debounce timer is created per keystroke and
// cancelled by the next keystroke or unmount.
export default function InviteClientModal({ isOpen, onClose, onInvited }) {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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
      setInvitedIds(new Set());
    }
    wasOpen.current = isOpen;
  }, [isOpen]);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Every new long-enough query fires; responses aren't cancelled (⚠C-2).
  async function search(term) {
    setLoading(true);
    setError('');
    try {
      setResults(await searchMembers(term));
    } catch (failure) {
      setError(getServerMessage(failure));
    }
    setLoading(false);
  }

  function onChange(text) {
    setInput(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const term = text.trim();
      setQuery(term);
      if (term.length >= 3) {
        search(term);
      } else {
        setResults([]);
        setError('');
      }
    }, DEBOUNCE_MS);
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
      description="Search members by email and invite them to be coached by you."
      size="lg"
      footer={<PillButton testID="invite-done" title="Done" variant="secondary" fullWidth onPress={onClose} />}
    >
      <View style={styles.body}>
        <FormField
          testID="invite-search"
          label="Search members"
          placeholder="Search by email"
          keyboardType="email-address"
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          value={input}
          onChangeText={onChange}
        />
        {renderResults()}
      </View>
    </AppModal>
  );

  function renderResults() {
    if (query.length < 3) {
      return (
        <EmptyState
          title="Search for a member"
          message="Type at least 3 characters of their email address to find them."
        />
      );
    }
    if (error) {
      return <ErrorAlert title="Could not search" description={error} onRetry={() => search(query)} />;
    }
    if (loading) {
      return <Loader label="Searching" style={styles.loader} />;
    }
    if (results.length === 0) {
      return <EmptyState title="No members found" message="Try a different email." />;
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
  loader: {
    paddingVertical: 32,
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
    color: colors.success700,
  },
});
