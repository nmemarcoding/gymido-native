// Lint gate (PM, 27 Oct 2026): Expo's flat config, 0 errors before every
// Release. Tests run under Jest, and the config, plugins and e2e / build
// scripts run under Node; build output and native folders are not linted.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const globals = require('globals');

const textCap = require('./eslint-rules/text-cap');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'ios/*', 'android/*', 'coverage/*', 'node_modules/*'],
  },
  {
    rules: {
      // React Compiler rules: the compiler is NOT enabled (no
      // experiments.reactCompiler), so these flag compiler compatibility, not
      // runtime bugs. Kept visible as warnings until it is adopted.
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      // An HTML rule: React Native <Text> renders ' and " as typed.
      'react/no-unescaped-entities': 'off',
      // PM (27 Oct): every existing case triaged (lint-13-triage.md), so a
      // NEW missing dependency (the refetch-storm family) fails the gate.
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    // T-170: every top-level Text / TextInput carries a large-text role.
    files: ['src/**/*.js'],
    ignores: ['**/*.test.js', '**/__mocks__/**'],
    plugins: { gymido: { rules: { 'text-cap': textCap } } },
    rules: { 'gymido/text-cap': 'error' },
  },
  {
    files: ['**/*.test.js', '**/__mocks__/**', 'jest.setup.js'],
    languageOptions: { globals: { ...globals.jest, ...globals.node } },
    // jest.mock factories return anonymous components on purpose.
    rules: { 'react/display-name': 'off' },
  },
  {
    files: ['app.config.js', 'eslint.config.js', 'plugins/**', 'scripts/**', 'e2e/scripts/**'],
    languageOptions: { globals: globals.node },
  },
]);
