const fs = require('fs');
const path = require('path');

// UX native final audit 27 Oct 2026, ruling 2 (rows A101, A105, C318): every
// scrolled screen gets the status-bar backdrop. ShellPage draws it (phone
// root; tablet via TabletFrame's column); the screens that scroll without
// ShellPage draw StatusBarBackdrop themselves. This guard lists every
// scrolled screen with the file that draws its page frame.
const SRC = path.join(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(SRC, file), 'utf8');
const drawsShellPage = (source) => /<ShellPage[\s>]/.test(source);
const drawsBackdrop = (source) => /<StatusBarBackdrop[\s/>]/.test(source);

// Screen → the file that draws its page frame.
const SCROLLED_SCREENS = {
  'Today (Home)': 'features/home/HomeScreen.js',
  'Today workout hub': 'features/workout/screens/WorkoutScreen.js',
  Progress: 'features/progress/ProgressScreen.js',
  'Plans library': 'features/plans/screens/PlansLibraryScreen.js',
  'Plan detail': 'features/plans/screens/PlanDetailScreen.js',
  'My plans': 'features/myPlans/MyPlansScreen.js',
  'My plan / trainer plan (SharedPlanScreen)': 'features/trainer/plans/components/PlanPage.js',
  'Create plan (member + trainer)': 'features/trainer/plans/components/TrainerCreatePlanLayout.js',
  'Trainer create plan': 'features/trainer/plans/screens/CreatePlanScreen.js',
  'Plan generator (steps 1-6, review)': 'features/planGenerator/screens/PlanGeneratorScreen.js',
  'Plan generator preview': 'features/planGenerator/screens/PlanGeneratorPreviewScreen.js',
  'Exercise detail': 'features/exercises/screens/ExerciseDetailScreen.js',
  Profile: 'features/profile/screens/ProfileSettingsScreen.js',
  'Edit profile': 'features/profile/screens/EditProfileScreen.js',
  Notifications: 'features/notifications/NotificationsScreen.js',
  'Coaching hub': 'features/myTrainer/TrainerHubScreen.js',
  'All trainers': 'features/trainers/screens/TrainersScreen.js',
  'Trainer detail': 'features/trainers/screens/TrainerDetailScreen.js',
  'Trainer apply': 'features/trainers/screens/TrainerApplyScreen.js',
  'Trainer dashboard': 'features/trainer/TrainerDashboardScreen.js',
  'Trainer clients': 'features/trainer/clients/screens/ClientsListScreen.js',
  'Trainer client detail': 'features/trainer/clients/screens/ClientDetailScreen.js',
  'Trainer plans': 'features/trainer/plans/screens/PlansListScreen.js',
  'Trainer profile': 'features/trainer/profile/screens/TrainerProfileScreen.js',
  // Not on ShellPage: they draw StatusBarBackdrop themselves.
  Exercises: 'features/exercises/screens/ExercisesScreen.js',
  'Create profile': 'features/profile/CreateProfileScreen.js',
  // T-53 item 38 (added): the onboarding "Pick your days" page (a root screen).
  'Onboarding pick your days': 'features/onboarding/OnboardingDaysScreen.js',
};

// Files with a scroll view that are NOT a page scrolling under the status bar.
const NOT_UNDER_THE_STATUS_BAR = {
  // SafeAreaView-based <Screen>: the scroll starts below the top inset.
  'features/auth/screens/SessionLoadingScreen.js': 'Screen (SafeAreaView)',
  'features/auth/screens/AccountUnavailableScreen.js': 'Screen (SafeAreaView)',
  'features/auth/screens/SignInFailedScreen.js': 'Screen (SafeAreaView)',
  'features/auth/screens/WelcomeScreen.js': 'Screen (SafeAreaView)',
  'features/shell/NotFoundScreen.js': 'Screen (SafeAreaView)',
  // Sheets, panels, lists and controls inside a page or a Modal window.
  'features/shell/TabletRail.js': 'the rail handles its own top',
  'features/shell/ShellPage.js': 'draws the backdrop',
  'features/exercises/components/ExerciseFilterPanel.js': 'panel inside Exercises',
  'features/workout/runtime/ExerciseNavigation.js': 'sheet / nav inside the session',
  'features/workout/runtime/RuntimeOverlays.js': 'Modal overlays',
  'features/workout/runtime/AlertSheet.js': 'Modal sheet',
  // T-153: the rest sheet starts 44 below the safe area; its body scrolls only at large text.
  'features/workout/runtime/RestSheet.js': 'rest sheet below the status bar',
  'features/notifications/NotificationPanel.js': 'panel',
  'features/trainer/plans/components/ExercisePickerSheet.js': 'Modal sheet',
  'features/trainer/plans/components/DayTabs.js': 'horizontal tabs',
  'features/trainer/plans/components/SortableExerciseList.js': 'list inside a ShellPage',
  'shared/components/RouteErrorBoundary.js': 'Screen (SafeAreaView)',
  'shared/components/PillButton.js': 'control',
  'shared/components/Select.js': 'Modal list',
  'shared/components/AppModal.js': 'Modal window',
  // The active workout: the board draws the exercise photo edge to edge
  // under the status bar (SessionChrome sits at the inset). Ruling 2
  // amendment 1 (27 Oct 2026, A116): it draws its own band (BackdropBand,
  // the same colours) that fades in once the photo has scrolled away; see
  // sessionTopBand.test.js.
  'features/workout/runtime/SessionRuntime.js': 'own top band once the photo scrolls away (sessionTopBand.test.js)',
};

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(full);
    }
    return entry.name.endsWith('.js') && !entry.name.endsWith('.test.js') ? [path.relative(SRC, full)] : [];
  });
}

describe('status-bar backdrop on every scrolled screen (UX native final audit 27 Oct 2026, ruling 2)', () => {
  it.each(Object.entries(SCROLLED_SCREENS))('%s draws the backdrop (ShellPage or StatusBarBackdrop)', (_name, file) => {
    const source = read(file);
    expect(drawsShellPage(source) || drawsBackdrop(source)).toBe(true);
  });

  it('Exercises draws it on phones and gets it from TabletFrame on tablets', () => {
    const source = read('features/exercises/screens/ExercisesScreen.js');
    expect(drawsBackdrop(source)).toBe(true);
    expect(/<TabletFrame[\s>]/.test(source)).toBe(true);
    expect(drawsBackdrop(read('features/shell/TabletFrame.js'))).toBe(true);
  });

  it('every other file with a scroll view is listed: a scrolled screen or a named exception', () => {
    const scrolling = sourceFiles(SRC).filter((file) => /<(ScrollView|FlatList|SectionList|NestableScrollContainer|Scroller)[\s>]/.test(read(file)));
    const covered = new Set(Object.values(SCROLLED_SCREENS));
    const unlisted = scrolling.filter((file) => !covered.has(file) && !(file in NOT_UNDER_THE_STATUS_BAR) && !drawsShellPage(read(file)));
    expect(unlisted).toEqual([]);
  });

  it('keeps the light status-bar content', () => {
    expect(read('App.js')).toMatch(/<StatusBar style="light" \/>/);
  });
});
