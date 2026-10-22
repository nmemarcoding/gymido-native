import { createRef } from 'react';

// Android blurs only what is inside a BlurTargetView (expo-blur 57). The app
// root wraps its content in one; BlurLayers in Modal windows (overApp) blur it.
export const appBlurTargetRef = createRef();
