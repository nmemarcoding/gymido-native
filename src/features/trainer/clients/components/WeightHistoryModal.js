import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { getServerMessage, getStatus } from '../../../../shared/api/apiError';
import AppModal from '../../../../shared/components/AppModal';
import EmptyState from '../../../../shared/components/EmptyState';
import ErrorAlert from '../../../../shared/components/ErrorAlert';
import Loader from '../../../../shared/components/Loader';
import PillButton from '../../../../shared/components/PillButton';
import { formatDateWithOffset } from '../../../../shared/time/format';
import { breakpoints, colors, radii } from '../../../../shared/theme/tokens';
import { listClientWeightLogs } from '../api/clientsApi';
import { formatSigned, formatWeight, weightDelta } from '../clientFormat';
import { logsSince } from '../weightChartData';
import WeightHistoryChart from './WeightHistoryChart';

// C2b (trainer clients spec §C5.2). Lifecycle pairing: the request starts on
// the open edge and goes stale on close / unmount; each open starts loading.
export default function WeightHistoryModal({ isOpen, clientUserId, profile, onClose }) {
  const { width } = useWindowDimensions();
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    let current = true;
    setState({ status: 'loading' });
    listClientWeightLogs(clientUserId)
      .then((logs) => current && setState({ status: 'loaded', logs }))
      .catch((failure) => {
        if (current) {
          const message = getStatus(failure) === 404 ? 'This is no longer one of your clients.' : getServerMessage(failure);
          setState({ status: 'error', message });
        }
      });
    return () => {
      current = false;
    };
  }, [isOpen, clientUserId]);

  return (
    <AppModal
      testID="weight-history-modal"
      isOpen={isOpen}
      onClose={onClose}
      title="Weight history"
      description="Every weigh-in this client has logged, oldest first."
      size="2xl"
      footer={<PillButton testID="weight-history-close" title="Close" variant="secondary" fullWidth onPress={onClose} />}
    >
      {renderBody()}
    </AppModal>
  );

  function renderBody() {
    if (state.status === 'loading') {
      return <Loader label="Loading weight history" style={styles.loader} />;
    }
    if (state.status === 'error') {
      return <ErrorAlert title="Could not load weight history" description={state.message} />;
    }
    const { logs } = state;
    const first = logs[0];
    const latest = logs[logs.length - 1];
    const recent = logsSince(logs, 30);
    const thirtyDay = recent.length >= 2 ? weightDelta(recent[0], recent[recent.length - 1]) : null;
    const total = logs.length >= 2 ? weightDelta(first, latest) : null;
    const cellWidth = width >= breakpoints.sm ? '22%' : '45%';

    return (
      <View style={styles.body}>
        <View style={styles.summary}>
          <Cell
            width={cellWidth}
            label="Current"
            value={
              latest
                ? formatWeight(latest.weight_value, latest.weight_unit)
                : formatWeight(profile?.current_weight_value, profile?.current_weight_unit)
            }
          />
          <Cell width={cellWidth} label="Goal" value={formatWeight(profile?.goal_weight_value, profile?.goal_weight_unit)} />
          <Cell width={cellWidth} label="Change (30 days)" value={formatSigned(thirtyDay)} />
          <Cell width={cellWidth} label="Total change" value={formatSigned(total)} />
        </View>
        <WeightHistoryChart logs={logs} profile={profile} />
        {logs.length === 0 ? (
          <EmptyState
            title="No weight logs yet"
            message="This client hasn’t recorded a weigh-in, so there is no trend to show."
          />
        ) : (
          // ⚠C-7: newest first, though the description says oldest first.
          <View style={styles.list}>
            {[...logs].reverse().map((log, index) => (
              <View key={log.id ?? index} style={[styles.row, index > 0 && styles.divider]}>
                <Text style={styles.rowDate}>{formatDateWithOffset(log.recorded_on, 1)}</Text>
                <Text style={styles.rowValue}>{formatWeight(log.weight_value, log.weight_unit)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }
}

function Cell({ label, value, width }) {
  return (
    <View style={{ width, flexGrow: 1 }}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={styles.cellValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loader: {
    paddingVertical: 40,
  },
  body: {
    gap: 20,
  },
  summary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: 16,
  },
  cellLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.68,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  cellValue: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  list: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowDate: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  rowValue: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
