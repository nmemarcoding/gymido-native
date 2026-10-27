import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  BackHandler,
  Easing,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { routes } from '../../../navigation/routes';
import BlurLayer from '../../../shared/components/BlurLayer';
import Chip from '../../../shared/components/Chip';
import EmptyState from '../../../shared/components/EmptyState';
import ErrorAlert from '../../../shared/components/ErrorAlert';
import { InlineError } from '../../../shared/components/FeedbackBox';
import Loader from '../../../shared/components/Loader';
import ExerciseImage, { muscleTextColor } from '../../../shared/components/ExerciseImage';
import { CAP_BODY, CAP_PILL, TITLE_TEXT } from '../../../shared/components/largeText';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { blur, breakpoints, colors, font, radii, spacing, textInputColors, textScale } from '../../../shared/theme/tokens';
import { useAuthStore } from '../../auth/authStore';
import AppHeader from '../../shell/AppHeader';
import DesktopSidebar from '../../shell/DesktopSidebar';
import ModeSwitch from '../../shell/ModeSwitch';
import { getScreenPath } from '../../shell/shellNavigation';
import { resolveMode, showsMobileModeSwitch } from '../../shell/shellRules';
import { listExercisesPage } from '../api/exercisesApi';
import MuscleGroupSheet from '../components/MuscleGroupSheet';
import { getCachedList, setCachedList } from '../exerciseListCache';
import {
  INITIAL_SEARCH,
  cardMuscleLabel,
  cardThumbnailSources,
  catalogErrorMessage,
  countFor,
  deriveCatalog,
  filterChips,
  flatGridRows,
  gridColumns,
  loadExerciseCatalog,
  loadRestPages,
  popSearch,
  submitSearch,
} from '../exercisesCatalog';

// RN-SPEC-exercises §E1 (Exercises tab root, `/exercises`). §E1.1a (T-12
// F3): a tab press or link (a new `entry` from openShellPath) is a fresh
// mount, so search, filter and scroll reset. A pop back from an exercise
// keeps this mounted screen as it was (filter, search, scroll) and reloads
// the list quietly.
//
// Unlike ShellPage, the shell chrome (app-shell §4) is drawn inside one
// virtualised FlatList so the search/filter bar can stick to the top while
// 700+ cards scroll under it. Same header, mode switch, sidebar and paddings.
export default function ExercisesScreen() {
  const route = useRoute();
  return <ExercisesCatalog key={route.params?.entry ?? 0} />;
}

