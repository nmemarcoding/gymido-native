const { withAndroidStyles } = require('expo/config-plugins');

// RN-SPEC-plans §2.4: light only. Android's generated AppTheme inherits from a
// DayNight theme, which lets OS dark mode recolor the app. Switch it to the
// light AppCompat parent and opt out of force-dark.
const LIGHT_PARENT = 'Theme.AppCompat.Light.NoActionBar';

module.exports = function withForcedLightTheme(config) {
  return withAndroidStyles(config, (mod) => {
    const styles = mod.modResults.resources.style ?? [];
    const appTheme = styles.find((style) => style.$.name === 'AppTheme');
    if (appTheme) {
      appTheme.$.parent = LIGHT_PARENT;
      appTheme.item = (appTheme.item ?? []).filter((item) => item.$.name !== 'android:forceDarkAllowed');
      appTheme.item.push({ $: { name: 'android:forceDarkAllowed' }, _: 'false' });
    }
    return mod;
  });
};
