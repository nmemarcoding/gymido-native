// QA runs the v2 flows from v2qa/native-run on guarded Release builds: every
// subflow a flow references must exist on the branch, and no v2 flow may
// depend on the dev-client link (they launch with launchApp, or start on an
// already open, signed-in tab root).
const fs = require('fs');
const path = require('path');

const V2 = path.join(__dirname, '..', 'maestro', 'v2');
function yamls(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return yamls(full);
    return entry.name.endsWith('.yaml') ? [full] : [];
  });
}
const FLOWS = yamls(V2);
const rel = (file) => path.relative(V2, file);

describe('v2 flows on the QA branch', () => {
  it('has the phase flows QA runs', () => {
    const dirs = new Set(FLOWS.map((file) => rel(file).split(path.sep)[0]));
    expect([...dirs].sort()).toEqual(expect.arrayContaining(['phase3', 'phase4', 'phase5', 'phase6', 'subflows', 't55', 't56']));
  });

  it.each(FLOWS.map(rel))('%s: every referenced subflow exists', (name) => {
    const file = path.join(V2, name);
    const refs = [...fs.readFileSync(file, 'utf8').matchAll(/(?:runFlow:\s*|file:\s*)([^\s{}$]+\.yaml)/g)].map((m) => m[1]);
    const missing = refs.filter((ref) => !fs.existsSync(path.resolve(path.dirname(file), ref)));
    expect(missing).toEqual([]);
  });

  it.each(FLOWS.map(rel))('%s: never opens the dev-client link', (name) => {
    expect(fs.readFileSync(path.join(V2, name), 'utf8')).not.toMatch(/expo-development-client|open-dev-client-link|launch-dev-client/);
  });
});

describe('trainer-workspace subflow works on phone AND tablet', () => {
  const flow = fs.readFileSync(path.join(V2, 'subflows', 'trainer-workspace.yaml'), 'utf8');
  it('accepts the rail (tablet) as well as the bottom tabs (phone)', () => {
    expect(flow).toMatch(/id: "tab-TToday\|rail-TToday"/);
    expect(flow).toMatch(/id: "rail-Today"/);
  });
});

describe('restore-workspace subflow works on phone AND tablet', () => {
  const flow = fs.readFileSync(path.join(V2, 'subflows', 'restore-workspace.yaml'), 'utf8');
  it('taps the rail Profile items on a tablet and waits for either nav', () => {
    expect(flow).toMatch(/id: "rail-Profile"/);
    expect(flow).toMatch(/id: "rail-TProfile"/);
    expect(flow).toMatch(/id: "tab-Today\|rail-Today"/);
    expect(flow).toMatch(/id: "tab-TToday\|rail-TToday"/);
  });
});

describe('dismiss-browser-interstitials waits for a late Chrome first-run screen', () => {
  const flow = fs.readFileSync(path.join(__dirname, '..', 'maestro', 'subflows', 'dismiss-browser-interstitials.yaml'), 'utf8');
  it('on Android, waits for the first-run screen OR the hosted page before the conditional taps', () => {
    const wait = flow.indexOf('Use without an account|No thanks|Got it|Continue with Google');
    expect(wait).toBeGreaterThan(-1);
    expect(wait).toBeLessThan(flow.indexOf('tapOn: "Use without an account"'));
  });
});

describe('login-form anchors work on small screens', () => {
  const read = (rel) => fs.readFileSync(path.join(__dirname, '..', 'maestro', rel), 'utf8');
  it.each(['subflows/wait-for-login-form.yaml', 'subflows/cancel-universal-login.yaml', '02-login-opens-universal-login.yaml', '01-welcome-no-auto-redirect.yaml', '06-sign-out.yaml'])(
    '%s anchors on "Continue with Google|Reset password" (the Google button can be below the fold)',
    (rel) => {
      expect(read(rel)).toContain('"Continue with Google|Reset password"');
      const steps = read(rel).split('\n').filter((line) => !line.trim().startsWith('#')).join('\n');
      expect(steps).not.toMatch(/"Continue with Google"/);
    },
  );
});

describe('phase4 flow fixes (QA s5-p4)', () => {
  const P4 = path.join(V2, 'phase4');
  const read = (name) => fs.readFileSync(path.join(P4, name), 'utf8');
  const steps = (src) => src.split('\n').filter((line) => !line.trim().startsWith('#')).join('\n');

  it('06 switches to the trainer workspace, opens the trainer Plans tab (phone + tablet) and restores', () => {
    const flow = steps(read('06-trainer-builder-sets-toggle.yaml'));
    expect(flow).toContain('runFlow: ../subflows/trainer-workspace.yaml');
    expect(flow).toMatch(/id: "tab-TPlans"/);
    expect(flow).toMatch(/id: "rail-TPlans"/);
    expect(flow).not.toMatch(/id: "tab-Plans"/);
    expect(flow.indexOf('trainer-workspace.yaml')).toBeLessThan(flow.indexOf('"tab-TPlans"'));
    expect(flow.trim().endsWith('runFlow: ../subflows/restore-workspace.yaml')).toBe(true);
  });

  it.each(['generator-questionnaire.yaml', 'generator-preview.yaml'])(
    '%s scrolls generator-next to the centre right before every tap on it',
    (name) => {
      const lines = steps(read(name)).split('\n');
      const taps = lines.map((line, i) => [line, i]).filter(([line, i]) => /^\s*- tapOn:\s*$/.test(line) && /id: "generator-next"/.test(lines[i + 1]));
      expect(taps.length).toBeGreaterThan(0);
      taps.forEach(([, i]) => {
        const before = lines.slice(Math.max(0, i - 6), i).join('\n');
        expect(before).toMatch(/scrollUntilVisible:\s*\n\s*element:\s*\n\s*id: "generator-next"\s*\n\s*direction: DOWN\s*\n\s*centerElement: true/);
      });
    },
  );

  it('open-first-my-plan stops (without failing) on the on-hold state', () => {
    const flow = steps(read('subflows/open-first-my-plan.yaml'));
    expect(flow).toContain('id: "my-plan-card-open-.*|my-plans-on-hold"');
    expect(flow).toMatch(/notVisible:\s*\n\s*id: "my-plans-on-hold"[\s\S]*id: "my-plan-card-open-\.\*"/);
  });

  it.each(['01-member-builder-layout.yaml', '02-member-overflow-edit-details.yaml', '03-member-set-editor-validation.yaml', '04-member-delete-day-cancel.yaml', '05-member-make-a-copy.yaml'])(
    '%s skips silently when My plans is on hold, and says which account it needs',
    (name) => {
      const src = read(name);
      expect(src).toMatch(/member WITHOUT a trainer who OWNS a plan/);
      const body = steps(src).split('---\n')[1].trim().split('\n');
      expect(body[0]).toBe('- runFlow: subflows/open-first-my-plan.yaml');
      expect(body.slice(1, 6).join('\n')).toBe('- runFlow:\n    when:\n      notVisible:\n        id: "my-plans-on-hold"\n    commands:');
      // Every remaining step sits inside that conditional block.
      body.slice(6).forEach((line) => expect(line === '' || line.startsWith('      ')).toBe(true));
    },
  );
});

