import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKeyboardHeight } from '../hooks/useKeyboardHeight';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { breakpoints, colors, motion, radii, shadows } from '../theme/tokens';
import BlurLayer from './BlurLayer';

const EASE_OUT = Easing.bezier(0, 0, 0.58, 1);
// Design system v1 P10: the workout dialogs pop in (ease-pop, 260 ms).
const EASE_POP = Easing.bezier(0.34, 1.56, 0.64, 1);
const MAX_WIDTHS = { md: 448, lg: 512, '2xl': 672 };

// Trainer plans spec §A3.1. RN <Modal> gives the paired scroll lock for free;
// Android back and the scrim both call onClose.
export default function AppModal({ isOpen, onClose, title, description, size = 'lg', footer, children, testID, entrance = 'slide', compact = false }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = width >= breakpoints.sm;
  const reducedMotion = useReducedMotion();
  const keyboardHeight = useKeyboardHeight();
  // An open keyboard replaces the bottom inset so the card stays above it.
  const bottomInset = keyboardHeight > 0 ? keyboardHeight : insets.bottom;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isOpen) {
      progress.setValue(0);
      return undefined;
    }
    if (reducedMotion) {
      progress.setValue(1);
      return undefined;
    }
    const pop = entrance === 'pop';
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: pop ? 260 : motion.fadeMs,
      easing: pop ? EASE_POP : EASE_OUT,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [isOpen, progress, reducedMotion, entrance]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [entrance === 'pop' ? 0 : motion.cardOffsetY, 0] });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [entrance === 'pop' ? 0.95 : 1, 1] });

  return (
    <Modal transparent visible={isOpen} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {/* C10: the safe-area insets pad the scrim and come off the max height. */}
      <View
        style={[
          styles.scrim,
          wide ? styles.scrimWide : styles.scrimPhone,
          { paddingTop: (wide ? 24 : 16) + insets.top, paddingBottom: (wide ? 24 : 16) + bottomInset },
        ]}
      >
        <BlurLayer blurPx={8} overApp />
        <Pressable style={[styles.inset, styles.scrimColor]} onPress={onClose} accessibilityLabel="Close" />
        <Animated.View
          testID={testID}
          accessibilityViewIsModal
          accessibilityRole="none"
          accessibilityLabel={title}
          style={[
            styles.card,
            wide ? styles.cardWide : styles.cardPhone,
            // §A3.1 (dated note): also clear the safe-area top and bottom.
            { maxWidth: MAX_WIDTHS[size], maxHeight: height - (wide ? 64 : 48) - insets.top - bottomInset },
            { opacity: progress, transform: [{ translateY }, { scale }] },
          ]}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            overScrollMode="never"
            bounces={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text accessibilityRole="header" style={[styles.title, wide && styles.titleWide]}>
              {title}
            </Text>
            {description ? <Text style={[styles.description, wide && styles.descriptionWide, compact && styles.descriptionCompact]}>{description}</Text> : null}
            <View style={[styles.children, wide && styles.childrenWide]}>{children}</View>
          </ScrollView>
          {footer ? <View style={[styles.footer, wide && styles.footerWide]}>{footer}</View> : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

// Footer row of the plan modals: Cancel + action; column-reverse on phones.
export function ModalActions({ children }) {
  const { width } = useWindowDimensions();
  const wide = width >= breakpoints.sm;
  return <View style={wide ? styles.actionsWide : styles.actionsPhone}>{children}</View>;
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
  },
  scrimColor: {
    backgroundColor: colors.scrim,
  },
  scrimPhone: {
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  scrimWide: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  inset: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'transparent',
    boxShadow: shadows.modal,
    overflow: 'hidden',
    gap: 24,
  },
  cardPhone: {
    borderRadius: radii.xxl,
    padding: 24,
  },
  cardWide: {
    borderRadius: radii.xxxl,
    padding: 32,
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    gap: 16,
  },
  title: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: -0.6,
    color: colors.textPrimary,
  },
  titleWide: {
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.75,
  },
  description: {
    fontSize: 16,
    lineHeight: 26,
    color: colors.textSecondary,
  },
  descriptionWide: {
    fontSize: 18,
    lineHeight: 29,
  },
  // Design system v1: the workout dialogs' body is 14/24 at every width.
  descriptionCompact: {
    fontSize: 14,
    lineHeight: 24,
  },
  children: {
    gap: 12,
  },
  childrenWide: {
    gap: 16,
  },
  footer: {
    flexShrink: 0,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    paddingTop: 16,
  },
  footerWide: {
    paddingTop: 24,
  },
  actionsPhone: {
    flexDirection: 'column-reverse',
    gap: 12,
  },
  actionsWide: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
});
