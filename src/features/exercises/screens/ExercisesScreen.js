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
import ErrorAlert from '../../../shared/components/ErrorAlert';
import Loader from '../../../shared/components/Loader';
import ExerciseImage, { muscleTextColor } from '../../../shared/components/ExerciseImage';
import { CAP_BODY, CAP_PILL, TITLE_TEXT } from '../../../shared/components/largeText';
import { focusNode } from '../../../shared/hooks/useSheetFocus';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { blur, breakpoints, colors, font, layout, radii, spacing, textInputColors, textScale } from '../../../shared/theme/tokens';
import { useAuthStore } from '../../auth/authStore';
import AppHeader from '../../shell/AppHeader';
import TabletFrame from '../../shell/TabletFrame';
import ModeSwitch from '../../shell/ModeSwitch';
import { getScreenPath } from '../../shell/shellNavigation';
import { resolveMode, showsMobileModeSwitch } from '../../shell/shellRules';
import { listEquipmentTypes, listExercisesPage, listMuscleGroups } from '../api/exercisesApi';
import { ActiveFilterLine, FilterButton, NoMatchState } from '../components/ExerciseFilterBar';
import ExerciseFilterPanel from '../components/ExerciseFilterPanel';
import ExerciseFilterSheet from '../components/ExerciseFilterSheet';
import { getCachedList, setCachedList } from '../exerciseListCache';
import {
  NO_FILTERS,
  activeFilterValues,
  appliedFilters,
  clearAllShown,
  equipmentNameMap,
  filterExercises,
  filterFacets,
  rememberSeen,
  seedMuscles,
  noMatchMessage,
  resultCountText,
} from '../exerciseFilters';
import {
  INITIAL_SEARCH,
  cardMuscleLabel,
  cardThumbnailSources,
  catalogErrorMessage,
  deriveCatalog,
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
  // T-62 ≥ 1024 (tablet landscape): the always-visible filter panel replaces
  // the Filter button + dialog, except at large text (font scale ≥ 1.5),
  // where the 256–280 column can't hold the text.
  const panelShown = width >= breakpoints.lg && fontScale < 1.5;
  const sm = width >= breakpoints.sm;
  // The page cancels the shell's horizontal padding (web -mx-4 / ≥ 640 -mx-5)
  // and pads its own blocks with the same amount.
  const pad = sm ? 20 : 16;
  const sideLeft = tablet ? 0 : insets.left;
  const sideRight = tablet ? 0 : insets.right;
  const padding = { paddingLeft: pad + sideLeft, paddingRight: pad + sideRight };

  const [searchValue, setSearchValue] = useState('');
  const [search, setSearch] = useState(INITIAL_SEARCH);
  // T-62 (27 Oct 2026): one muscle (group key) and one equipment id, each
  // single select; both survive a new search (as ⚠E-6's filter did).
  const [filters, setFilters] = useState(NO_FILTERS);
  const [isFilterOpen, setFilterOpen] = useState(false);
  // T-62 Data: ONE GET /equipment-types per screen load names the items'
  // `equipment_type_id`. Null while pending or after a failure (fail-soft:
  // Muscle only, variant A).
  const [equipmentNames, setEquipmentNames] = useState(null);
  useEffect(() => {
    let alive = true;
    Promise.resolve()
      .then(() => listEquipmentTypes())
      .then((types) => {
        const names = equipmentNameMap(types);
        if (alive && names.size > 0) {
          setEquipmentNames(names);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  // Dated 27 Oct 2026 (audit b3): ONE GET /muscle-groups per screen load
  // seeds the muscle rows; fail-soft like /equipment-types (rows = seen).
  const [muscleSeed, setMuscleSeed] = useState(null);
  useEffect(() => {
    let alive = true;
    Promise.resolve()
      .then(() => listMuscleGroups())
      .then((groups) => {
        const names = seedMuscles(groups);
        if (alive && names.size > 0) {
          setMuscleSeed(names);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  // T-62 States: the page-1 error's Retry re-runs the load.
  const [attempt, setAttempt] = useState(0);
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
  }, [search.applied, returns, attempt]);

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

  // T-62: an equipment filter applies once its name is known; the grid is
  // the loaded list (= the search) narrowed by both facets, then grouped as
  // before (§E1.3 order, ND-3 flat rows).
  const applied = useMemo(() => appliedFilters(filters, equipmentNames), [filters, equipmentNames]);
  const filtered = useMemo(() => filterExercises(load.items, applied), [load.items, applied]);
  const catalog = useMemo(() => deriveCatalog(filtered, ''), [filtered]);
  // "While the first load runs" (until the whole list or the step-4 partial
  // is in): the count says "Loading…" and the rows' counts "—".
  const settled = useRef(false);
  if (load.complete || load.partial) {
    settled.current = true;
  }
  const firstLoad = !settled.current && load.status !== 'error';
  // Audit b3: the rows = every muscle / equipment seen in any list loaded
  // this session (+ the seed); only the counts follow the current list.
  const seenRef = useRef(null);
  const seen = useMemo(() => {
    seenRef.current = rememberSeen(seenRef.current, load.items);
    return muscleSeed ? { ...seenRef.current, muscles: new Set([...muscleSeed, ...seenRef.current.muscles]) } : seenRef.current;
  }, [load.items, muscleSeed]);
  const facets = useMemo(
    () => filterFacets(load.items, applied, equipmentNames, { loading: firstLoad, seen }),
    [load.items, applied, equipmentNames, firstLoad, seen]
  );
  const values = activeFilterValues(applied, equipmentNames);
  const anySet = values.length > 0 || Boolean(search.applied);
  // The page-1 error state has no count (the alert speaks for the results).
  const countText = load.status === 'error' ? '' : resultCountText({ loading: firstLoad, count: filtered.length });
  const columns = gridColumns(width, { panel: panelShown });
  const openExercise = useCallback(
    (id) => navigation.push(routes.ExerciseDetail, { exerciseId: String(id) }),
    [navigation]
  );

  // T-62 (UX 27 Oct 2026): the results count is announced once per change:
  // a search applies on submit, so once per submit (when its list is whole),
  // never while typing; a filter tap is a change too. The first settled
  // count (the page opening) is not announced.
  const announced = useRef(null);
  const announceReady = load.status === 'loaded' && !searching && (load.complete || Boolean(load.partial));
  useEffect(() => {
    if (!announceReady || !countText) {
      return;
    }
    if (announced.current !== null && announced.current !== countText) {
      AccessibilityInfo.announceForAccessibility(countText.replace(/\u00a0/g, ' '));
    }
    announced.current = countText;
  }, [announceReady, countText]);

  // Focus moves (accessibility focus: a touch user's keyboard stays shut).
  const searchFieldRef = useRef(null);
  const filterButtonRef = useRef(null);
  const chipRefs = useRef({});
  const [focusTarget, setFocusTarget] = useState(null);
  useEffect(() => {
    if (!focusTarget) {
      return undefined;
    }
    // After the commit that removed the chip / cleared the filters.
    const timer = setTimeout(() => {
      focusNode({ current: focusTarget === 'search' ? searchFieldRef.current : chipRefs.current[focusTarget] });
      setFocusTarget(null);
    }, 0);
    return () => clearTimeout(timer);
  }, [focusTarget]);

  const selectFilter = (facet, value) => setFilters((current) => ({ ...current, [facet]: value }));
  // After removing a chip, focus the next chip, else the search field.
  const removeFilter = (facet) => {
    setFilters((current) => ({ ...current, [facet]: '' }));
    setFocusTarget(facet === 'muscle' && applied.equipment ? 'equipment' : 'search');
  };
  const clearSearch = () => {
    setSearchValue('');
    setSearch((current) => submitSearch(current, ''));
  };
  // "Clear all" (line) and "Clear filters" (no match): filters + search.
  const clearAll = () => {
    setFilters(NO_FILTERS);
    clearSearch();
    setFocusTarget('search');
  };

  const data = useMemo(() => {
    // T-62 States: the toolbar and the active line stay in every state; the
    // Loader and the error sit in the results area. With the ≥ 1024 panel
    // they sit ABOVE the [panel | results] row instead (web parity), so the
    // list holds the results only.
    const rows = panelShown
      ? []
      : [
          { type: 'header', key: 'header' },
          { type: 'bar', key: 'bar' },
          { type: 'line', key: 'line' },
        ];
    if (load.status === 'loading') {
      rows.push({ type: 'loader', key: 'loader' });
    } else if (load.status === 'error') {
      rows.push({ type: 'error', key: 'error' });
    } else {
      if (load.partial?.error) {
        rows.push({ type: 'partialError', key: 'partialError' });
      }
      // T-62 No match (⚠E-6's blank space stays retired).
      if (catalog.groups.length === 0) {
        rows.push({ type: 'empty', key: 'empty' });
      } else {
        // ND-3: flat grid, v1 order.
        rows.push(...flatGridRows(catalog.groups, columns));
      }
    }
    return rows;
  }, [load.status, load.partial, catalog.groups, columns, panelShown]);

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
        // T-62 States (narrows ⚠E-3): the first load keeps the toolbar; the
        // Loader fills the results area.
        return (
          <View style={[padding, styles.contentTop]}>
            <Loader label="Loading exercises" />
          </View>
        );
      case 'error':
        // T-62 States (replaces ⚠E-4's "InlineError, no retry, no search
        // box"): the shared ErrorAlert + the transport text + Retry.
        return (
          <View style={[padding, styles.contentTop]}>
            <ErrorAlert
              testID="exercises-error"
              retryTestID="exercises-error-retry"
              title="Exercises unavailable"
              description={catalogErrorMessage(load.error)}
              onRetry={() => setAttempt((value) => value + 1)}
            />
          </View>
        );
      case 'bar':
        return (
          <StickyBar
            padding={padding}
            searchFieldRef={searchFieldRef}
            searchValue={searchValue}
            onChangeSearch={setSearchValue}
            onSubmitSearch={() => setSearch((current) => submitSearch(current, searchValue))}
            searching={searching}
            filterButton={
              panelShown ? null : (
                <FilterButton
                  ref={filterButtonRef}
                  values={values.map((entry) => entry.value)}
                  open={isFilterOpen}
                  onPress={() => setFilterOpen(true)}
                  tablet={tablet}
                  tall={tablet && width < 1280}
                  hideLabel={fontScale > textScale.reflowAbove}
                />
              )
            }
            tablet={tablet}
            tall={tablet && width < 1280}
          />
        );
      case 'line':
        return (
          <ActiveFilterLine
            style={[padding, styles.lineRow]}
            countText={countText}
            emphasized={anySet}
            chips={values}
            chipRefs={chipRefs}
            onRemove={removeFilter}
            showClearAll={clearAllShown({ muscle: applied.muscle, equipment: applied.equipment, search: search.applied })}
            onClearAll={clearAll}
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
            <NoMatchState
              message={noMatchMessage(values.map((entry) => entry.value), search.applied)}
              showClear={anySet}
              showSearchAll={values.length > 0 && Boolean(search.applied)}
              onClearFilters={clearAll}
              onSearchAll={() => {
                setFilters(NO_FILTERS);
                setFocusTarget('search');
              }}
            />
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
      stickyHeaderIndices={panelShown ? undefined : [1]}
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
    <View testID="exercises-screen" style={[styles.screen, { paddingTop: tablet ? 0 : insets.top }]}>
      {tablet ? (
        // T-55/T-56: room for the overlay's rail (TabletFrame takes the top/left insets).
        <TabletFrame>
          <View style={[styles.tabletRow, { paddingRight: 4 + insets.right }]}>
            <View style={styles.tabletContent}>
              {panelShown ? (
                <>
                  {/* Web parity (≥ 1024): the title, toolbar and active line above a [256 | 1fr] row. */}
                  {renderItem({ item: { type: 'header' } })}
                  {renderItem({ item: { type: 'bar' } })}
                  {renderItem({ item: { type: 'line' } })}
                  <View testID="exercises-panel-row" style={styles.panelRow}>
                    <ExerciseFilterPanel
                      facets={facets}
                      filters={applied}
                      onSelect={selectFilter}
                      loadingNames={firstLoad && load.items.length === 0}
                      width={width}
                      maxHeight="100%"
                      style={styles.panel}
                    />
                    <View style={styles.listColumn}>{list}</View>
                  </View>
                </>
              ) : (
                <View style={styles.listColumn}>{list}</View>
              )}
            </View>
          </View>
        </TabletFrame>
      ) : (
        <View style={styles.phoneColumn}>{list}</View>
      )}
      <ExerciseFilterSheet
        // A rotation into the panel layout closes it.
        open={isFilterOpen && !panelShown}
        facets={facets}
        filters={applied}
        // PM line (pending FE merge): null while loading → "Loading…".
        resultCount={firstLoad ? null : filtered.length}
        loadingNames={firstLoad && load.items.length === 0}
        onSelect={selectFilter}
        onClose={() => setFilterOpen(false)}
        returnRef={filterButtonRef}
      />
    </View>
  );
}

// §E1.4 sticky bar, v2 (UX G "Exercises"), as changed by T-62 (UX T62 §2):
// ONE toolbar row, the pill search field (flex 1; 52, 56 at 768–1279) and
// the Filter button at the same height (row gap 8, 10 from 768). The
// sideways muscle chip row and its "All muscle groups ▾" chip are gone.
function StickyBar({ padding, searchFieldRef, searchValue, onChangeSearch, onSubmitSearch, searching, filterButton, tablet, tall }) {
  const [focused, setFocused] = useState(false);
  return (
    <View testID="exercises-bar" style={[styles.bar, padding]}>
      <BlurLayer blurPx={blur.groundBar} />
      <View style={[StyleSheet.absoluteFill, styles.barFill]} />
      <View testID="exercises-toolbar" style={[styles.toolbar, tablet && styles.toolbarTablet]}>
        <View testID="exercises-search-box" style={styles.searchBox}>
          <TextInput
            {...textInputColors}
            ref={searchFieldRef}
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
            style={[styles.searchInput, tall && styles.searchInputTall, searching && styles.searchInputSearching, focused && styles.searchInputFocused]}
          />
          <View testID="exercises-search-icon" pointerEvents="none" style={styles.searchGlyph} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
          {searching ? <SearchSpinner /> : null}
        </View>
        {filterButton}
      </View>
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
  // T-55: beside the rail; content capped at 1120 (+ the rows' own 20
  // padding each side) and centred at ≥ 1280.
  // The page's -mx-5 at ≥ 640 reaches into the shell's 24 gutter: 4 + the rows' 20.
  tabletRow: {
    flex: 1,
    paddingLeft: 4,
  },
  tabletContent: {
    flex: 1,
    minWidth: 0,
    width: '100%',
    maxWidth: layout.contentMax + 40,
    alignSelf: 'center',
  },
  // T-62 panel row: the panel 20 in (the rows' own padding) and 4 + the
  // rows' 20 padding = the 24 gap to the results.
  // ≥ 1024: the panel beside the results only, both under the toolbar.
  panelRow: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 0,
  },
  panel: {
    marginLeft: 20,
    marginRight: 4,
  },
  listColumn: {
    flex: 1,
    minWidth: 0,
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
    paddingTop: 12,
    paddingBottom: 12,
  },
  // T-62 toolbar: search (flex 1) + Filter, gap 8 (10 from 768), centred.
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  toolbarTablet: {
    gap: spacing['2_5'],
  },
  lineRow: {
    paddingTop: 4,
  },
  barFill: {
    backgroundColor: colors.groundBar,
  },
  searchBox: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
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
  searchInputTall: {
    minHeight: 56,
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
