import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { routes } from '../../../navigation/routes';
import { getStatus } from '../../../shared/api/apiError';
import EmptyState from '../../../shared/components/EmptyState';
import { InlineError } from '../../../shared/components/FeedbackBox';
import Loader from '../../../shared/components/Loader';
import { useFocusRemountKey } from '../../../shared/hooks/useFocusRemountKey';
import { colors, radii, shadows } from '../../../shared/theme/tokens';
import MyPlansEntryCard from '../../myPlans/components/MyPlansEntryCard';
import GeneratorEntryCard from '../../planGenerator/components/GeneratorEntryCard';
import ShellPage from '../../shell/ShellPage';
import { openShellPath } from '../../shell/shellLinks';
import { getCurrentPlan, listPlans } from '../api/libraryApi';
import { ActiveBadge, Eyebrow, Pill, SectionHeading, planStyles } from '../components/PlanBits';
import { activePlanSummary, deriveLibrary, planCardDaysLabel, planCountLabel } from '../libraryFormat';

// S1 (RN-SPEC-plans §3). Every focus remounts and reloads (§8.1).
export default function PlansLibraryScreen() {
  const remountKey = useFocusRemountKey();
  return (
    <ShellPage testID="plans-library-screen">
      <PlansLibrary key={remountKey} />
    </ShellPage>
  );
}

