import { useNavigation } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';

// The web remounts a page every time it is shown; a native stack keeps it
// mounted. Bumping this key on each re-focus lets a screen remount its
// content, so it returns to its initial state and reloads.
export function useFocusRemountKey() {
  const navigation = useNavigation();
  const [key, setKey] = useState(0);
  const blurred = useRef(false);

  useEffect(() => {
    const offBlur = navigation.addListener('blur', () => {
      blurred.current = true;
    });
    const offFocus = navigation.addListener('focus', () => {
      if (blurred.current) {
        blurred.current = false;
        setKey((value) => value + 1);
      }
    });
    return () => {
      offBlur();
      offFocus();
    };
  }, [navigation]);

  return key;
}
