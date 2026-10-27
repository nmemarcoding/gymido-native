import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { getServerMessage, getStatus } from '../../../../shared/api/apiError';
import AppModal, { ModalActions, isTabletWidth } from '../../../../shared/components/AppModal';
import EmptyState from '../../../../shared/components/EmptyState';
import ErrorAlert from '../../../../shared/components/ErrorAlert';
import FormField from '../../../../shared/components/FormField';
import { CAP_BODY, CAP_PILL } from '../../../../shared/components/largeText';
import PillButton from '../../../../shared/components/PillButton';
import Spinner from '../../../../shared/components/Spinner';
import { ToastTone, addToast } from '../../../../shared/components/toastStore';
import { colors, font, motion, radii, spacing } from '../../../../shared/theme/tokens';
import { inviteClient, searchMembers } from '../api/clientsApi';
import { isEmailShaped } from '../clientFormat';

const DEBOUNCE_MS = 300;
const SEARCHING_STATUS = 'Searching…';

// C1a (trainer clients spec §C3.3, exact-email invite T-32 M1). Lifecycle
// pairing: everything resets on the open → closed edge; the debounce timer is
// created per keystroke and cancelled by the next keystroke, Enter or unmount.
// v2 (UX M §Invite client (4.1.0) / §Tablet): look only; behaviour T-32 M1.
export default function InviteClientModal({ isOpen, onClose, onInvited }) {
  const tablet = isTabletWidth(useWindowDimensions().width);
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

  // The helper and the spinner follow each keystroke; the request follows the
  // debounced query, and the results need both to be email-shaped.
  const liveShaped = isEmailShaped(input.trim());
  const searching = loading && liveShaped;

  // iOS has no live regions, so the hidden "Searching…" status is announced
  // explicitly (Android reads it from the live region below).
  useEffect(() => {
    if (searching && Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(SEARCHING_STATUS);
    }
  }, [searching]);

  // Every new email-shaped query fires; responses aren't cancelled (⚠C-2).
  // The previous answer stays on screen until this one arrives.
  async function search(term) {
    // A Retry (or any new search) clears an error at once; the last
    // successful answer stays under the spinner, else nothing shows (FE
    // a5e852b3). `answered` = there is a successful answer to show.
    setError('');
    setLoading(true);
    try {
      const found = await searchMembers(term);
      setResults(found);
      setAnswered(true);
    } catch (failure) {
      setError(getServerMessage(failure));
    }
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
      // KIT NEED (p5l): AppModal `eyebrow` (tablet "Clients", 12/600 gold).
      eyebrow={tablet ? 'Clients' : undefined}
      title="Invite a client"
      description="Enter your client's full email address to invite them."
      size="lg"
      footer={
        // Full width on phone and tablet (the board's block Done).
        <ModalActions fill>
          <PillButton testID="invite-done" title="Done" variant="secondary" size={tablet ? 'cta' : 'default'} fullWidth onPress={onClose} />
        </ModalActions>
      }
    >
      <View style={styles.body}>
        <FormField
          testID="invite-search"
          label="Client's email"
          labelStyle={styles.label}
          // UX M: the drawn well fill + a 0.16 edge, radius 16 = the kit `well` field
          // (surfaceWell, hairlineStrong edge; values reported).
          variant="well"
          helperText={liveShaped ? undefined : 'Enter their full email address.'}
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
            searching ? (
              <Spinner size={18} thickness={2} color={colors.gold} track={colors.hairlineButton} reducedMotionLoopMs={motion.spinnerReducedLoopMs} />
            ) : null
          }
        />
        {/* Always mounted, so Android's live region reads the text change. */}
        <View testID="invite-searching-status" accessibilityLiveRegion="polite" style={styles.hiddenStatus}>
          <Text style={styles.hiddenText}>{searching ? SEARCHING_STATUS : ''}</Text>
        </View>
        {renderResults()}
      </View>
    </AppModal>
  );

  function renderResults() {
    if (!liveShaped || !isEmailShaped(query)) {
      return null;
    }
    if (error) {
      return <ErrorAlert title="Could not search" description={error} onRetry={() => search(query)} />;
    }
    if (!answered) {
      return null;
    }
    if (results.length === 0) {
      // The same for a typo, an unknown or an inactive account; never say which.
      return (
        <EmptyState
          live
          title="No member found"
          message="Check the spelling. If they're new to Gymido, ask them to sign up first."
        />
      );
    }
    return (
      <View testID="invite-results" style={[styles.list, tablet && styles.listTablet]}>
        {results.map((user, index) => (
          <View key={user.id} style={[styles.row, tablet && styles.rowTablet, index > 0 && styles.divider]}>
            <Text {...CAP_BODY} numberOfLines={1} style={[styles.email, tablet && styles.emailTablet]}>
              {user.email}
            </Text>
            {invitedIds.has(user.id) ? (
              <View testID={`invite-invited-${user.id}`} style={styles.invitedRow}>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path d="M5 12l5 5L20 7" stroke={colors.success} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text {...CAP_PILL} style={styles.invited}>
                  Invited
                </Text>
              </View>
            ) : (
              <PillButton
                testID={`invite-user-${user.id}`}
                title="Invite"
                variant="secondary"
                size="compact"
                accessibilityLabel={`Invite ${user.email}`}
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
    gap: spacing[4],
  },
  label: {
    ...font(600),
    fontSize: 13,
    lineHeight: 18,
    color: colors.textStrong2,
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
    overflow: 'hidden',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  listTablet: {
    borderRadius: radii.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  rowTablet: {
    gap: spacing['3_5'],
    paddingVertical: spacing['3_5'],
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  email: {
    ...font(600),
    flexShrink: 1,
    minWidth: 0,
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  emailTablet: {
    fontSize: 16,
    lineHeight: 22,
  },
  invitedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    minHeight: 44,
  },
  invited: {
    ...font(700),
    fontSize: 14,
    lineHeight: 20,
    color: colors.success,
  },
});