function ExercisesCatalog() {
  const navigation = useNavigation();
  const route = useRoute();
  const path = getScreenPath(route.name, route.params);
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const storedPreference = useAuthStore((state) => state.workspace);
  const mode = resolveMode({ user, path, storedPreference });
  const tablet = width >= breakpoints.md;
  const sm = width >= breakpoints.sm;
  // The page cancels the shell's horizontal padding (web -mx-4 / ≥ 640 -mx-5)
  // and pads its own blocks with the same amount.
  const pad = sm ? 20 : 16;
  const sideLeft = tablet ? 0 : insets.left;
  const sideRight = tablet ? 0 : insets.right;
  const padding = { paddingLeft: pad + sideLeft, paddingRight: pad + sideRight };

  const [searchValue, setSearchValue] = useState('');
  const [search, setSearch] = useState(INITIAL_SEARCH);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [isFilterOpen, setFilterOpen] = useState(false);
  // `partial`: pages 2…N failed (§E1.2 step 4); its `error` is null while a
  // Retry is in flight, which hides the alert. `complete`: every page is in.
  const [load, setLoad] = useState({ status: 'loading', items: [], error: null, partial: null, complete: false });
  const loadRef = useRef(load);
  loadRef.current = load;
  const lastReturns = useRef(0);
  // §E1.2 step 1 (T-12 F2): a search reload keeps the list, with a spinner
  // in the search field.
  const [searching, setSearching] = useState(false);
  const listRef = useRef(null);
  const scrollToTop = () => listRef.current?.scrollToOffset({ offset: 0, animated: false });
  // Bumped by every new load and on unmount; an older load's or retry's
  // answer is dropped.
  const loadId = useRef(0);
  // §E1.1a: coming back to this screen (a pop from an exercise) loads again.
  const [returns, setReturns] = useState(0);
  useEffect(() => {
    let blurred = false;
    const offBlur = navigation.addListener('blur', () => {
      blurred = true;
    });
    const offFocus = navigation.addListener('focus', () => {
      if (blurred) {
        blurred = false;
        setReturns((value) => value + 1);
      }
    });
    return () => {
      offBlur();
      offFocus();
    };
  }, [navigation]);

  // §E1.2 (F1): runs on mount, whenever the applied search changes, and on
  // a return. §E1.1a: a cached complete list shows at once and is reloaded
  // quietly; nothing changes until the whole new list is in, and a failure
  // keeps the cached list with no error. Native (T-12 F3 review M2): a
  // return with no cache but a list on screen reloads quietly too, so the
  // scroll is kept; only a complete result replaces it, a page-1 failure
  // keeps it, and a later-page failure shows the step-4 alert if the list
  // shown is not complete.
  useEffect(() => {
    const id = ++loadId.current;
    const alive = () => loadId.current === id;
    const applied = search.applied;
    const isReturn = returns !== lastReturns.current;
    lastReturns.current = returns;
    const shown = loadRef.current;
    const cached = getCachedList(applied);
    const quiet = Boolean(cached) || (isReturn && shown.status === 'loaded' && shown.items.length > 0);
    // A new search while a list is shown (not a return, not the first load).
    const searchReload = !isReturn && shown.status === 'loaded';
    setSearching(false);
    if (quiet) {
      if (cached) {
        setLoad((current) =>
          current.items === cached ? current : { status: 'loaded', items: cached, error: null, partial: null, complete: true }
        );
        if (searchReload) {
          scrollToTop();
        }
      }
      loadExerciseCatalog({ fetchPage: listExercisesPage, search: applied })
        .then(({ items, partial }) => {
          if (!partial) {
            setCachedList(applied, items);
            if (alive()) {
              setLoad({ status: 'loaded', items, error: null, partial: null, complete: true });
            }
          } else if (alive()) {
            setLoad((current) => (current.complete || current.partial ? current : { ...current, partial }));
          }
        })
        .catch(() => {});
    } else {
      if (searchReload) {
        // The old search's step-4 alert (and its Retry) goes when searching starts.
        setLoad((current) => ({ ...current, partial: null }));
        setSearching(true);
        AccessibilityInfo.announceForAccessibility('Searching…');
      } else {
        setLoad({ status: 'loading', items: [], error: null, partial: null, complete: false });
      }
      // Page 1 replaces the list (from the top, when it was a search reload).
      let firstShown = false;
      const showFirst = (items, rest) => {
        firstShown = true;
        setLoad({ status: 'loaded', items, error: null, complete: false, partial: null, ...rest });
        setSearching(false);
        if (searchReload) {
          scrollToTop();
        }
      };
      loadExerciseCatalog({
        fetchPage: listExercisesPage,
        search: applied,
        onFirstPage: (items) => {
          if (alive()) {
            showFirst(items);
          }
        },
      })
        .then(({ items, partial }) => {
          if (!partial) {
            setCachedList(applied, items);
          }
          if (!alive()) {
            return;
          }
          if (firstShown) {
            setLoad({ status: 'loaded', items, error: null, partial, complete: !partial });
          } else {
            showFirst(items, { partial, complete: !partial });
          }
        })
        .catch((error) => {
          if (alive()) {
            setSearching(false);
            setLoad({ status: 'error', items: [], error, partial: null, complete: false });
          }
        });
    }
    return () => {
      loadId.current += 1;
    };
  }, [search.applied, returns]);

  // §E1.2 step 4: Retry re-requests pages 2…N only, with the same search.
  const retryRestPages = () => {
    const { partial } = load;
    // Only ever completes the search that failed.
    if (!partial?.error || partial.search !== search.applied) {
      return;
    }
    const id = loadId.current;
    const applied = search.applied;
    setLoad((current) => ({ ...current, partial: { ...partial, error: null } }));
    loadRestPages({ fetchPage: listExercisesPage, search: applied, totalPages: partial.totalPages })
      .then((rest) => {
        const items = partial.firstItems.concat(rest);
        setCachedList(applied, items);
        if (loadId.current === id) {
          setLoad({ status: 'loaded', items, error: null, partial: null, complete: true });
        }
      })
      .catch((error) => {
        if (loadId.current === id) {
          setLoad((current) => ({ ...current, partial: { ...partial, error } }));
        }
      });
  };

  // ⚠E-10: Android back steps back through applied searches first.
  const searchRef = useRef(search);
  searchRef.current = search;
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        const previous = popSearch(searchRef.current);
        if (!previous) {
          return false;
        }
        setSearch(previous);
        return true;
      });
      return () => subscription.remove();
    }, [])
  );

  const catalog = useMemo(() => deriveCatalog(load.items, categoryFilter), [load.items, categoryFilter]);
  const columns = gridColumns(width);
  const openExercise = useCallback(
    (id) => navigation.push(routes.ExerciseDetail, { exerciseId: String(id) }),
    [navigation]
  );

  const loaded = load.status === 'loaded';
  const data = useMemo(() => {
    const rows = [{ type: 'header', key: 'header' }];
    if (load.status === 'loading') {
      rows.push({ type: 'loader', key: 'loader' });
    } else if (load.status === 'error') {
      rows.push({ type: 'error', key: 'error' });
    } else {
      rows.push({ type: 'bar', key: 'bar' });
      if (load.partial?.error) {
        rows.push({ type: 'partialError', key: 'partialError' });
      }
      if (load.items.length === 0) {
        rows.push({ type: 'empty', key: 'empty' });
      } else {
        // ⚠E-6: a filter with no matches renders no groups and no empty state.
        // ND-3: flat grid, v1 order.
        rows.push(...flatGridRows(catalog.groups, columns));
      }
    }
    return rows;
  }, [load.status, load.items, load.partial, catalog.groups, columns]);

  const renderItem = ({ item }) => {
    switch (item.type) {
      case 'header':
        return (
          <View style={{ paddingLeft: pad + sideLeft, paddingRight: pad + sideRight }}>
            <AppHeader path={path} mode={mode} />
            {/* UX G "Tablet: Exercises": the board draws the H1 (supersedes "Tablets have no title"). */}
            {tablet ? (
              <Text testID="exercises-title" accessibilityRole="header" {...TITLE_TEXT} style={styles.titleTablet}>
                Exercises
              </Text>
            ) : null}
            {!tablet && showsMobileModeSwitch({ user, path }) ? (
              <View style={styles.mobileSwitch}>
                <Text style={styles.mobileSwitchLabel}>Workspace</Text>
                <ModeSwitch mode={mode} />
              </View>
            ) : null}
          </View>
        );
      case 'loader':
        // ⚠E-3: the loader replaces the whole page, search bar included.
        return (
          <View style={padding}>
            <Loader label="Loading exercises" />
          </View>
        );
      case 'error':
        // ⚠E-4 (narrowed 25 Oct to a page-1 failure): no retry, no search box.
        return (
          <View style={padding}>
            <InlineError testID="exercises-error" title="Exercises unavailable" message={catalogErrorMessage(load.error)} />
          </View>
        );
      case 'bar':
        return (
          <StickyBar
            padding={padding}
            searchValue={searchValue}
            onChangeSearch={setSearchValue}
            onSubmitSearch={() => setSearch((current) => submitSearch(current, searchValue))}
            searching={searching}
            showFilter={catalog.categories.length > 0}
            categories={catalog.categories}
            categoryFilter={categoryFilter}
            filterCount={countFor(catalog.categoryCounts, categoryFilter)}
            onSelectFilter={setCategoryFilter}
            onOpenFilter={() => setFilterOpen(true)}
            tablet={tablet}
            reflow={fontScale > textScale.reflowAbove}
          />
        );
      case 'partialError':
        return (
          <View style={[padding, styles.contentTop]}>
            {/* UX D "Exercises, error": the compact card; Retry = ruling 2. */}
            <ErrorAlert
              testID="exercises-partial-error"
              variant="compact"
              retryTestID="exercises-partial-retry"
              title="Some exercises didn't load"
              description={catalogErrorMessage(load.partial.error)}
              onRetry={retryRestPages}
            />
          </View>
        );
      case 'empty':
        return (
          <View style={[padding, styles.contentTop]}>
            <EmptyState title="No exercises found" message="Try a different search term." />
          </View>
        );
      case 'row':
        return (
          <View style={[padding, styles.gridRow, item.firstInGroup ? styles.firstRow : styles.gridRowGap]}>
            {Array.from({ length: columns }, (_, slot) => {
              const exercise = item.cards[slot];
              return exercise ? (
                <ExerciseCard key={exercise.id ?? slot} exercise={exercise} onOpen={openExercise} tablet={tablet} />
              ) : (
                <View key={`filler-${slot}`} style={styles.cardSlot} />
              );
            })}
          </View>
        );
      default:
        return null;
    }
  };

  const list = (
    <FlatList
      ref={listRef}
      testID="exercises-list"
      accessibilityState={{ busy: searching }}
      data={data}
      renderItem={renderItem}
      keyExtractor={(item) => item.key}
      stickyHeaderIndices={loaded ? [1] : undefined}
      // Android Fabric crashes (addViewAt IndexOutOfBounds) when clipped
      // subviews meet a sticky header that appears after load.
      removeClippedSubviews={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      initialNumToRender={10}
      windowSize={7}
      contentContainerStyle={{ paddingTop: tablet ? 24 : 0, paddingBottom: 32 + (tablet ? 40 : 112) + insets.bottom }}
    />
  );

  return (
    <View testID="exercises-screen" style={[styles.screen, { paddingTop: insets.top }]}>
      {tablet ? (
        <View style={[styles.tabletRow, { paddingLeft: 24 + insets.left, paddingRight: 24 + insets.right }]}>
          <View style={styles.sidebarColumn}>
            <DesktopSidebar mode={mode} path={path} />
          </View>
          <View style={styles.tabletContent}>{list}</View>
        </View>
      ) : (
        <View style={styles.phoneColumn}>{list}</View>
      )}
      <MuscleGroupSheet
        open={isFilterOpen}
        categories={catalog.categories}
        categoryCounts={catalog.categoryCounts}
        total={load.items.length}
        value={categoryFilter}
        onSelect={(value) => {
          setCategoryFilter(value);
          setFilterOpen(false);
        }}
        onClose={() => setFilterOpen(false)}
      />
    </View>
  );
}

