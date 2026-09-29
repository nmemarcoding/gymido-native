import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { saveWorkspacePreference, useResolvedMode } from '../../features/workspace/useWorkspaceMode';
import { Workspace } from '../../features/workspace/workspace';
import { colors } from '../../shared/theme/tokens';
import { routes } from '../routes';
import { useLayoutMetrics } from './layoutMetrics';
import PageLayout from './PageLayout';
import { findTabNavigation } from './shellNavigation';
import { headerTitleFor, isCompactHeader, isTrainerUser, showsMobileModeSwitch } from './shellRules';

const MODE_HOME = { [Workspace.member]: routes.HomeTab, [Workspace.trainer]: routes.TrainerDashboardTab };

function Segment({ label, active, onPress }) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[styles.segment, active && styles.segmentActive]}
    >
      <Text
        numberOfLines={1}
        style={[
          styles.segmentLabel,
          { color: active ? colors.brand700 : pressed ? colors.textPrimary : colors.textSecondary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ModeSwitch (RN-SPEC-app-shell §6.2). Nothing unless the user is a trainer.
// A tap on the other mode saves the preference, then pushes that workspace's
// home: Personal → "/", Trainer → "/trainer" (⚠S14: a push, not a replace).
export function ModeSwitch({ path }) {
  const navigation = useNavigation();
  const { mode, user } = useResolvedMode(path);
  if (!isTrainerUser(user)) {
    return null;
  }

  const choose = async (next) => {
    if (next === mode) {
      return;
    }
    await saveWorkspacePreference(next);
    findTabNavigation(navigation)?.navigate(MODE_HOME[next]);
  };

  return (
    <View accessibilityLabel="Workspace" testID="mode-switch" style={styles.group}>
      <Segment label="Personal" active={mode === Workspace.member} onPress={() => choose(Workspace.member)} />
      <Segment label="Trainer" active={mode === Workspace.trainer} onPress={() => choose(Workspace.trainer)} />
    </View>
  );
}

// MobileModeSwitch (§6.5): phones only, trainers only, on /profile and
// /trainer/profile, above the page content.
export function MobileModeSwitch({ path }) {
  const { isDesktop } = useLayoutMetrics();
  const { user } = useResolvedMode(path);
  if (isDesktop || !isTrainerUser(user) || !showsMobileModeSwitch(path)) {
    return null;
  }
  return (
    <View testID="mobile-mode-switch" style={styles.mobileBlock}>
      <Text style={styles.workspaceLabel}>Workspace</Text>
      <ModeSwitch path={path} />
    </View>
  );
}

// STUB: the notification bell (§7) lands next. An empty slot of its min size
// (44×44) keeps the header height.
function BellStub() {
  return <View testID="header-bell-stub" style={styles.bellStub} />;
}

// AppHeader (§6.1): title and compact variant come from the path.
export function AppHeader({ path, query = '' }) {
  const { isDesktop, gutter } = useLayoutMetrics();
  const compact = isCompactHeader(path, query);
  const title = headerTitleFor(path);
  const inset = isDesktop ? 0 : gutter;

  const actions = (
    <View style={styles.actions}>
      {isDesktop ? <ModeSwitch path={path} /> : null}
      <BellStub />
    </View>
  );

  if (compact) {
    return (
      <View style={[styles.compact, { marginHorizontal: -inset, paddingHorizontal: inset }]}>{actions}</View>
    );
  }

  return (
    <View style={[styles.full, { marginHorizontal: -inset, paddingHorizontal: inset }]}>
      <View style={styles.fullRow}>
        {title ? (
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
        ) : (
          <View />
        )}
        {actions}
      </View>
    </View>
  );
}

// The member shell content column (§4): header, mobile Workspace block, page.
export function ShellPage({ path, query, testID, children }) {
  return (
    <PageLayout testID={testID} path={path}>
      <AppHeader path={path} query={query} />
      <MobileModeSwitch path={path} />
      {children}
    </PageLayout>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: 4,
  },
  segment: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 9999,
    // The web's inset ring takes no space, so every segment carries a 1px border.
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentActive: {
    backgroundColor: colors.brand50,
    borderColor: colors.brandBorder,
  },
  segmentLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  mobileBlock: {
    marginBottom: 20,
  },
  workspaceLabel: {
    marginBottom: 8,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 2.64,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  bellStub: {
    width: 44,
    height: 44,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  full: {
    paddingTop: 8,
    paddingBottom: 20,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  fullRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  title: {
    flexShrink: 1,
    fontSize: 44,
    lineHeight: 44,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  compact: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 16,
    paddingBottom: 20,
  },
});
