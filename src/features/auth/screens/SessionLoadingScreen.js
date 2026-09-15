import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import Screen from '../../../shared/components/Screen';
import Spinner from '../../../shared/components/Spinner';
import { Body } from '../../../shared/components/Typography';

const LOADING_LABEL = 'Restoring your session and preparing the app';

export default function SessionLoadingScreen() {
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(LOADING_LABEL);
  }, []);

  return (
    <Screen>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={LOADING_LABEL}
        accessibilityLiveRegion="polite"
        style={styles.container}
      >
        <Spinner />
        <Body style={styles.label}>{LOADING_LABEL}</Body>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 16,
  },
  label: {
    textAlign: 'center',
  },
});