// §E1.4 sticky bar, v2 (UX G "Exercises", ND-2): the pill search field
// and the chip row AS DRAWN: "All" + the raw muscle groups, single select,
// horizontally scrolling (§9: wraps past 1.3, never hides chips), then the
// native trailing "All muscle groups ▾" chip that opens the full-list sheet.
function StickyBar({ padding, searchValue, onChangeSearch, onSubmitSearch, searching, showFilter, categories, categoryFilter, filterCount, onSelectFilter, onOpenFilter, tablet, reflow }) {
  const [focused, setFocused] = useState(false);
  const chips = filterChips(categories).map((chip) => (
    <Chip
      key={chip.value || '__all__'}
      testID={`exercises-chip-${chip.value || 'all'}`}
      label={chip.label}
      selected={chip.value === categoryFilter}
      onPress={() => onSelectFilter(chip.value)}
      style={tablet ? styles.chipTablet : null}
    />
  ));
  const sheetChip = (
    <Pressable
      key="__sheet__"
      testID="exercises-filter"
      accessibilityRole="button"
      accessibilityLabel={`All muscle groups${categoryFilter ? `, ${categoryFilter} selected, ${filterCount}` : ''}`}
      onPress={onOpenFilter}
      hitSlop={{ top: 3, bottom: 3 }}
      style={[styles.sheetChip, tablet && styles.chipTablet]}
    >
      {({ pressed }) => (
        <>
          {pressed ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pressOverlay]} /> : null}
          <Text {...CAP_BODY} style={styles.sheetChipText}>
            All muscle groups
          </Text>
          <Svg width={14} height={14} viewBox="0 0 20 20" fill="none">
            <Path d="M6 8l4 4 4-4" stroke={colors.textStrong2} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </>
      )}
    </Pressable>
  );
  return (
    <View testID="exercises-bar" style={[styles.bar, padding]}>
      <BlurLayer blurPx={blur.groundBar} />
      <View style={[StyleSheet.absoluteFill, styles.barFill]} />
      <View testID="exercises-search-box" style={[styles.searchBox, tablet && styles.searchBoxTablet]}>
        <TextInput
          {...textInputColors}
          testID="exercises-search"
          value={searchValue}
          onChangeText={onChangeSearch}
          onSubmitEditing={onSubmitSearch}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Search exercises"
          placeholderTextColor={colors.textFaint}
          accessibilityLabel="Search exercises"
          returnKeyType="search"
          enterKeyHint="search"
          maxFontSizeMultiplier={textScale.body}
          // iOS's clear "×" would sit on the spinner, so it hides while a
          // search loads (T-12 F2, PM/UX decision 26 Oct 2026).
          clearButtonMode={!searching && Platform.OS === 'ios' ? 'while-editing' : 'never'}
          autoCorrect={false}
          autoCapitalize="none"
          style={[styles.searchInput, searching && styles.searchInputSearching, focused && styles.searchInputFocused]}
        />
        <View testID="exercises-search-icon" pointerEvents="none" style={styles.searchGlyph} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
        {searching ? <SearchSpinner /> : null}
      </View>
      {showFilter ? (
        reflow ? (
          <View testID="exercises-chips" accessibilityRole="radiogroup" accessibilityLabel="Muscle group" style={styles.chipsWrap}>
            {chips}
            {sheetChip}
          </View>
        ) : (
          <ScrollView
            testID="exercises-chips"
            horizontal
            showsHorizontalScrollIndicator={false}
            accessibilityRole="radiogroup"
            accessibilityLabel="Muscle group"
            keyboardShouldPersistTaps="handled"
            style={styles.chipsScroll}
            contentContainerStyle={styles.chipsRow}
          >
            {chips}
            {sheetChip}
          </ScrollView>
        )
      ) : null}
    </View>
  );
}

