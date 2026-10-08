import { BlurView } from 'expo-blur';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLayoutMetrics, MOBILE_COLUMN_MAX_WIDTH } from '../../../navigation/shell/layoutMetrics';
import { colors } from '../../../shared/theme/tokens';
import { centeredScrollOffset } from './runtimeRules';

// §19.0: the session's two pieces of chrome DO NOT SCROLL. The header is pinned
// to the top and the exercise nav to the bottom, with the set list scrolling
// between and *behind* them — so both are frosted, the same glass treatment the
// tab bar uses (RN-SPEC-app-shell §11).
//
// That is why the session does not use ShellPage: PageLayout puts everything
// inside one ScrollView, which is exactly what the device review caught. Here
// the header, the ScrollView and the nav are siblings.
//
// [O2] the header sits below the top safe inset and the nav adds the bottom one.
// The scroll content is padded by the nav's measured height, which stands in for
// the web's 144 bottom margin, so the last set clears the bar.
export default function SessionShell({ header, nav, overlay, scrollToKey, children }) {
  const insets = useSafeAreaInsets();
  const { gutter } = useLayoutMetrics();
  const [navHeight, setNavHeight] = useState(0);

  const scrollRef = useRef(null);
  const contentRef = useRef(null);
  const rows = useRef(new Map());
  const viewportHeight = useRef(0);
  const contentHeight = useRef(0);

  // §22.3: rows report themselves so the scroll can be measured, never guessed.
  const registerRow = useCallback((key, node) => {
    if (node) {
      rows.current.set(key, node);
    } else {
      rows.current.delete(key);
    }
  }, []);

  const scrollToRow = useCallback((key) => {
    const node = rows.current.get(key);
    const scroll = scrollRef.current;
    const content = contentRef.current;
    // The next set can live in an exercise that isn't rendered. The web's
    // querySelector returns null and nothing happens; so does this (⚠W24).
    if (!node || !scroll || !content) {
      return;
    }
    node.measureLayout(
      content,
      (_x, y, _width, height) => {
        const target = centeredScrollOffset({
          rowY: y,
          rowHeight: height,
          visibleHeight: viewportHeight.current,
          contentHeight: contentHeight.current,
        });
        if (target === null) {
          return;
        }
        scroll.scrollTo({ y: target, animated: true });
      },
      () => {}
    );
  }, []);

  const scrollApi = useRef({ registerRow, scrollToRow });
  scrollApi.current = { registerRow, scrollToRow };

  // Fires only when the key changes to a non-empty value, exactly like the web's
  // one effect on highlightedSetKey. Centring inside the scroll is already clear
  // of the header and nav, because §19.0 puts both outside it.
  useEffect(() => {
    if (!scrollToKey) {
      return;
    }
    scrollToRow(scrollToKey);
  }, [scrollToKey, scrollToRow]);

  return (
    <View testID="workout-screen" style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Glass />
        {header}
      </View>

      {/* "handled": with the default the first tap on a set action while the
          weight keyboard is up only dismisses the keyboard (see PageLayout). */}
      <ScrollView
        ref={scrollRef}
        testID="session-scroll"
        keyboardShouldPersistTaps="handled"
        onLayout={(event) => {
          viewportHeight.current = event.nativeEvent.layout.height;
        }}
        onContentSizeChange={(_width, height) => {
          contentHeight.current = height;
        }}
        contentContainerStyle={[styles.scroll, { paddingBottom: navHeight + 24 }]}
      >
        <View
          ref={contentRef}
          collapsable={false}
          style={[
            styles.column,
            { paddingLeft: gutter + insets.left, paddingRight: gutter + insets.right },
          ]}
        >
          <SessionScrollContext.Provider value={scrollApi.current}>{children}</SessionScrollContext.Provider>
        </View>
      </ScrollView>

      <View
        style={[styles.nav, { paddingLeft: insets.left, paddingRight: insets.right }]}
        onLayout={(event) => setNavHeight(event.nativeEvent.layout.height)}
      >
        <Glass />
        {nav}
      </View>

      {overlay}
    </View>
  );
}

const SessionScrollContext = createContext(null);

// §22.3: SetRow uses this to register itself for the auto-scroll. Null outside a
// session shell, so the row renders fine in isolation.
export function useSessionRowScroll(key) {
  const api = useContext(SessionScrollContext);
  const ref = useRef(null);
  useEffect(() => {
    if (!api) {
      return undefined;
    }
    api.registerRow(key, ref.current);
    return () => api.registerRow(key, null);
  }, [api, key]);
  return ref;
}

// glass-chrome: surface at 80% over a blur. The BlurView paints above the
// parent's own background, so the veil is a sibling on top of it rather than a
// background colour underneath.
function Glass() {
  return (
    <>
      <BlurView
        tint="light"
        intensity={24}
        experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, styles.veil]} />
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    // §19.0 z-order: header 30, nav 40, rest timer 50, completion popup 70.
    zIndex: 30,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(229,231,235,0.80)',
  },
  scroll: {
    alignItems: 'center',
  },
  column: {
    width: '100%',
    maxWidth: MOBILE_COLUMN_MAX_WIDTH,
  },
  nav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
    borderTopWidth: 1,
    borderTopColor: 'rgba(229,231,235,0.80)',
  },
  veil: {
    backgroundColor: 'rgba(255,255,255,0.80)',
  },
});
