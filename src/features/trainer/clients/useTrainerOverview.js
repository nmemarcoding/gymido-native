import { useCallback, useEffect, useRef, useState } from 'react';

import { getServerMessage } from '../../../shared/api/apiError';
import { listActiveClients, listPendingRequests } from './api/clientsApi';
import { isAwaitingMyResponse } from './clientFormat';

// §C2.1: active clients + pending requests, in parallel, on mount and on
// every reload. A failure keeps both lists at their previous values.
export function useTrainerOverview() {
  const mounted = useRef(true);
  const [clients, setClients] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // `{ quiet: true }` (RN-SPEC-TRAINER-CLIENTS 07c6d708, the tablet pane's End
  // coaching / "Back to clients"): refresh without the loader; the lists stay
  // until the answer. Any other argument (an onRetry / onInvited event) is a
  // normal reload.
  const reload = useCallback(async (options) => {
    if (options?.quiet !== true) {
      setLoading(true);
    }
    setError('');
    try {
      const [clientItems, requestItems] = await Promise.all([listActiveClients(), listPendingRequests()]);
      if (mounted.current) {
        setClients(clientItems);
        setRequests(requestItems);
      }
    } catch (failure) {
      if (mounted.current) {
        setError(getServerMessage(failure));
      }
    }
    if (mounted.current) {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    reload();
    return () => {
      mounted.current = false;
    };
  }, [reload]);

  return {
    clients,
    incoming: requests.filter((request) => isAwaitingMyResponse(request, 'trainer')),
    outgoing: requests.filter((request) => request.requested_by === 'trainer'),
    loading,
    error,
    reload,
  };
}
