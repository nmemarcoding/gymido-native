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
