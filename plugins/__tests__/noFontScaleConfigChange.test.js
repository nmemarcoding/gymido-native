// QA BUG-N3 (27 Oct): with fontScale in MainActivity configChanges the app
// kept its screen on a font-size change, but React Native did not re-lay out
// the mounted native text (2.0 text in 1.0 boxes, clipped everywhere, until a
// relaunch). The plugin is reverted: Android recreates the activity again
// (the app restarts on its first tab, the lesser bug). Re-adding it needs a
// proven relayout of every mounted surface first.
const fs = require('fs');
const path = require('path');

it('app.config does not declare fontScale config changes (BUG-N3)', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', '..', 'app.config.js'), 'utf8');
  expect(text).not.toMatch(/withFontScaleConfigChange/);
  expect(fs.existsSync(path.join(__dirname, '..', 'withFontScaleConfigChange.js'))).toBe(false);
});