// QA LOW (2.0.5 regression, 28 Oct 2026): since T-65 an earlier flow can end
// on an inner page with no tab bar; these entries start from signed-in-start
// (a Release build relaunches onto the main page) before waiting for tabs.
describe('flows that waited for a tab bar start from signed-in-start', () => {
  const steps = (src) => src.split('\n').filter((line) => !line.trim().startsWith('#')).join('\n');
  const body = (rel) => steps(fs.readFileSync(path.join(V2, rel), 'utf8')).split('---\n')[1].trim().split('\n');
  it.each([
    ['phase3/02-workout-hub.yaml', '- runFlow: ../subflows/signed-in-start.yaml'],
    ['phase4/06-trainer-builder-sets-toggle.yaml', '- runFlow: ../subflows/signed-in-start.yaml'],
    ['phase4/subflows/open-first-my-plan.yaml', '- runFlow: ../../subflows/signed-in-start.yaml'],
  ])('%s: the first step', (rel, first) => {
    expect(body(rel)[0]).toBe(first);
    expect(fs.existsSync(path.join(V2, path.dirname(rel), first.replace('- runFlow: ', '')))).toBe(true);
  });
});

// QA LOWs (2.0.5 regression, Android + tablets): 04-progress opens Progress on
// the tablet rail too; c5 waits for the minimised disc instead of asserting it
// the instant the board closes (a flake).
describe('QA 2.0.5 flow LOWs', () => {
  const steps = (src) => src.split('\n').filter((line) => !line.trim().startsWith('#')).join('\n');
  const flow = (rel) => steps(fs.readFileSync(path.join(V2, rel), 'utf8'));
  it('04-progress taps tab-Progress (phone) or rail-Progress (tablet), each when visible', () => {
    const text = flow('phase3/04-progress.yaml');
    ['tab-Progress', 'rail-Progress'].forEach((id) => {
      expect(text).toMatch(new RegExp(`when:\\n\\s+visible:\\n\\s+id: "${id}"\\n\\s+commands:\\n\\s+- tapOn:\\n\\s+id: "${id}"`));
    });
    expect(text).not.toMatch(/^- tapOn:\n\s+id: "tab-Progress"/m);
  });
  it('c5 never asserts rest-timer at once; it waits for it (5 s)', () => {
    const text = flow('phase3/c5-android-back-rest.yaml');
    expect(text).not.toMatch(/- assertVisible:\n\s+id: "rest-timer"\n/);
    expect(text.match(/- extendedWaitUntil:\n\s+visible:\n\s+id: "rest-timer"\n\s+timeout: 5000/g)).toHaveLength(2);
  });
});

// 2.0.7 device check: targets below the fold (My plans under an active plan's
// card; the hub's day starts under "Week complete" at 360 dp) are scrolled to.
describe('2.0.7 flow waits scroll to below-the-fold targets', () => {
  const steps = (src) => src.split('\n').filter((line) => !line.trim().startsWith('#')).join('\n');
  const flow = (rel) => steps(fs.readFileSync(path.join(V2, rel), 'utf8'));
  it.each([
    ['phase4/subflows/open-first-my-plan.yaml', 'my-plans-entry'],
    ['subflows/start-workout.yaml', 'workout-hero-start|workout-day-start-.*|session-chrome|workout-error|workout-empty|schedule-setup'],
  ])('%s: scrollUntilVisible DOWN to %s, no bare wait for it', (rel, id) => {
    const text = flow(rel);
    const quoted = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    expect(text).toMatch(new RegExp(`- scrollUntilVisible:\\n\\s+element:\\n\\s+id: "${quoted}"\\n\\s+direction: DOWN\\n\\s+centerElement: true`));
    expect(text).not.toMatch(new RegExp(`- extendedWaitUntil:\\n\\s+visible:\\n\\s+id: "${quoted}"\\n`));
  });
});

describe('open-first-my-plan works on phone AND tablet', () => {
  const flow = fs.readFileSync(path.join(V2, 'phase4', 'subflows', 'open-first-my-plan.yaml'), 'utf8');
  it('opens Plans from the bottom tab or the rail', () => {
    expect(flow).toMatch(/id: "tab-Plans\|rail-Plans"/);
    expect(flow).toMatch(/id: "rail-Plans"/);
  });
});