function PlansLibrary() {
  const navigation = useNavigation();
  const [load, setLoad] = useState({ status: 'loading', plans: [], currentPlan: null, error: null });

  useEffect(() => {
    let alive = true;
    // §3.1: a 404 on the current plan means "no active plan"; any other error fails the load.
    const current = getCurrentPlan().catch((error) => {
      if (getStatus(error) === 404) {
        return null;
      }
      throw error;
    });
    Promise.all([listPlans(), current])
      .then(([plans, currentPlan]) => {
        if (alive) {
          setLoad({ status: 'loaded', plans, currentPlan, error: null });
        }
      })
      .catch((error) => {
        if (alive) {
          setLoad({ status: 'error', plans: [], currentPlan: null, error });
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  if (load.status === 'loading') {
    return <Loader label="Loading plans" />;
  }
  if (load.status === 'error') {
    // ⚠4: the transport message, no retry.
    return <InlineError testID="plans-error" title="Plans unavailable" message={load.error?.message || 'Please try again.'} />;
  }

  const library = deriveLibrary(load.plans, load.currentPlan);
  const openPlan = (planId) => navigation.push(routes.PlanDetail, { planId: String(planId) });

  return (
    <View style={styles.page}>
      {library.hasActivePlan ? (
        <ActivePlanCard plan={library.activePlanDetail} weekdays={library.activeWeekdays} onView={openPlan} />
      ) : null}
      {/* M4, then G-E1 right after it (RN-SPEC-MEMBER-PLANS §M4, PLAN-GENERATOR §G0). */}
      <MyPlansEntryCard />
      <GeneratorEntryCard />
      {library.noPlansAtAll ? (
        <EmptyState title="No plans available" message="No active workout plans were returned by the backend." />
      ) : null}
      {library.browseCount > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <SectionHeading>{library.hasActivePlan ? 'Switch your plan' : 'Choose your next plan'}</SectionHeading>
            <Pill>{planCountLabel(library.browseCount)}</Pill>
          </View>
          {library.groups.map(([category, plans]) => (
            <View key={category} style={styles.section}>
              {library.showCategoryHeaders ? <Text style={styles.category}>{category}</Text> : null}
              {plans.map((plan) => (
                <PlanCard key={plan.id} plan={plan} onPress={() => openPlan(plan.id)} />
              ))}
            </View>
          ))}
        </View>
      ) : !library.hasActivePlan && !library.noPlansAtAll ? (
        <SectionHeading style={styles.headingAlone}>Choose your next plan</SectionHeading>
      ) : null}
    </View>
  );
}

// §3.4
function ActivePlanCard({ plan, weekdays, onView }) {
  return (
    <View testID="plans-active-card" style={[planStyles.card, styles.activeCard]}>
      <View style={styles.accent} accessibilityElementsHidden importantForAccessibility="no" />
      <View style={styles.activeBody}>
        <View style={styles.topRow}>
          <View style={styles.textColumn}>
            <Eyebrow>Active plan</Eyebrow>
            <Text numberOfLines={2} textBreakStrategy="simple" style={[planStyles.title2xl, styles.mt6]}>
              {plan?.name}
            </Text>
            <Text style={styles.activeSummary}>{activePlanSummary(plan)}</Text>
          </View>
          <ActiveBadge />
        </View>
        {weekdays.length ? (
          <View style={styles.mt16}>
            <Eyebrow color={colors.textMuted}>Your week</Eyebrow>
            <View style={styles.weekRow}>
              {weekdays.map((weekday) => (
                <Pill key={weekday.id}>{weekday.name}</Pill>
              ))}
            </View>
          </View>
        ) : null}
        <View style={styles.actions}>
          <Pressable
            testID="plans-go-to-workout"
            accessibilityRole="button"
            onPress={() => openShellPath('/workout')}
            style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
          >
            <Text numberOfLines={1} textBreakStrategy="simple" style={styles.primaryText}>Go to workout</Text>
          </Pressable>
          {plan?.id ? (
            <Pressable
              testID="plans-view-active"
              accessibilityRole="button"
              onPress={() => onView(plan.id)}
              style={({ pressed }) => [styles.secondary, pressed && styles.secondaryPressed]}
            >
              <Text style={styles.secondaryText}>View plan</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// §3.6: the whole card is one pressable; hover → pressed border (§9.1).
function PlanCard({ plan, onPress }) {
  return (
    <Pressable
      testID={`plans-card-${plan.id}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [planStyles.card, styles.planCard, pressed && styles.planCardPressed]}
    >
      <View style={styles.topRow}>
        <View style={styles.textColumn}>
          {plan.category?.name ? <Eyebrow>{plan.category.name}</Eyebrow> : null}
          <Text numberOfLines={2} textBreakStrategy="simple" style={[planStyles.titleLg, styles.mt6]}>
            {plan.name}
          </Text>
          <View style={styles.pillRow}>
            <Pill>{planCardDaysLabel(plan)}</Pill>
          </View>
        </View>
        <View style={styles.cardSide}>
          <Text style={styles.chevron} accessibilityElementsHidden importantForAccessibility="no">
            ›
          </Text>
        </View>
      </View>
      {plan.description ? (
        <Text numberOfLines={2} ellipsizeMode="tail" style={[planStyles.body, styles.mt12]}>
          {plan.description}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: 20,
    paddingBottom: 16,
  },
  section: {
    gap: 12,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 4,
  },
  headingAlone: {
    paddingHorizontal: 4,
  },
  category: {
    paddingHorizontal: 4,
    paddingTop: 4,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.92,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  activeCard: {
    flexDirection: 'row',
    overflow: 'hidden',
  },
  accent: {
    width: 6,
    backgroundColor: colors.brand400,
  },
  activeBody: {
    flex: 1,
    padding: 20,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  textColumn: {
    flex: 1,
    minWidth: 0,
  },
  activeSummary: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  weekRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
  },
  primary: {
    flex: 1,
    alignItems: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.brand400,
    paddingVertical: 12,
    boxShadow: shadows.glow,
  },
  primaryPressed: {
    backgroundColor: colors.brand500,
  },
  primaryText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '900',
    color: colors.navy,
  },
  secondary: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  secondaryText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  planCard: {
    padding: 20,
  },
  planCardPressed: {
    borderColor: colors.brand300,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  cardSide: {
    alignItems: 'flex-end',
    gap: 8,
    flexShrink: 0,
  },
  chevron: {
    fontSize: 20,
    lineHeight: 28,
    color: colors.textMuted,
  },
  mt6: {
    marginTop: 6,
  },
  mt12: {
    marginTop: 12,
  },
  mt16: {
    marginTop: 16,
  },
});
