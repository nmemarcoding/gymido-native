import fs from 'fs';
import path from 'path';
import { StyleSheet } from 'react-native';

// `StyleSheet.absoluteFillObject` was removed from React Native. Spreading it
// spreads `undefined`, which is silently a no-op: no error, no warning, and the
// style simply loses `position: 'absolute'` and its insets. That shipped three
// real defects at once — the progress-ring label fell below the ring, the
// completion popup's check icon fell outside its ring, and the exercise sheet's
// tap-to-close backdrop had no size, so tapping outside the sheet did nothing.
//
// Nothing in the component tests could see it, because none of them assert on
// layout. So it is pinned here, at the source.

const SRC = path.join(__dirname, '..', '..');

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(full);
    }
    return /\.(js|jsx|ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [full] : [];
  });
}

describe('absolute fill styles', () => {
  it('StyleSheet.absoluteFillObject no longer exists in this React Native version', () => {
    // If this ever starts failing, React Native reintroduced it and the guard
    // below can be relaxed — but the replacement is still the right call.
    expect(StyleSheet.absoluteFillObject).toBeUndefined();
  });

  it('StyleSheet.absoluteFill is a spreadable object that actually positions', () => {
    expect({ ...StyleSheet.absoluteFill }).toEqual({
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    });
  });

  it('no source file spreads the removed absoluteFillObject', () => {
    const offenders = sourceFiles(SRC).filter((file) =>
      fs.readFileSync(file, 'utf8').includes('absoluteFillObject')
    );
    expect(offenders.map((file) => path.relative(SRC, file))).toEqual([]);
  });
});
