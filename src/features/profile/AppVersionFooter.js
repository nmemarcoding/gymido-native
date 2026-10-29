import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getServerHealth } from '../../shared/api/healthApi';
import { CAP_BODY } from '../../shared/components/largeText';
import { appVersion, serverVersion } from '../../shared/config/appVersion';
import { colors, font, typography } from '../../shared/theme/tokens';

// T-90 (UX spec + addendum): the last item of member + trainer Profile, centred,
// two lines in the same 13/18 400 text-muted tabular style, no gap:
// "Version 2.0.7 (12)" from the app config and "Server 4.1.0 (8a12bd7)" from
// GET /health. The server line stays HIDDEN while loading, on an error or
// when unreachable (no placeholder, no retry). Both selectable (long-press
// copy), not buttons or focus stops; read as plain text. `align="start"`:
// the tablet's right column (UX LOW), left-aligned with Delete account.
export default function AppVersionFooter({ style, config, align = 'center' }) {
  const app = config === undefined ? appVersion() : appVersion(config);
  const server = useServerVersion();
  if (!app && !server) {
    return null;
  }
  return (
    <View testID="app-version-footer" style={style}>
      {app ? <VersionText testID="app-version" info={app} align={align} /> : null}
      {server ? <VersionText testID="server-version" info={server} align={align} /> : null}
    </View>
  );
}

function VersionText({ testID, info, align }) {
  return (
    <Text testID={testID} {...CAP_BODY} selectable accessibilityLabel={info.label} style={[styles.text, align === 'start' && styles.start]}>
      {info.text}
    </Text>
  );
}

function useServerVersion() {
  const [server, setServer] = useState(null);
  useEffect(() => {
    let alive = true;
    getServerHealth().then(
      (health) => alive && setServer(serverVersion(health)),
      () => {}
    );
    return () => {
      alive = false;
    };
  }, []);
  return server;
}

const styles = StyleSheet.create({
  text: {
    ...typography.label,
    ...font(400),
    fontVariant: ['tabular-nums'],
    color: colors.textMuted,
    textAlign: 'center',
  },
  start: {
    textAlign: 'left',
  },
});
