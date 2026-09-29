const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Guard on the REAL prebuild output. A free Apple Personal Team can sign
// neither an App Group nor push, and device signing has failed on exactly
// those twice: once from expo-notifications' aps-environment, once from a
// widget package's App Group. Config plugins write both implicitly, and plugin
// ORDER decides which entitlements mod wins, so only the generated files tell
// the truth. Also pins A2's Android permission.
//
// Runs `expo prebuild` for both platforms into a temporary copy of the repo
// (the working tree's ios/ and android/ are never touched). Slow by nature.

const ROOT = path.resolve(__dirname, '../..');
const SKIP = new Set(['node_modules', 'ios', 'android', '.git', '.expo']);

function copyRepo(target) {
  for (const entry of fs.readdirSync(ROOT)) {
    if (!SKIP.has(entry)) {
      fs.cpSync(path.join(ROOT, entry), path.join(target, entry), { recursive: true });
    }
  }
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(target, 'node_modules'), 'dir');
}

function findFiles(dir, predicate, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'Pods') {
      findFiles(full, predicate, found);
    } else if (entry.isFile() && predicate(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

describe('prebuild output (both platforms)', () => {
  let work;

  beforeAll(() => {
    work = fs.mkdtempSync(path.join(os.tmpdir(), 'gymido-prebuild-'));
    copyRepo(work);
    execFileSync(path.join(ROOT, 'node_modules', '.bin', 'expo'), ['prebuild', '--no-install'], {
      cwd: work,
      env: { ...process.env, CI: '1', APP_ENV: process.env.APP_ENV || 'development' },
      stdio: 'pipe',
    });
  }, 240000);

  afterAll(() => {
    if (work) {
      fs.rmSync(work, { recursive: true, force: true });
    }
  });

  it('no iOS target carries an App Group or push entitlement', () => {
    const entitlements = findFiles(path.join(work, 'ios'), (name) => name.endsWith('.entitlements'));
    expect(entitlements.length).toBeGreaterThan(0);
    for (const file of entitlements) {
      const content = fs.readFileSync(file, 'utf8');
      expect({ file: path.basename(file), groups: content.includes('application-groups') }).toEqual({
        file: path.basename(file),
        groups: false,
      });
      expect({ file: path.basename(file), push: content.includes('aps-environment') }).toEqual({
        file: path.basename(file),
        push: false,
      });
    }
    const project = fs.readFileSync(path.join(work, 'ios', 'Gymido.xcodeproj', 'project.pbxproj'), 'utf8');
    expect(project).not.toMatch(/application-groups|aps-environment/);
  });

  it('the rest countdown extension exists, with its own bundle ID and no entitlements file', () => {
    const project = fs.readFileSync(path.join(work, 'ios', 'Gymido.xcodeproj', 'project.pbxproj'), 'utf8');
    expect(project).toContain('PRODUCT_BUNDLE_IDENTIFIER = "com.gymido.app.RestCountdown"');
    expect(fs.existsSync(path.join(work, 'ios', 'RestCountdownWidget', 'RestCountdownWidget.swift'))).toBe(true);
    expect(fs.existsSync(path.join(work, 'ios', 'RestCountdownWidget', 'Assets.xcassets', 'Contents.json'))).toBe(true);
    expect(findFiles(path.join(work, 'ios', 'RestCountdownWidget'), (name) => name.endsWith('.entitlements'))).toEqual([]);
    const plist = fs.readFileSync(path.join(work, 'ios', 'Gymido', 'Info.plist'), 'utf8');
    expect(plist).toMatch(/<key>NSSupportsLiveActivities<\/key>\s*<true\/>/);
    expect(plist).not.toContain('remote-notification');
  });

  it('Android declares SCHEDULE_EXACT_ALARM (A2) and never USE_EXACT_ALARM', () => {
    const manifest = fs.readFileSync(path.join(work, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'), 'utf8');
    expect(manifest).toContain('android.permission.SCHEDULE_EXACT_ALARM');
    expect(manifest).not.toContain('android.permission.USE_EXACT_ALARM');
  });
});