// §E1.2 step 1 (T-12 F2): 18×18 at 14 from the right, a 2px `border` ring
// with a brand-700 top arc; 1 turn/s, or 3 s with reduced motion (it never
// stops). Not pressable, hidden from accessibility.
function SearchSpinner() {
  const reducedMotion = useReducedMotion();
  const turn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    turn.setValue(0);
    const animation = Animated.loop(
      Animated.timing(turn, { toValue: 1, duration: reducedMotion ? 3000 : 1000, easing: Easing.linear, useNativeDriver: true })
    );
    animation.start();
    return () => animation.stop();
  }, [turn, reducedMotion]);
  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <View testID="exercises-search-spinner" pointerEvents="none" style={styles.spinnerSlot} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.spinner, { transform: [{ rotate }] }]} />
    </View>
  );
}

// §E1a. Pressable → push Exercise detail (dated change 23 Oct 2026). v2
// (UX G): the photo / §8.1 tile area (108, tablet 150) with the muscle chip
// on the glass on-photo pill bottom-left; the name wraps to 2 lines; the
// sub-line is the muscle label (ND-4).
const ExerciseCard = memo(function ExerciseCard({ exercise, onOpen, tablet }) {
  const url = exercise?.thumbnail?.url;
  const sources = useMemo(() => cardThumbnailSources(url), [url]);
  const muscle = cardMuscleLabel(exercise);
  const muscleInk = muscleTextColor(exercise?.primary_muscle_group?.code || exercise?.primary_muscle_group?.name) ?? colors.textSecondary;
  return (
    <Pressable
      testID={`exercise-card-${exercise.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${exercise.name}, ${muscle}`}
      onPress={() => onOpen(exercise.id)}
      style={({ pressed }) => [styles.cardSlot, styles.card, pressed && styles.cardPressed]}
    >
      <ExerciseImage
        testID={`exercise-card-image-${exercise.id}`}
        exercise={exercise}
        muscleCode={exercise?.primary_muscle_group?.code || exercise?.primary_muscle_group?.name}
        sources={sources}
        hero
        style={[styles.cardMedia, tablet && styles.cardMediaTablet]}
      >
        <View testID={`exercise-card-chip-${exercise.id}`} style={styles.muscleChip} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text {...CAP_PILL} numberOfLines={1} style={[styles.muscleChipText, tablet && styles.muscleChipTextTablet, { color: muscleInk }]}>
            {muscle}
          </Text>
        </View>
      </ExerciseImage>
      <View style={[styles.cardBody, tablet && styles.cardBodyTablet]}>
        {/* §9: a user-facing name in a dense grid: 2 lines max, full text in the label. */}
        <Text {...CAP_BODY} numberOfLines={2} style={[styles.cardName, tablet && styles.cardNameTablet]}>
          {exercise.name}
        </Text>
        <Text {...CAP_BODY} numberOfLines={1} style={[styles.cardMuscle, tablet && styles.cardMuscleTablet]}>
          {muscle}
        </Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  phoneColumn: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
  },
  tabletRow: {
    flex: 1,
    width: '100%',
    maxWidth: 1152,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 32,
  },
  // App-shell §4: on ≥ 768 the sidebar is sticky at top 24.
  sidebarColumn: {
    paddingTop: 24,
  },
  // The page's -mx-5 at ≥ 640 reaches into the shell padding.
  tabletContent: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: -20,
  },
  mobileSwitch: {
    marginBottom: 20,
  },
  mobileSwitchLabel: {
    marginBottom: 8,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 2.64,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  titleTablet: {
    ...font(700),
    marginTop: spacing[2],
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1.6,
    color: colors.textPrimary,
  },
  bar: {
    overflow: 'hidden',
    gap: 14,
    paddingTop: 12,
    paddingBottom: 12,
  },
  barFill: {
    backgroundColor: colors.groundBar,
  },
  searchBox: {
    justifyContent: 'center',
  },
  searchBoxTablet: {
    width: 320,
    maxWidth: '100%',
  },
  // UX G: 52 tall pill, surface, the 0.08 edge → hairline-strong (ladder).
  searchInput: {
    ...font(400),
    minHeight: 52,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surface,
    paddingVertical: 14,
    paddingLeft: 46,
    paddingRight: 16,
    fontSize: 16,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  searchInputSearching: {
    paddingRight: 44,
  },
  searchInputFocused: {
    borderColor: colors.gold,
    boxShadow: `0px 0px 0px 4px ${colors.goldFocus}`,
  },
  spinnerSlot: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 14,
    justifyContent: 'center',
  },
  spinner: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.hairlineStrong,
    borderTopColor: colors.gold,
  },
  searchGlyph: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 18,
    justifyContent: 'center',
  },
  chipsScroll: {
    marginHorizontal: -16,
  },
  chipsRow: {
    gap: spacing[2],
    paddingHorizontal: 16,
    paddingVertical: 3,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  chipTablet: {
    minHeight: 40,
    paddingHorizontal: 18,
  },
  // Off-chip look (kit Chip off) with a trailing chevron.
  sheetChip: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['1_5'],
    overflow: 'hidden',
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.fillWell,
    paddingHorizontal: spacing[4],
  },
  sheetChipText: {
    ...font(500),
    fontSize: 14,
    lineHeight: 18,
    color: colors.textStrong2,
  },
  pressOverlay: {
    backgroundColor: colors.pressOverlay,
  },
  contentTop: {
    paddingTop: 20,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  gridRowGap: {
    marginTop: 12,
  },
  firstRow: {
    marginTop: 4,
  },
  cardSlot: {
    flex: 1,
    minWidth: 0,
  },
  card: {
    overflow: 'hidden',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  // Pressed: the gold-line edge (code 0.40 → gold-line 0.30).
  cardPressed: {
    borderColor: colors.goldLine,
  },
  cardMedia: {
    aspectRatio: undefined,
    height: 108,
    borderRadius: 0,
  },
  cardMediaTablet: {
    height: 150,
  },
  muscleChip: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    maxWidth: '80%',
    minHeight: 24,
    justifyContent: 'center',
    borderRadius: radii.full,
    backgroundColor: colors.onPhoto,
    paddingHorizontal: 9,
  },
  muscleChipText: {
    ...font(600),
    fontSize: 12,
    lineHeight: 16,
  },
  muscleChipTextTablet: {
    fontSize: 13,
  },
  cardBody: {
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 16,
  },
  cardBodyTablet: {
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  cardName: {
    ...font(600),
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  cardNameTablet: {
    fontSize: 16,
    lineHeight: 22,
  },
  cardMuscle: {
    ...font(400),
    marginTop: 3,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  cardMuscleTablet: {
    fontSize: 13,
    lineHeight: 18,
  },
});
