import { requireOptionalNativeModule } from 'expo-modules-core';

// O13 (RN-SPEC-time): the live rest countdown's native module. Null where it
// isn't linked (Jest, or a build made before it existed); the JS wrapper,
// src/shared/time/restCountdown.js, treats that as "not enabled".
export default requireOptionalNativeModule('RestCountdown');