// PM rule (28 Oct): a flow whose account doesn't meet its precondition FAILS
// FAST with a clear message — a silent skip reports a false PASS.
describe('preconditions fail fast, never a silent skip', () => {
  const read = (rel) => fs.readFileSync(path.join(V2, rel), 'utf8');
  it.each([
    ['phase4/subflows/open-first-my-plan.yaml', /visible:\n\s+id: "my-plans-on-hold"\n\s+commands:\n\s+- assertTrue:\n\s+condition: \$\{false\}\n\s+label: "Precondition: needs a member WITHOUT a trainer who owns a plan/],
    ['phase5/l4-end-coaching-dialog.yaml', /notVisible:\n\s+id: "trainer-hub-end"\n\s+commands:\n\s+- assertTrue:\n\s+condition: \$\{false\}\n\s+label: "Precondition: needs a member WITH an active trainer/],
  ])('%s fails with its precondition message', (rel, pattern) => {
    expect(read(rel)).toMatch(pattern);
  });
});

describe('generator-preview reaches the Review and checks it opens at the top (G1.3)', () => {
  const flow = fs.readFileSync(path.join(V2, 'phase4', 'generator-preview.yaml'), 'utf8');
  it('taps Next six times (steps 1→6, then the Review) and asserts the title with no scroll', () => {
    expect(flow).toMatch(/- repeat:\n\s+times: 6/);
    const afterLoop = flow.slice(flow.indexOf('times: 6'));
    const title = afterLoop.indexOf('id: "generator-review-title"');
    expect(title).toBeGreaterThan(-1);
    expect(afterLoop.slice(0, title)).not.toMatch(/direction: UP/);
  });
});

describe('h1-h3 open Plans on phone AND tablet (QA T-60 flow defect)', () => {
  it.each(['h1-plans-to-plan-detail.yaml', 'h2-plans-to-my-plans.yaml', 'h3-active-plan-detail.yaml'])('%s taps the rail too', (name) => {
    const flow = fs.readFileSync(path.join(V2, 'phase4', name), 'utf8');
    expect(flow).toMatch(/id: "rail-Plans"/);
    expect(flow).not.toMatch(/^- tapOn:\n {4}id: "tab-Plans"/m);
  });
});

// QA candidate-9643e9c flow defects (PM-approved updates; each changed step
// is declared in the commit and is equal or stricter).
describe('QA candidate-9643e9c flow defects', () => {
  const read = (rel) => fs.readFileSync(path.join(V2, rel), 'utf8');
  const steps = (src) => src.split('\n').filter((line) => !line.trim().startsWith('#')).join('\n');

  it('03-exercises asserts the T-62 filter (button + sheet on a phone, the panel at ≥ 1024), not the removed chips', () => {
    const flow = steps(read('phase3/03-exercises.yaml'));
    expect(flow).not.toMatch(/exercises-chips|exercises-chip-all|muscle-sheet/);
    expect(flow).toMatch(/id: "exercises-filter\|exercises-filter-panel"/);
    expect(flow).toMatch(/visible:\n\s+id: "exercises-filter"\n\s+commands:[\s\S]*id: "exercise-filter-sheet"[\s\S]*id: "exercise-filter-section-muscle"[\s\S]*id: "app-modal-close"[\s\S]*notVisible:\n\s+id: "exercise-filter-sheet"/);
    expect(flow).toMatch(/visible:\n\s+id: "exercises-filter-panel"\n\s+commands:[\s\S]*id: "exercise-filter-section-muscle"/);
    expect(flow).toMatch(/id: "exercises-result-count"/);
  });

  // DECLARED (final batch, 27 Oct 2026, reviewer carry): was "anchors Plans on the tiles (tablet) OR the own
  // rows (T-60 phone)" (id "plans-entry-tiles|plans-own"). The T-60 tablet has the own rows too and no screen
  // draws plans-entry-tiles any more, so the anchor is "plans-own" alone.
  it.each(['h1-plans-to-plan-detail.yaml', 'h2-plans-to-my-plans.yaml', 'h3-active-plan-detail.yaml'])(
    '%s anchors Plans on the own rows (phone and T-60 tablet), never the removed tiles',
    (name) => {
      const flow = steps(read(`phase4/${name}`));
      expect(flow).toMatch(/id: "plans-own"\n/);
      expect(flow).not.toMatch(/plans-entry-tiles/);
    },
  );

  // DECLARED (final batch, 27 Oct 2026, reviewer carry): was "on the tablet card (View plan) AND the phone card
  // (See full plan)". The tablet card's View plan / Go to workout are gone (T-60: one card, Start + See full
  // plan), so the dead plans-view-active branch is dropped.
  it('h3 opens the active plan by See full plan (one card on phone and tablet), never the removed View plan', () => {
    const flow = steps(read('phase4/h3-active-plan-detail.yaml'));
    expect(flow).not.toMatch(/plans-view-active|plans-go-to-workout/);
    expect(flow).toMatch(/visible:\n\s+id: "plans-see-full-plan"\n\s+commands:\n\s+- assertVisible:\n\s+id: "plans-start"\n\s+- tapOn:\n\s+id: "plans-see-full-plan"/);
    expect(flow).toMatch(/id: "plan-detail-current"/);
  });

  it('h2 scrolls My plans into view and lets the scroll settle before the tap', () => {
    const flow = steps(read('phase4/h2-plans-to-my-plans.yaml'));
    expect(flow).toMatch(/scrollUntilVisible:\n\s+element:\n\s+id: "my-plans-entry"\n\s+direction: DOWN\n\s+centerElement: true[^\n]*\n[^\n]*\n- waitForAnimationToEnd[^\n]*\n(?:\s+timeout: \d+\n)?- tapOn:\n\s+id: "my-plans-entry"/);
  });

  it.each(['phase5/k4-delete-account-cancel.yaml', 'phase6/6n-02-clients-search-filter.yaml', 'phase6/6o-02-trainer-plan-create-form.yaml'])(
    '%s never uses hideKeyboard (Android: Back closes the dialog; iOS: taps the screen)',
    (rel) => {
      expect(steps(read(rel))).not.toMatch(/hideKeyboard/);
    },
  );

  it('k4 asserts Cancel is on screen with the keyboard up, then taps it', () => {
    expect(steps(read('phase5/k4-delete-account-cancel.yaml'))).toMatch(/- assertVisible:\n\s+id: "delete-account-cancel"\n- tapOn:\n\s+id: "delete-account-cancel"/);
  });

  it.each(['phase3/02-workout-hub.yaml', 'subflows/start-workout.yaml'])('%s scrolls Today back to the top before it looks for the primary button', (rel) => {
    const flow = steps(read(rel));
    const tab = flow.indexOf('id: "tab-Today"');
    const reset = flow.search(/scrollUntilVisible:\n\s+element:\n\s+id: "home-today-primary\|home-empty-hero\|home-error"\n\s+direction: UP/);
    expect(tab).toBeGreaterThan(-1);
    expect(reset).toBeGreaterThan(tab);
    expect(reset).toBeLessThan(flow.indexOf('tapOn:\n    id: "home-today-primary"'));
  });

  it('06-sign-out opens Profile from the rail on a tablet as well as the tab bar', () => {
    const flow = steps(fs.readFileSync(path.join(__dirname, '..', 'maestro', '06-sign-out.yaml'), 'utf8'));
    expect(flow).toMatch(/visible:\n\s+id: "rail-TProfile"\n\s+commands:\n\s+- tapOn:\n\s+id: "rail-TProfile"/);
    expect(flow).toMatch(/visible:\n\s+id: "rail-Profile"\n\s+commands:\n\s+- tapOn:\n\s+id: "rail-Profile"/);
    expect(flow).toMatch(/id: "tab-Profile\|rail-Profile"/);
    expect(flow).not.toMatch(/^- tapOn:\n {4}id: "tab-Profile"/m);
  });
});

// QA candidate-9643e9c "Automate:" (the parts that are Maestro flows).
describe('QA candidate-9643e9c automate list', () => {
  const read = (rel) => fs.readFileSync(path.join(V2, rel), 'utf8');
  const steps = (src) => src.split('\n').filter((line) => !line.trim().startsWith('#')).join('\n');
  const NO_EMAIL = /- assertNotVisible: "\.\*@\.\*"/g;

  it('l1: no email ("@") on the trainers list or the trainer detail a member sees', () => {
    const flow = steps(read('phase5/l1-find-trainer-detail.yaml'));
    expect(flow.match(NO_EMAIL)).toHaveLength(2);
    const list = flow.indexOf('id: "trainers-card-.*"\n    timeout');
    const detail = flow.indexOf('id: "trainer-detail-card"\n    timeout');
    const checks = [...flow.matchAll(NO_EMAIL)].map((m) => m.index);
    expect(checks[0]).toBeGreaterThan(list);
    expect(checks[0]).toBeLessThan(flow.indexOf('tapOn:\n    id: "trainers-card-.*"'));
    expect(checks[1]).toBeGreaterThan(detail);
  });

  it('l4: no email ("@") on the coaching hub with an active trainer', () => {
    const flow = steps(read('phase5/l4-end-coaching-dialog.yaml'));
    expect(flow.match(NO_EMAIL)).toHaveLength(1);
  });

  it('03-exercises: a find text with no match shows exercise-filter-no-match, in the sheet AND the panel', () => {
    const flow = steps(read('phase3/03-exercises.yaml'));
    const block = /- tapOn:\n\s+id: "exercise-filter-find"\n\s+- inputText: "zzqq"\n\s+- extendedWaitUntil:\n\s+visible:\n\s+id: "exercise-filter-no-match"/g;
    expect(flow.match(block)).toHaveLength(2);
  });
});

// Flow run on ea27f77 (Android 360 phone + 1280 tablet, 27 Oct): the tablet
// has the rail (rail-*), no tab bar, so these flows failed at their first
// tab tap; h1-h3 never scrolled to the entry block under an active plan card
// on the phone; h1 asserted plan-activate below the fold on the tablet.
describe('flow run ea27f77 fixes', () => {
  const read = (rel) => fs.readFileSync(path.join(V2, rel), 'utf8');
  const steps = (src) => src.split('\n').filter((line) => !line.trim().startsWith('#')).join('\n');

  it.each([
    'phase3/01-today.yaml',
    'phase3/02-workout-hub.yaml',
    'phase3/03-exercises.yaml',
    'subflows/start-workout.yaml',
    'phase5/k-subflows/open-profile.yaml',
    'phase5/l1-find-trainer-detail.yaml',
    'phase5/l4-end-coaching-dialog.yaml',
  ])('%s: every tab tap has its rail twin, both conditional (phone AND tablet)', (rel) => {
    const flow = steps(read(rel));
    expect(flow).not.toMatch(/^- tapOn:\n {4}id: "tab-/m);
    const tabs = [...flow.matchAll(/tapOn:\n\s+id: "tab-(\w+)"/g)].map((m) => m[1]);
    expect(tabs.length).toBeGreaterThan(0);
    tabs.forEach((name) => {
      expect(flow).toMatch(new RegExp(`visible:\\n\\s+id: "tab-${name}"\\n\\s+commands:\\n\\s+- tapOn:\\n\\s+id: "tab-${name}"`));
      expect(flow).toMatch(new RegExp(`visible:\\n\\s+id: "rail-${name}"\\n\\s+commands:\\n\\s+- tapOn:\\n\\s+id: "rail-${name}"`));
    });
    // Waits for a tab accept the rail too.
    expect(flow).not.toMatch(/visible:\n\s+id: "tab-\w+"\n\s+timeout/);
  });

  it.each(['h1-plans-to-plan-detail.yaml', 'h2-plans-to-my-plans.yaml', 'h3-active-plan-detail.yaml'])(
    '%s scrolls DOWN to the entry block (it can sit under the active plan card) and checks the return by the screen id',
    (name) => {
      const flow = steps(read(`phase4/${name}`));
      expect(flow).toMatch(/id: "plans-library-screen"/);
      // DECLARED (final batch, 27 Oct 2026): the id was "plans-entry-tiles|plans-own"; now "plans-own".
      expect(flow).toMatch(/scrollUntilVisible:\n\s+element:\n\s+id: "plans-own"\n\s+direction: DOWN/);
      expect(flow).not.toMatch(/extendedWaitUntil:\n\s+visible:\n\s+id: "plans-own"/);
    },
  );

  it('h1 scrolls plan-activate into view before asserting it', () => {
    const flow = steps(read('phase4/h1-plans-to-plan-detail.yaml'));
    expect(flow).toMatch(/scrollUntilVisible:\n\s+element:\n\s+id: "plan-activate"\n\s+direction: DOWN\n\s+centerElement: true[^\n]*\n[^\n]*\n- assertVisible:\n\s+id: "plan-activate"/);
  });
});

// T-65 (PM): the phone tab bar shows only on main pages, so a flow that ends
// on an inner page must not break the next one. The suite entry resets to the
// role's main page first (a Release build cold-starts on it), then waits for
// a main-page anchor, never the bottom nav alone (tablets have the rail).
describe('signed-in-start resets to a main page (T-65)', () => {
  const flow = fs
    .readFileSync(path.join(V2, 'subflows', 'signed-in-start.yaml'), 'utf8')
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');

  it('a Release build relaunches (stopApp: true) before the first wait', () => {
    const relaunch = flow.search(/when:\n\s+true: \$\{MAESTRO_GYMIDO_RELEASE == 'true'\}\n\s+commands:\n\s+- launchApp:\n\s+stopApp: true/);
    expect(relaunch).toBeGreaterThan(-1);
    expect(relaunch).toBeLessThan(flow.indexOf('extendedWaitUntil'));
  });

  it('waits for a main-page anchor on phone OR tablet, not the bottom nav alone', () => {
    expect(flow).toMatch(/extendedWaitUntil:\n\s+visible:\n\s+id: "bottom-nav\|rail-Today\|rail-TToday\|session-chrome"/);
    expect(flow).not.toMatch(/id: "bottom-nav\|session-chrome"/);
  });

  it('still refuses an active session, incl. Today\'s "Resume workout" after a relaunch', () => {
    expect(flow).toMatch(/visible:\n\s+id: "session-chrome"\n\s+commands:\n\s+- assertTrue:\n\s+condition: \$\{false\}/);
    expect(flow).toMatch(/visible: "Resume workout"\n\s+commands:\n\s+- assertTrue:\n\s+condition: \$\{false\}/);
  });
});

// Final pass 5f53f3d (PM 28 Oct 2026): F1 discard ends on the Workout hub
// (T-65: no tab bar there; declared, was bottom-nav); F2 / E1 add optional,
// when-visible dismisses only, no assertion changes.
describe('final pass 5f53f3d flow fixes', () => {
  const steps = (file) =>
    fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .filter((line) => !line.trim().startsWith('#'))
      .join('\n');

  it('F1: discard-workout ends on the Workout hub header, not the tab bar or an either/or', () => {
    const flow = steps(path.join(V2, 'subflows', 'discard-workout.yaml'));
    expect(flow.trim().endsWith('extendedWaitUntil:\n    visible:\n      id: "workout-hub-header"\n    timeout: 30000')).toBe(true);
    expect(flow).not.toMatch(/bottom-nav/);
    expect(flow).not.toMatch(/id: "[^"]*\|[^"]*"\n\s+timeout: 30000\s*$/);
  });

  it('F2: 06-sign-out dismisses Chrome first-run only when visible (Android), before the unchanged Welcome wait', () => {
    const flow = steps(path.join(V2, '..', '06-sign-out.yaml'));
    const dismiss = flow.indexOf('tapOn: "Use without an account"');
    expect(dismiss).toBeGreaterThan(-1);
    expect(flow).toMatch(/visible: "Use without an account"\n\s+timeout: 8000\n\s+optional: true/);
    expect(dismiss).toBeLessThan(flow.indexOf('id: "welcome-log-in"'));
    expect(flow).toMatch(/extendedWaitUntil:\n\s+visible:\n\s+id: "welcome-log-in"\n\s+timeout: 60000\n- assertNotVisible: "Continue with Google\|Reset password"/);
  });

  it('E1: start-workout declines the notifications prompt only when visible, before the unchanged session wait', () => {
    const flow = steps(path.join(V2, 'subflows', 'start-workout.yaml'));
    // DECLARED (T-69 batch, carry 4): timeout 6000 → 3000 (the prompt is asked at the Start tap).
    const prompt = flow.indexOf('visible: ".*[Ss]end [Yy]ou [Nn]otifications.*"\n    timeout: 3000\n    optional: true');
    expect(prompt).toBeGreaterThan(-1);
    expect(flow).toMatch(/when:\n\s+visible: "\.\*\[Ss\]end \[Yy\]ou \[Nn\]otifications\.\*"\n\s+commands:\n\s+- tapOn: "Don\.t \[Aa\]llow"/);
    expect(prompt).toBeLessThan(flow.indexOf('id: "session-chrome"\n    timeout: 30000'));
    expect(flow.trim().endsWith('- assertNotVisible:\n    id: "bottom-nav"')).toBe(true);
  });
});

describe('QA candidate 2941880 flow fixes', () => {
  const steps = (name) =>
    fs
      .readFileSync(path.join(V2, name), 'utf8')
      .split('\n')
      .filter((line) => !line.trim().startsWith('#'))
      .join('\n');
  const body = (name) => steps(name).split('\n---\n')[1];

  it.each([
    ['phase3/04-progress.yaml', '../subflows/signed-in-start.yaml'],
    ['phase4/h1-plans-to-plan-detail.yaml', '../subflows/signed-in-start.yaml'],
    ['phase4/h2-plans-to-my-plans.yaml', '../subflows/signed-in-start.yaml'],
    ['phase4/h3-active-plan-detail.yaml', '../subflows/signed-in-start.yaml'],
    ['phase5/k-subflows/open-profile.yaml', '../../subflows/signed-in-start.yaml'],
    ['phase5/l2-trainer-apply.yaml', '../subflows/signed-in-start.yaml'],
    ['phase5/l4-end-coaching-dialog.yaml', '../subflows/signed-in-start.yaml'],
  ])('%s starts with signed-in-start (a main page)', (name, ref) => {
    expect(body(name).startsWith(`- runFlow: ${ref}\n`)).toBe(true);
  });

  it.each(['k1-profile-root', 'k2-edit-profile-cancel', 'k3-reset-password-cancel', 'k4-delete-account-cancel', 'k5-profile-links'])('phase5/%s opens Profile through open-profile first', (name) => {
    expect(body(`phase5/${name}.yaml`).startsWith('- runFlow: k-subflows/open-profile.yaml\n')).toBe(true);
  });

  // DECLARED (640 dp confirm, 28 Oct 2026): was "the hint, the goal unchecked"; the fresh questionnaire is
  // seeded from the saved generator profile, so the goal stays chosen. Step 1 = its goal rows + the hint (scrolled to).
  it('generator-preview: after the preview back, a FRESH Step 1 (its goal rows, then the Step 1 hint), not the review', () => {
    const flow = steps('phase4/generator-preview.yaml');
    const after = flow.slice(flow.indexOf('id: "generator-preview-back"'));
    expect(after).not.toMatch(/generator-review-1/);
    expect(after).not.toMatch(/checked: false/);
    expect(flow).toMatch(/- tapOn:\n\s+id: "generator-preview-back"\n\s+- extendedWaitUntil:\n\s+visible:\n\s+id: "generator-goal-BUILD_MUSCLE"\n\s+timeout: 15000\n\s+- scrollUntilVisible:\n\s+element:\n\s+id: "generator-step1-hint"\n\s+direction: DOWN\n\s+timeout: 15000\n/);
  });

  it('member-workspace asserts per form factor: tab-Today on phone, rail-Today on tablet, never an either/or', () => {
    const flow = steps('subflows/member-workspace.yaml');
    const [phone, tablet] = flow.split('\n- runFlow:\n').slice(1);
    expect(phone).toMatch(/^\s+when:\n\s+notVisible:\n\s+id: "tablet-rail"\n/);
    expect(phone).toMatch(/id: "tab-Today"\n\s+timeout: 10000\s*$/);
    expect(phone).not.toMatch(/rail-/);
    expect(tablet).toMatch(/^\s+when:\n\s+visible:\n\s+id: "tablet-rail"\n/);
    expect(tablet).toMatch(/id: "rail-Today"\n\s+timeout: 10000\s*$/);
    expect(tablet).not.toMatch(/tab-/);
    expect(flow).not.toMatch(/id: "[^"]*\|[^"]*"/);
  });

  it('6o-02: on iOS a Return tap closes the keyboard after inputText, before the scroll to the docked submit', () => {
    const flow = steps('phase6/6o-02-trainer-plan-create-form.yaml');
    expect(flow).toMatch(/- inputText: "QA Draft"\n- runFlow:\n\s+when:\n\s+platform: iOS\n\s+commands:\n\s+- pressKey: Enter\n- scrollUntilVisible:\n\s+element:\n\s+id: "create-plan-submit"/);
  });

  it('640 dp phone: 03b scrolls the reps stepper into view before the tap; on any end it discards its own open session', () => {
    const raw = steps('phase3/03b-workout-session.yaml');
    expect(body('phase3/03b-workout-session.yaml')).toMatch(/- scrollUntilVisible:\n\s+element:\n\s+id: "set-reps-plus-\.\*"\n\s+direction: DOWN\n\s+centerElement: true\n\s+timeout: 10000\n- tapOn:\n\s+id: "set-reps-plus-\.\*"/);
    const hook = raw.slice(raw.indexOf('onFlowComplete:'), raw.indexOf('\n---\n'));
    expect(hook.indexOf('- runFlow: ../subflows/dismiss-session-dialogs.yaml')).toBeGreaterThan(-1);
    expect(hook.indexOf('- runFlow: ../subflows/dismiss-session-dialogs.yaml')).toBeLessThan(hook.indexOf('id: "session-chrome"'));
    expect(hook).toMatch(/when:\n\s+visible:\n\s+id: "session-chrome"\n\s+commands:\n\s+- runFlow: \.\.\/subflows\/discard-workout\.yaml/);
    // DECLARED (T-69 batch, carry 1): was "the body ends with discard-workout"; it now discards, then
    // restores the workspace (03b switches a trainer to Personal through member-workspace).
    expect(body('phase3/03b-workout-session.yaml')).toMatch(/- runFlow: \.\.\/subflows\/discard-workout\.yaml\n[\s\S]*- runFlow: \.\.\/subflows\/restore-workspace\.yaml\s*$/);
  });

  it('640 dp phone: generator-preview scrolls to Day 1 before asserting it, then back UP to the preview back', () => {
    const flow = steps('phase4/generator-preview.yaml');
    expect(flow).toMatch(/- scrollUntilVisible:\n\s+element:\n\s+id: "generator-day-1"\n\s+direction: DOWN\n\s+centerElement: true\n\s+timeout: 15000\n\s+- assertVisible:\n\s+id: "generator-day-1"/);
    expect(flow).toMatch(/- scrollUntilVisible:\n\s+element:\n\s+id: "generator-preview-back"\n\s+direction: UP\n\s+timeout: 15000\n\s+- tapOn:\n\s+id: "generator-preview-back"/);
  });

  it('6o-03: asserts the hero heading "Trainer profile", not the a11y-hidden avatar', () => {
    const flow = steps('phase6/6o-03-trainer-profile.yaml');
    expect(flow).not.toMatch(/trainer-profile-avatar/);
    expect(flow).toMatch(/id: "trainer-profile-eyebrow"\n- assertVisible:\n\s+text: "Trainer profile"\n/);
  });
});

// T-76 Workout hub redesign (28 Oct 2026): the retired hero's badge/detail ids
// are gone; the flows use ids the new hub renders in every state with a plan.
describe('T-76 hub flow ids', () => {
  const read = (rel) => fs.readFileSync(path.join(V2, rel), 'utf8');
  const steps = (src) => src.split('\n').filter((line) => !line.trim().startsWith('#')).join('\n');
  const hubSource = ['src/features/workout/screens/WorkoutScreen.js', 'src/features/workout/components/hub/HubTodayCard.js', 'src/features/workout/components/hub/HubDayRows.js']
    .map((rel) => fs.readFileSync(path.join(__dirname, '../..', rel), 'utf8'))
    .join('\n');

  it('02-workout-hub asserts the plan name and Other days, never the retired badge/detail', () => {
    const flow = steps(read('phase3/02-workout-hub.yaml'));
    expect(flow).not.toMatch(/workout-hero-(badge|detail)/);
    expect(flow).toMatch(/id: "workout-plan-name"/);
    expect(flow).toMatch(/id: "workout-other-days"/);
  });

  it('every hub id the flows use is rendered by the new hub', () => {
    ['workout-hero', 'workout-hero-start', 'workout-plan-name', 'workout-other-days', 'workout-hub-header', 'workout-back-today', 'workout-title'].forEach((id) =>
      expect(hubSource).toContain(`"${id}"`)
    );
    expect(hubSource).toContain('`workout-day-start-${row.dayId}`');
    expect(steps(read('subflows/start-workout.yaml'))).toMatch(/id: "workout-day-start-\.\*"/);
  });
});

// T-80 (28 Oct 2026): starting a non-today day from the hub asks first; the subflow confirms it.
describe('T-80 start-workout confirms a non-today day', () => {
  const steps = (src) => src.split('\n').filter((line) => !line.trim().startsWith('#')).join('\n');
  it('after tapping a day row it waits for and taps the confirm\'s "Start workout"', () => {
    const flow = steps(fs.readFileSync(path.join(V2, 'subflows/start-workout.yaml'), 'utf8'));
    const row = flow.indexOf('id: "workout-day-start-.*"\n          index: 0');
    const confirm = flow.indexOf('tapOn:\n          id: "workout-start-confirm-confirm"');
    expect(row).toBeGreaterThan(-1);
    expect(confirm).toBeGreaterThan(row);
    // Today's own Start stays one tap: no confirm step in the hero branch.
    const hero = flow.slice(flow.indexOf('id: "workout-hero-start"\n'), row);
    expect(hero).not.toMatch(/workout-start-confirm/);
  });
});

// T-78 (28 Oct 2026): the make-a-copy flow names the copy BEFORE it exists.
describe('T-78 member make-a-copy flow', () => {
  const steps = (src) => src.split('\n').filter((line) => !line.trim().startsWith('#')).join('\n');
  it('cancels "Name your copy" once, then saves; never waits for the retired auto-opened Edit details', () => {
    const flow = steps(fs.readFileSync(path.join(V2, 'phase4/05-member-make-a-copy.yaml'), 'utf8'));
    const cancel = flow.indexOf('id: "copy-plan-cancel"');
    const save = flow.indexOf('id: "copy-plan-save"');
    expect(cancel).toBeGreaterThan(-1);
    expect(save).toBeGreaterThan(cancel);
    expect(flow).not.toMatch(/visible:\n\s+id: "edit-plan-modal"\n\s+timeout/);
    expect(flow).not.toMatch(/id: "edit-plan-cancel"/);
  });
});

// T-69 batch (PM 28 Oct 2026; QA candidate-dfd9b85, confirm dfd9b85 640 dp
// re-runs, T-82 device check): short-screen stepper taps, exact set taps, the
// session dialogs before a set tap, the Rest minimised before Exit, 03b's
// workspace restore, ensure-signed-out on a tablet and the optional waits.
describe('T-69 batch flow fixes', () => {
  const ROOT = path.join(__dirname, '..', '..');
  const read = (rel) => fs.readFileSync(path.join(V2, rel), 'utf8');
  const steps = (src) => src.split('\n').filter((line) => !line.trim().startsWith('#')).join('\n');
  const body = (rel) => steps(read(rel)).split('\n---\n')[1];
  const hook = (rel) => {
    const raw = steps(read(rel));
    return raw.slice(raw.indexOf('onFlowComplete:'), raw.indexOf('\n---\n'));
  };
  const src = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
  // Every `<command>:` block of a flow: its own selector lines only (deeper
  // indented, up to the next list item), joined.
  const blocks = (text, command) => {
    const lines = text.split('\n');
    const out = [];
    lines.forEach((line, i) => {
      const head = line.match(new RegExp(`^(\\s*)- ${command}:\\s*$`));
      if (!head) return;
      const own = [];
      for (let j = i + 1; j < lines.length; j += 1) {
        const indent = lines[j].match(/^\s*/)[0].length;
        if (indent <= head[1].length || /^\s*- /.test(lines[j])) break;
        own.push(lines[j]);
      }
      out.push(own.join('\n'));
    });
    return out;
  };
  const taps = (text) => blocks(text, 'tapOn');
  const LOGGERS = ['phase3/c1-rest-screen.yaml', 'phase3/c3-browsing-lock.yaml', 'phase3/c5-android-back-rest.yaml'];

  describe('item 1 (T-69): 03b on a 640 dp phone', () => {
    const flow = body('phase3/03b-workout-session.yaml');

    it('centres the CURRENT set\'s weight + (the live editor) before its tap, then the reps stepper', () => {
      expect(flow).toMatch(
        /- scrollUntilVisible:\n\s+element:\n\s+id: "set-weight-plus-\.\*"\n\s+childOf:\n\s+id: "set-editor"\n\s+direction: DOWN\n\s+centerElement: true\n\s+timeout: 10000\n- tapOn:\n\s+id: "set-weight-plus-\.\*"\n\s+childOf:\n\s+id: "set-editor"\n- scrollUntilVisible:\n\s+element:\n\s+id: "set-reps-plus-\.\*"/
      );
      // No stepper is tapped without its scroll first.
      expect(flow.indexOf('scrollUntilVisible:\n    element:\n      id: "set-weight-plus-.*"')).toBeLessThan(flow.indexOf('- tapOn:\n    id: "set-weight-plus-.*"'));
    });

    it('never taps a set action, and proves no set was logged (no Rest, the dock still offers Did it)', () => {
      expect(taps(flow).filter((sel) => /set-action-/.test(sel))).toEqual([]);
      const guard = flow.indexOf('- assertNotVisible:\n    id: "rest-timer"');
      expect(guard).toBeGreaterThan(flow.indexOf('id: "set-reps-minus-.*"'));
      // DECLARED (T-74 device check): was + childOf session-dock; the dock wrapper isn't the button's native parent.
      expect(flow).toMatch(/- assertVisible:\n\s+id: "set-action-\.\*"\n\s+text: "Did it"\n/);
    });

    it('checks How to before the stepper scrolls move the stage off screen', () => {
      expect(flow.indexOf('id: "how-to-open"')).toBeGreaterThan(-1);
      expect(flow.indexOf('id: "how-to-open"')).toBeLessThan(flow.indexOf('id: "set-weight-plus-.*"'));
    });

    it('keeps its onFlowComplete cleanup: dialogs, How to, the Rest minimised, then the discard when the chrome shows', () => {
      const h = hook('phase3/03b-workout-session.yaml');
      const order = [
        '- runFlow: ../subflows/dismiss-session-dialogs.yaml',
        'id: "how-to-close"',
        '- runFlow: ../subflows/minimize-rest.yaml',
        'id: "session-chrome"',
      ].map((needle) => h.indexOf(needle));
      order.forEach((at) => expect(at).toBeGreaterThan(-1));
      expect([...order].sort((a, b) => a - b)).toEqual(order);
      expect(h).toMatch(/when:\n\s+visible:\n\s+id: "session-chrome"\n\s+commands:\n\s+- runFlow: \.\.\/subflows\/discard-workout\.yaml/);
    });
  });

  describe('item 2: set taps are exact (the dock\'s Did it, never a strip chip\'s Undo)', () => {
    it('the app still gives the strip chips and Did it the same set-action-<id>; only Did it has the text "Did it"', () => {
      const parts = src('src/features/workout/runtime/RuntimeParts.js');
      expect(parts.match(/testID=\{`set-action-\$\{set\.id\}`\}/g)).toHaveLength(3);
      expect(parts).toContain("accessibilityLabel={pending ? 'Saving…' : 'Undo'}");
      expect(parts).toContain("const label = isPending ? 'Saving…' : 'Did it';");
      // DECLARED (T-74 device check): was runtime has 2 testID="session-dock" (the flows no longer scope to it).
      expect(parts.match(/'Did it'/g)).toHaveLength(1);
      expect(parts).toContain('accessibilityLabel={`Set ${set.set_number}`}');
      expect(parts).toContain('testID="set-editor"');
    });

    it('log-current-set taps "Did it" (its exact text), enabled', () => {
      const flow = body('subflows/log-current-set.yaml');
      // DECLARED (T-74 device check): was + childOf session-dock; now asserts no session-dock scope.
      expect(flow).toMatch(/- tapOn:\n\s+id: "set-action-\.\*"\n\s+text: "Did it"\n\s+enabled: true\n/);
      expect(flow).not.toMatch(/id: "session-dock"/);
    });

    it.each(FLOWS.map(rel))('%s: every set-action tap is the dock\'s Did it or an explicit Undo', (name) => {
      taps(steps(read(name)))
        .filter((sel) => /set-action-/.test(sel))
        .forEach((sel) => {
          // DECLARED (T-74 device check): was "Did it" AND childOf session-dock.
          const didIt = /text: "Did it"/.test(sel);
          const undo = /text: "Undo"/.test(sel);
          expect(didIt || undo).toBe(true);
        });
    });

    it('the tap scan sees the set taps it checks (not vacuous)', () => {
      expect(taps(body('subflows/log-current-set.yaml')).filter((sel) => /set-action-/.test(sel))).toHaveLength(1);
      expect(taps(body('phase3/c3-browsing-lock.yaml')).filter((sel) => /text: "Undo"/.test(sel))).toHaveLength(1);
      const optional = FLOWS.flatMap((file) => blocks(steps(fs.readFileSync(file, 'utf8')), 'extendedWaitUntil')).filter((b) => /optional: true/.test(b));
      expect(optional.length).toBeGreaterThanOrEqual(2);
    });

    it.each(LOGGERS)('%s logs its sets through log-current-set only', (name) => {
      const flow = body(name);
      expect(flow).toMatch(/- runFlow: \.\.\/subflows\/log-current-set\.yaml/);
      expect(taps(flow).filter((sel) => /set-action-/.test(sel) && !/text: "Undo"/.test(sel))).toEqual([]);
      // T-69: no bare weight tap left (it could land on the dock's Did it).
      expect(taps(flow).filter((sel) => /set-weight-plus-/.test(sel))).toEqual([]);
    });

    it('log-current-set centres the editor\'s weight + before its tap, and waits for the PATCH after Did it', () => {
      const flow = body('subflows/log-current-set.yaml');
      const scroll = flow.indexOf('- scrollUntilVisible:\n    element:\n      id: "set-weight-plus-.*"\n      childOf:\n        id: "set-editor"\n    direction: DOWN\n    centerElement: true');
      const weight = flow.indexOf('- tapOn:\n    id: "set-weight-plus-.*"\n    childOf:\n      id: "set-editor"');
      const didIt = flow.indexOf('text: "Did it"');
      expect(scroll).toBeGreaterThan(-1);
      expect(weight).toBeGreaterThan(scroll);
      expect(didIt).toBeGreaterThan(weight);
      expect(flow.slice(didIt)).toMatch(/extendedWaitUntil:\n\s+notVisible:\n\s+id: "set-action-\.\*"\n\s+text: "Saving…"\n\s+timeout: 15000/);
    });
  });

  describe('item 3: 03b restores the workspace', () => {
    it('after its discard it goes back to Today (only when it switched) and runs restore-workspace', () => {
      const flow = body('phase3/03b-workout-session.yaml');
      expect(flow).toMatch(
        /- runFlow: \.\.\/subflows\/discard-workout\.yaml\n- runFlow:\n\s+when:\n\s+true: \$\{output\.v2SwitchedToMember === true\}\n\s+commands:\n\s+- tapOn:\n\s+id: "workout-back-today"\n\s+- extendedWaitUntil:\n\s+visible:\n\s+id: "tab-Today\|rail-Today"\n\s+timeout: 20000\n- runFlow: \.\.\/subflows\/restore-workspace\.yaml\s*$/
      );
    });

    it('its onFlowComplete restores too, after the discard, so a failed run leaves no trainer in Personal', () => {
      const h = hook('phase3/03b-workout-session.yaml');
      expect(h.indexOf('- runFlow: ../subflows/restore-workspace.yaml')).toBeGreaterThan(h.indexOf('discard-workout.yaml'));
      expect(h).toMatch(/true: \$\{output\.v2SwitchedToMember === true\}[\s\S]*visible:\n\s+id: "workout-back-today"\n\s+commands:\n\s+- tapOn:\n\s+id: "workout-back-today"/);
    });

    it('the back pill id is rendered by the Workout hub', () => {
      expect(src('src/features/workout/screens/WorkoutScreen.js')).toContain('testID="workout-back-today"');
    });
  });

  describe('item 4: ensure-signed-out (ios-safe-sign-in stage 0) works on a tablet', () => {
    const flow = steps(fs.readFileSync(path.join(V2, '..', 'subflows', 'ensure-signed-out.yaml'), 'utf8'));

    it('ios-safe-sign-in stage 0 signs out through ensure-signed-out', () => {
      expect(fs.readFileSync(path.join(V2, '..', 'ios-sign-in', 'stage-0-open-form.yaml'), 'utf8')).toMatch(/- runFlow: \.\.\/subflows\/ensure-signed-out\.yaml/);
      expect(fs.readFileSync(path.join(__dirname, 'ios-safe-sign-in.sh'), 'utf8')).toMatch(/stage stage-0-open-form \|\| finish 1/);
    });

    it('a trainer on the rail switches to Personal through rail-TProfile and waits for rail-Profile', () => {
      expect(flow).toMatch(
        /when:\n\s+visible:\n\s+id: "rail-TProfile"\n\s+commands:\n\s+- tapOn:\n\s+id: "rail-TProfile"\n\s+- scrollUntilVisible:\n\s+element:\n\s+id: "mode-switch-member"\n[\s\S]*?- tapOn:\n\s+id: "mode-switch-member"\n\s+- extendedWaitUntil:\n\s+visible:\n\s+id: "rail-Profile"/
      );
    });

    it('a member on the rail opens rail-Profile and scrolls to sign out, before the shared sign-out tap', () => {
      const rail = flow.search(/when:\n\s+visible:\n\s+id: "rail-Profile"\n\s+commands:\n\s+- tapOn:\n\s+id: "rail-Profile"\n\s+- scrollUntilVisible:\n\s+element:\n\s+id: "settings-sign-out"/);
      expect(rail).toBeGreaterThan(-1);
      expect(rail).toBeLessThan(flow.indexOf('- tapOn:\n          id: "settings-sign-out"'));
      // The phone branches are unchanged and still come first.
      expect(flow.indexOf('id: "tab-TProfile"')).toBeLessThan(flow.indexOf('id: "rail-TProfile"'));
      expect(flow.indexOf('id: "tab-Profile"\n    commands:')).toBeLessThan(rail);
    });
  });

  describe('item 5 (carry 4): optional waits cost less', () => {
    it('generator-preview waits for EITHER outcome, not optionally for the plan name alone', () => {
      const flow = steps(read('phase4/generator-preview.yaml'));
      expect(flow).toMatch(/- extendedWaitUntil:\n\s+visible:\n\s+id: "generator-plan-name\|generator-not-feasible"\n\s+timeout: 45000\n- runFlow:/);
      expect(flow).not.toMatch(/id: "generator-plan-name"\n\s+timeout: 45000\n\s+optional: true/);
    });

    it('6o-01 runs the optional create-tile scroll on a phone only', () => {
      expect(steps(read('phase6/6o-01-trainer-plans-browse.yaml'))).toMatch(
        /- runFlow:\n\s+when:\n\s+notVisible:\n\s+id: "tablet-rail"\n\s+commands:\n\s+- scrollUntilVisible:\n\s+element:\n\s+id: "plans-create-tile"/
      );
    });

    it('no v2 optional extendedWaitUntil waits longer than 3 s, and the dialog wait after a set runs only with a Rest up', () => {
      FLOWS.forEach((file) => {
        blocks(steps(fs.readFileSync(file, 'utf8')), 'extendedWaitUntil')
          .filter((block) => /optional: true/.test(block))
          .forEach((block) => expect(Number(block.match(/timeout: (\d+)/)[1])).toBeLessThanOrEqual(3000));
      });
      expect(body('subflows/log-current-set.yaml')).toMatch(
        /when:\n\s+visible:\n\s+id: "rest-timer"\n\s+commands:\n\s+- extendedWaitUntil:\n\s+visible:\n\s+id: "exact-alarm-dialog\|speak-intro-dialog"\n\s+timeout: 1500\n\s+optional: true/
      );
    });
  });

  describe('item 6: the Android exact-alarm dialog is dismissed BEFORE every set tap', () => {
    it('dismiss-session-dialogs taps the exact-alarm "Not now" by id, and the app renders those ids', () => {
      expect(body('subflows/dismiss-session-dialogs.yaml')).toMatch(/when:\n\s+visible:\n\s+id: "exact-alarm-dialog"\n\s+commands:\n\s+- tapOn:\n\s+id: "exact-alarm-not-now"/);
      const overlays = src('src/features/workout/runtime/RuntimeOverlays.js');
      ['exact-alarm-dialog', 'exact-alarm-not-now', 'speak-intro-dialog', 'speak-intro-keep-on', 'rest-timer-minimize'].forEach((id) => expect(overlays).toContain(`testID="${id}"`));
    });

    it('log-current-set runs it right before the Did it tap (after the weight tap) and again after', () => {
      const flow = body('subflows/log-current-set.yaml');
      const didIt = flow.indexOf('- tapOn:\n    id: "set-action-.*"');
      const before = flow.slice(0, didIt).trimEnd();
      expect(before.endsWith('- runFlow: dismiss-session-dialogs.yaml')).toBe(true);
      expect(flow.trim().endsWith('- runFlow: dismiss-session-dialogs.yaml')).toBe(true);
      expect(flow.startsWith('- runFlow: dismiss-session-dialogs.yaml\n')).toBe(true);
    });
  });

  describe('item 7: the Rest is minimised before every session-exit tap', () => {
    it('minimize-rest taps rest-timer-minimize only when it is visible', () => {
      expect(body('subflows/minimize-rest.yaml')).toMatch(/^- runFlow:\n\s+when:\n\s+visible:\n\s+id: "rest-timer-minimize"\n\s+commands:\n\s+- tapOn:\n\s+id: "rest-timer-minimize"/);
    });

    it.each(FLOWS.map(rel))('%s: every session-exit tap follows minimize-rest', (name) => {
      const flow = steps(read(name));
      const re = /- tapOn:\n\s+id: "session-exit"/g;
      let m;
      while ((m = re.exec(flow))) {
        expect(flow.slice(0, m.index).trimEnd()).toMatch(/- runFlow: (?:\.\.\/subflows\/)?minimize-rest\.yaml$/);
      }
    });
  });
});
