import { createNavigationContainerRef } from '@react-navigation/native';

// Lets non-component code (e.g. re-authentication) read the current route.
export const navigationRef = createNavigationContainerRef();
