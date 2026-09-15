import { StyleSheet, Text, View } from 'react-native';

import { env } from '../../shared/config/env';

// Scaffold placeholder. Replaced once the Home spec arrives.
export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gymido</Text>
      <Text style={styles.meta}>Environment: {env.appEnv}</Text>
      <Text style={styles.meta}>API: {env.apiBaseUrl ?? 'not configured'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 12,
  },
  meta: {
    fontSize: 14,
    color: '#555',
  },
});
