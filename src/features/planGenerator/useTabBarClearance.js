import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tabBarClearance } from './generatorLogic';

// How far a sticky footer must sit from the bottom edge: the tab bar's
// clearance below 768 wide (66 + 20 = 86; 0 at ≥768), plus the bottom safe area.
export function useTabBarClearance() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return tabBarClearance({ width, insetBottom: insets.bottom });
}
