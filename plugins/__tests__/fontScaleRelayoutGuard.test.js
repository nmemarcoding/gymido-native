// QA BUG-N3 (27 Oct): with fontScale in MainActivity configChanges alone the
// app kept its screen on a font-size change, but React Native did not re-lay
// out the mounted native text (2.0 text in 1.0 boxes, clipped everywhere,
// until a relaunch). T-59 re-adds the plugin ONLY together with the remount
// at the new scale (src/shared/hooks/useFontScaleRemount.js), so neither half
// may ship without the other.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

it('the fontScale config change ships only with the remount at the new scale (BUG-N3)', () => {
  expect(read('app.config.js')).toMatch(/'\.\/plugins\/withFontScaleConfigChange'/);
  const app = read('src/App.js');
  expect(app).toMatch(/useFontScaleRemount\(navigationRef\)/);
  expect(app).toMatch(/<NavigationContainer key=\{navigation\.key\} ref=\{navigationRef\} initialState=\{navigation\.initialState\}>/);
});

// Reviewer (T-59): the toasts sit outside the navigation tree, so a toast on
// screen during a font change kept its old measurement. The host takes the
// same key (the toasts themselves live in toastStore and stay).
it('the ToastHost remounts with the screens on a font-scale change', () => {
  expect(read('src/App.js')).toMatch(/<ToastHost key=\{navigation\.key\} \/>/);
});
