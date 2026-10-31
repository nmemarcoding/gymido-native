import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, BackHandler, ScrollView, StyleSheet, Text, View, findNodeHandle, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { routes } from '../../navigation/routes';
import Loader from '../../shared/components/Loader';
import { AmbientGlow } from '../../shared/components/Screen';
import { ToastTone, addToast } from '../../shared/components/toastStore';
import { breakpoints, colors, font, radii, spacing } from '../../shared/theme/tokens';
import { CheckIcon } from '../planGenerator/components/GeneratorIcons';
import { createdMessage } from '../planGenerator/generatorCopy';
import { FOCUS_DELAY_MS } from '../planGenerator/generatorLayout';
import { listPlanDays } from '../plans/api/libraryApi';
import ScheduleSetupCard from '../plans/components/ScheduleSetupCard';
import { ShellTab } from '../shell/shellNavigation';
import StatusBarBackdrop from '../shell/StatusBarBackdrop';
import { CAP_BODY } from '../../shared/components/largeText';

// T-53 D (onboarding ruling, 29 Oct 2026): "Pick your days", board #43 as a
// full page (a root screen: no tab bar), right after the onboarding
// generator's Accept. It loads the new enrolment's plan days; a failed load
// or a plan with no days skips it to Workout, exactly as Accept does today.
// Save → Today with "Training days saved."; Later (and Android back) → Today.
const NAME_MAX = 32;
const SAVED_TOAST = 'Training days saved.';

// The success pill's plan name, cut at 32 characters + "…".
export function shortPlanName(name) {
  const text = String(name ?? '');
  return text.length > NAME_MAX ? `${text.slice(0, NAME_MAX)}…` : text;
}

export default function OnboardingDaysScreen({ navigation, route }) {
  const { enrollmentId, planId, planName } = route?.params ?? {};
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [tablet] = useState(() => width >= breakpoints.md);
  const [load, setLoad] = useState({ status: 'loading' });
  const headingRef = useRef(null);

  // Today (Home); after a save the toast shows and Today's T-103 prompt waits
  // for its entrance (`askAfterToast`).
  const toToday = (saved) => {
    if (saved) {
      addToast(ToastTone.success, SAVED_TOAST);
    }
    navigation.reset({
      index: 0,
      routes: [{ name: routes.AppShell, params: { screen: ShellTab.Today, params: { screen: routes.Home, params: saved ? { askAfterToast: true } : undefined } } }],
    });
  };

  useEffect(() => {
    let alive = true;
    // Today's Accept hand-off: Workout above Today, with the created message.
    const toWorkout = () =>
      navigation.reset({
        index: 0,
        routes: [
          {
            name: routes.AppShell,
            params: { screen: ShellTab.Today, params: { screen: routes.Workout, params: { message: createdMessage(planName) }, initial: false } },
          },
        ],
      });
    listPlanDays(planId)
      .then((days) => {
        if (!alive) {
          return;
        }
        if (days.length > 0) {
          setLoad({ status: 'ready', days });
        } else {
          toWorkout();
        }
      })
      .catch(() => alive && toWorkout());
    return () => {
      alive = false;
    };
    // Read once per mount (the enrolment never changes here).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The heading takes the focus once the days are shown.
  useEffect(() => {
    if (load.status !== 'ready') {
      return undefined;
    }
    const timer = setTimeout(() => {
      const node = headingRef.current ? findNodeHandle(headingRef.current) : null;
      if (node) {
        AccessibilityInfo.setAccessibilityFocus(node);
      }
    }, FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [load.status]);

  // §1 Android back on D = Later.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (navigation?.isFocused && !navigation.isFocused()) {
        return false;
      }
      toToday(false);
      return true;
    });
    return () => subscription.remove();
    // toToday only reads the navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);

  return (
    <View testID="onboarding-days-root" style={styles.screen}>
      <AmbientGlow glow />
      <ScrollView
        testID="onboarding-days-screen"
        contentContainerStyle={{
          paddingTop: insets.top + (tablet ? 64 : spacing[6]),
          paddingBottom: insets.bottom + spacing[8],
          paddingLeft: insets.left + (tablet ? 72 : spacing[4]),
          paddingRight: insets.right + (tablet ? 72 : spacing[4]),
        }}
      >
        {load.status === 'loading' ? (
          <Loader label="Loading your plan" style={styles.loader} />
        ) : (
          <View style={[styles.column, tablet && styles.columnTablet]}>
            {/* Toast-free: the success pill replaces the Workout toast here. */}
            <View testID="onboarding-days-created" style={styles.created}>
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <CheckIcon size={14} color={colors.teal} />
              </View>
              <Text {...CAP_BODY} numberOfLines={1} style={styles.createdText}>
                {`${shortPlanName(planName)} created.`}
              </Text>
            </View>
            <ScheduleSetupCard
              planName={planName}
              planDays={load.days}
              enrollmentId={enrollmentId}
              headingRef={headingRef}
              cancelLabel="Later"
              cancelSize="compact"
              onCancel={() => toToday(false)}
              onSaved={() => toToday(true)}
            />
          </View>
        )}
      </ScrollView>
      <StatusBarBackdrop />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ground,
  },
  loader: {
    paddingVertical: 48,
  },
  column: {
    gap: spacing[4],
  },
  // Tablet: the onboarding column (560, centred).
  columnTablet: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  // The inline success pill: teal tint, 28 tall, a check.
  created: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['1_5'],
    minHeight: 28,
    maxWidth: '100%',
    paddingHorizontal: spacing[3],
    borderRadius: radii.full,
    backgroundColor: colors.tealTint,
  },
  createdText: {
    ...font(600),
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 18,
    color: colors.tealText,
  },
});
