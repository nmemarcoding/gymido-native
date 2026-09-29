import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { routes } from '../../navigation/routes';
import { replaceTab, findTabNavigation } from '../../navigation/shell/shellNavigation';
import { isTrainerUser, pathForRoute } from '../../navigation/shell/shellRules';
import { ShellPage } from '../../navigation/shell/ShellChrome';
import { colors } from '../../shared/theme/tokens';
import { useAuthStore } from '../auth/authStore';
import TrainerModeCard from '../trainer/TrainerModeCard';
import { useResolvedMode } from '../workspace/useWorkspaceMode';
import { Workspace } from '../workspace/workspace';
import AccountActionsCard from '../settings/AccountActionsCard';

// Owner-approved stopgap: "<Tab name>, coming soon" for shell screens whose
// spec isn't built yet. They sit behind the same guards as the real pages.

function ComingSoon({ name }) {
  return <Text style={styles.text}>{`${name}, coming soon`}</Text>;
}

function comingSoonScreen(routeName, name, extra) {
  const path = pathForRoute({ name: routeName });
  return function ComingSoonScreen() {
    return (
      <ShellPage path={path} testID={`coming-soon-${routeName}`}>
        <View style={styles.stack}>
          <ComingSoon name={name} />
          {extra ? extra() : null}
        </View>
      </ShellPage>
    );
  };
}

// TrainerRoute (RN-SPEC-app-shell §3.2): a non-trainer on /trainer/* is
// replaced to "/".
function withTrainerRoute(routeName, Screen) {
  return function TrainerRouteScreen() {
    const navigation = useNavigation();
    const user = useAuthStore((state) => state.user);
    const allowed = isTrainerUser(user);
    useFocusEffect(
      useCallback(() => {
        if (!allowed) {
          const tabNavigation = findTabNavigation(navigation);
          if (tabNavigation) {
            replaceTab(tabNavigation, routeName, routes.HomeTab);
          }
        }
      }, [allowed, navigation])
    );
    return allowed ? <Screen /> : null;
  };
}

// Home ("/"), title "Dashboard". Its LandingRoute (§3.3) replaces to /trainer
// when the resolved mode is Trainer; [O1] there is no admin redirect.
export function HomeScreen() {
  const navigation = useNavigation();
  const { mode } = useResolvedMode('/');
  useFocusEffect(
    useCallback(() => {
      if (mode === Workspace.trainer) {
        const tabNavigation = findTabNavigation(navigation);
        if (tabNavigation) {
          replaceTab(tabNavigation, routes.HomeTab, routes.TrainerDashboardTab);
        }
      }
    }, [mode, navigation])
  );
  if (mode === Workspace.trainer) {
    return null;
  }
  return (
    <ShellPage path="/" testID="home-screen">
      <ComingSoon name="Home" />
    </ShellPage>
  );
}

function TrainerHubExtra() {
  const user = useAuthStore((state) => state.user);
  return isTrainerUser(user) ? <TrainerModeCard /> : null;
}

export const ExercisesScreen = comingSoonScreen(routes.ExercisesTab, 'Exercises');
export const ProgressScreen = comingSoonScreen(routes.ProgressTab, 'Progress');
// The member Trainer hub (/my-trainer) with the real TrainerModeCard.
export const TrainerHubScreen = comingSoonScreen(routes.TrainerTab, 'Trainer', TrainerHubExtra);
// Settings (/profile): the Workspace block comes from ShellPage; the account
// actions (change password, sign out) predate this spec and stay reachable.
export const SettingsTabScreen = comingSoonScreen(routes.SettingsTab, 'Settings', () => <AccountActionsCard />);

export const TrainerDashboardScreen = withTrainerRoute(
  routes.TrainerDashboardTab,
  comingSoonScreen(routes.TrainerDashboardTab, 'Dashboard')
);
export const TrainerClientsScreen = withTrainerRoute(
  routes.TrainerClientsTab,
  comingSoonScreen(routes.TrainerClientsTab, 'Clients')
);
export const TrainerPlansScreen = withTrainerRoute(
  routes.TrainerPlansTab,
  comingSoonScreen(routes.TrainerPlansTab, 'Plans')
);
// Trainer Profile (/trainer/profile): the Workspace block comes from ShellPage.
export const TrainerProfileScreen = withTrainerRoute(
  routes.TrainerProfileTab,
  comingSoonScreen(routes.TrainerProfileTab, 'Profile')
);

const styles = StyleSheet.create({
  stack: {
    gap: 20,
  },
  text: {
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSecondary,
  },
});
