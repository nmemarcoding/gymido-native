import {
  REST_NOTIFICATION_ID,
  createRestAlertController,
  createRestNotifier,
  deliveredWhileAway,
  restNotificationBehavior,
  restNotificationRequest,
  shouldOfferExactAlarm,
} from './restAlerts';

// An in-memory expo-notifications: one slot per identifier, like the OS.
// Every call yields to the event loop first, so overlapping work interleaves.
function fakePlatform({ permission = 'granted', canExact = null, offered = false } = {}) {
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
  const fake = {
    permission,
    offered,
    pending: [],
    presented: [],
    beeps: 0,
    spoken: 0,
    stops: 0,
    lastSpoken: null,
    introShown: true,
    vibrateOn: true,
    requests: 0,
    getPermission: async () => fake.permission,
    requestPermission: async () => {
      fake.requests += 1;
      fake.permission = 'granted';
      return 'granted';
    },
    getScheduled: async () => {
      await tick();
      return fake.pending.map((item) => ({ identifier: item.identifier, content: item.content }));
    },
    getPresented: async () => {
      await tick();
      return fake.presented.map((item) => ({ request: { identifier: item.identifier, content: item.content } }));
    },
    cancelScheduled: async (id) => {
      await tick();
      fake.pending = fake.pending.filter((item) => item.identifier !== id);
    },
    dismiss: async (id) => {
      await tick();
      fake.presented = fake.presented.filter((item) => item.identifier !== id);
    },
    schedule: async (request) => {
      await tick();
      fake.pending = fake.pending.filter((item) => item.identifier !== request.identifier);
      fake.presented = fake.presented.filter((item) => item.identifier !== request.identifier);
      (request.trigger === null ? fake.presented : fake.pending).push(request);
      return request.identifier;
    },
    playBeep: () => {
      fake.beeps += 1;
    },
    speakRestEnd: (text) => {
      fake.spoken += 1;
      fake.lastSpoken = text;
    },
    stopSpeech: () => {
      fake.stops += 1;
    },
    vibrateEnabled: () => fake.vibrateOn,
    readSpeakIntroShown: async () => fake.introShown,
    markSpeakIntroShown: async () => {
      fake.introShown = true;
    },
    canScheduleExactAlarms: async () => canExact,
    openExactAlarmSettings: jest.fn(),
    readOffered: async () => fake.offered,
    markOffered: async () => {
      fake.offered = true;
    },
    all: () => [...fake.pending, ...fake.presented],
  };
  return fake;
}

const settle = async () => {
  for (let i = 0; i < 40; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

function setup(options = {}, controllerOptions = {}) {
  const platform = fakePlatform(options);
  let clock = 1_000_000;
  const vibrate = jest.fn();
  const onOfferExactAlarm = jest.fn();
  const controller = createRestAlertController({
    platform,
    now: () => clock,
    os: 'ios',
    apiLevel: 0,
    vibrate,
    onOfferExactAlarm,
    ...controllerOptions,
  });
  return { platform, controller, vibrate, onOfferExactAlarm, advance: (ms) => (clock += ms), now: () => clock };
}

describe('rest notification handler (O4 rule 4, A1)', () => {
  it('silences the scheduled alert only in the foreground', () => {
    expect(restNotificationBehavior({ kind: 'rest-end', source: 'scheduled' }, 'active')).toMatchObject({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
    });
    expect(restNotificationBehavior({ kind: 'rest-end', source: 'scheduled' }, 'background').shouldShowBanner).toBe(true);
  });

  it('shows the foreground parity alert as a silent banner kept out of the tray', () => {
    expect(restNotificationBehavior({ kind: 'rest-end', source: 'foreground' }, 'active')).toMatchObject({
      shouldShowBanner: true,
      shouldShowList: false,
      shouldPlaySound: false,
    });
  });
});

describe('rest notification requests', () => {
  it('schedules at the end instant with the default sound on the vibrating rest-timer-v2 channel', () => {
    const request = restNotificationRequest({ source: 'scheduled', setId: 7, endMs: 5000, token: 't' }, 'android');
    expect(request).toEqual({
      identifier: REST_NOTIFICATION_ID,
      content: { title: 'Rest complete', body: 'Time for your next set.', sound: 'default', data: { kind: 'rest-end', source: 'scheduled', setId: 7, token: 't' } },
      trigger: { type: 'date', date: 5000, channelId: 'rest-timer-v2' },
    });
  });

  it('presents the foreground one immediately with no sound', () => {
    const request = restNotificationRequest({ source: 'foreground', setId: 7, endMs: 5000, token: 't' }, 'ios');
    expect(request.trigger).toBeNull();
    expect(request.content).not.toHaveProperty('sound');
  });

  it('with the opt-in, marks only the iOS SCHEDULED alert Time Sensitive; the foreground banner and Android stay default', () => {
    expect(restNotificationRequest({ source: 'scheduled', setId: 7, endMs: 5000, token: 't' }, 'ios', true).content.interruptionLevel).toBe('timeSensitive');
    expect(restNotificationRequest({ source: 'foreground', setId: 7, endMs: 5000, token: 't' }, 'ios', true).content).not.toHaveProperty('interruptionLevel');
    for (const source of ['scheduled', 'foreground']) {
      expect(restNotificationRequest({ source, setId: 7, endMs: 5000, token: 't' }, 'android', true).content).not.toHaveProperty('interruptionLevel');
    }
  });

  it('is off by default (free teams cannot sign the entitlement)', () => {
    expect(restNotificationRequest({ source: 'scheduled', setId: 7, endMs: 5000, token: 't' }, 'ios').content).not.toHaveProperty('interruptionLevel');
  });

  it('posts the Android foreground banner on its own silent channel (Q4)', () => {
    const request = restNotificationRequest({ source: 'foreground', setId: 7, endMs: 5000, token: 't' }, 'android');
    expect(request.trigger).toEqual({ channelId: 'rest-timer-banner' });
    expect(request.content).not.toHaveProperty('sound');
  });
});

describe('pure rules', () => {
  it('skips the resume alert only when the background notification already fired (rule 5)', () => {
    const away = { backgroundedAtMs: 100, resumedAtMs: 200, granted: true };
    expect(deliveredWhileAway(away, 150)).toBe(true);
    expect(deliveredWhileAway(away, 200)).toBe(true);
    expect(deliveredWhileAway(away, 100)).toBe(false);
    expect(deliveredWhileAway(away, 250)).toBe(false);
    expect(deliveredWhileAway({ ...away, granted: false }, 150)).toBe(false);
    expect(deliveredWhileAway(null, 150)).toBe(false);
    expect(deliveredWhileAway({ ...away, backgroundedAtMs: null }, 150)).toBe(false);
  });

  it('offers exact alarms only on Android 12+ when every A2 condition holds', () => {
    const base = { os: 'android', apiLevel: 31, canExact: false, granted: true, requestedNow: false, offered: false };
    expect(shouldOfferExactAlarm(base)).toBe(true);
    expect(shouldOfferExactAlarm({ ...base, os: 'ios' })).toBe(false);
    expect(shouldOfferExactAlarm({ ...base, apiLevel: 30 })).toBe(false);
    expect(shouldOfferExactAlarm({ ...base, canExact: true })).toBe(false);
    expect(shouldOfferExactAlarm({ ...base, canExact: null })).toBe(false);
    expect(shouldOfferExactAlarm({ ...base, granted: false })).toBe(false);
    expect(shouldOfferExactAlarm({ ...base, requestedNow: true })).toBe(false);
    expect(shouldOfferExactAlarm({ ...base, offered: true })).toBe(false);
  });
});

describe('remove-then-send (A1 rules 10, 12, 14)', () => {
  it('leaves exactly one rest-end notification and never touches other kinds', async () => {
    const platform = fakePlatform();
    platform.pending.push({ identifier: 'other', content: { data: { kind: 'reminder' } } });
    platform.presented.push({ identifier: 'old-rest', content: { data: { kind: 'rest-end' } } });
    let n = 0;
    const notifier = createRestNotifier(platform, () => `t${(n += 1)}`);
    notifier.send({ source: 'scheduled', setId: 1, endMs: 10 });
    notifier.send({ source: 'scheduled', setId: 2, endMs: 20 });
    await settle();
    const rests = platform.all().filter((item) => item.content.data.kind === 'rest-end');
    expect(rests).toHaveLength(1);
    expect(rests[0].content.data).toMatchObject({ setId: 2, token: 't2' });
    expect(platform.pending.some((item) => item.identifier === 'other')).toBe(true);
  });

  it("cancels only its own send by token, never the newer one (native's test)", async () => {
    const platform = fakePlatform();
    let n = 0;
    const notifier = createRestNotifier(platform, () => `t${(n += 1)}`);
    const first = notifier.send({ source: 'scheduled', setId: 201, endMs: 10 });
    notifier.send({ source: 'scheduled', setId: 202, endMs: 20 });
    notifier.cancelToken(await first);
    await settle();
    expect(platform.all()).toHaveLength(1);
    expect(platform.all()[0].content.data).toMatchObject({ setId: 202, token: 't2' });
  });

  it('keeps the queue moving after a failure', async () => {
    const platform = fakePlatform();
    const schedule = platform.schedule;
    platform.schedule = jest.fn().mockRejectedValueOnce(new Error('boom')).mockImplementation(schedule);
    const notifier = createRestNotifier(platform, () => 't');
    notifier.send({ source: 'scheduled', setId: 1, endMs: 10 }).catch(() => {});
    notifier.send({ source: 'scheduled', setId: 2, endMs: 20 });
    await settle();
    expect(platform.all().map((item) => item.content.data.setId)).toEqual([2]);
  });
});

describe('rest alert controller (O4)', () => {
  it('requests permission at the rest start when undetermined, then schedules (rule 1)', async () => {
    const { platform, controller } = setup({ permission: 'undetermined' });
    controller.restStarted(5, 2_000_000);
    await settle();
    expect(platform.requests).toBe(1);
    expect(platform.pending).toHaveLength(1);
    expect(platform.pending[0].trigger.date).toBe(2_000_000);
  });

  it('does nothing without permission, and the natural end still beeps', async () => {
    const { platform, controller } = setup({ permission: 'denied' });
    controller.restStarted(5, 2_000_000);
    await settle();
    expect(platform.all()).toHaveLength(0);
    await controller.restEnded(5, 2_000_000);
    await settle();
    expect(platform.beeps).toBe(1);
    expect(platform.spoken).toBe(1);
    expect(platform.all()).toHaveLength(0);
  });

  it('re-arms for the current end instant on leaving the foreground and cancels on resume (rules 1b and 3)', async () => {
    const { platform, controller, advance } = setup();
    controller.restStarted(5, 2_000_000);
    await settle();
    controller.appStateChanged('active');
    await controller.appStateChanged('inactive');
    await settle();
    expect(platform.pending).toHaveLength(1);
    expect(platform.pending[0].trigger.date).toBe(2_000_000);
    advance(1000);
    await controller.appStateChanged('active');
    await settle();
    expect(platform.all()).toHaveLength(0);
    await controller.appStateChanged('background');
    await settle();
    expect(platform.pending).toHaveLength(1);
  });

  it('cancels a re-arm that resolves after the app came back (rule 6)', async () => {
    const { platform, controller } = setup();
    controller.restStarted(5, 2_000_000);
    await settle();
    controller.appStateChanged('inactive');
    controller.appStateChanged('active');
    await settle();
    expect(platform.all()).toHaveLength(0);
  });

  it('reschedules after ±5 s and cancels when the end is no longer ahead (rule 2)', async () => {
    const { platform, controller, now } = setup();
    controller.restStarted(5, 2_000_000);
    await settle();
    await controller.endMoved(2_005_000);
    await settle();
    expect(platform.pending.map((item) => item.trigger.date)).toEqual([2_005_000]);
    await controller.endMoved(now());
    await settle();
    expect(platform.all()).toHaveLength(0);
  });

  it('cancels when the rest is cleared (rule 3)', async () => {
    const { platform, controller } = setup();
    controller.restStarted(5, 2_000_000);
    await settle();
    controller.restCleared();
    await settle();
    expect(platform.all()).toHaveLength(0);
  });

  it('replaces the pending alert with the silent foreground banner at a natural end', async () => {
    const { platform, controller, vibrate } = setup({}, { os: 'android', apiLevel: 34 });
    controller.restStarted(5, 2_000_000);
    await settle();
    await controller.restEnded(5, 2_000_000);
    await settle();
    expect(platform.beeps).toBe(1);
    expect(platform.spoken).toBe(1);
    expect(vibrate).toHaveBeenCalledWith([0, 200, 100, 200]);
    expect(platform.pending).toHaveLength(0);
    expect(platform.presented).toHaveLength(1);
    expect(platform.presented[0].content.data).toMatchObject({ kind: 'rest-end', source: 'foreground', setId: 5 });
  });

  it('skips the resume alert when the background notification was delivered (rule 5)', async () => {
    const { platform, controller, advance, now } = setup();
    controller.restStarted(5, now() + 30_000);
    await settle();
    await controller.appStateChanged('background');
    advance(60_000);
    await controller.appStateChanged('active');
    await controller.restEnded(5, now() - 30_000);
    await settle();
    expect(platform.beeps).toBe(0);
    expect(platform.spoken).toBe(0);
    expect(platform.all()).toHaveLength(0);
  });

  it('rule 5 holds when the first tick after resume runs BEFORE the AppState "active" event (#52)', async () => {
    const { platform, controller, advance, now } = setup();
    const endMs = now() + 30_000;
    controller.restStarted(5, endMs);
    await settle();
    await controller.appStateChanged('background');
    advance(60_000);
    // The rest tick wins the race: the resume event hasn't arrived yet.
    await controller.restEnded(5, endMs);
    await controller.appStateChanged('active');
    await settle();
    expect(platform.beeps).toBe(0);
    expect(platform.spoken).toBe(0);
    expect(platform.all()).toHaveLength(0);
  });

  it('a rest that ends in the foreground after an earlier, finished excursion still beeps (rule 5)', async () => {
    const { platform, controller, advance, now } = setup();
    const endMs = now() + 30_000;
    controller.restStarted(5, endMs);
    await settle();
    await controller.appStateChanged('background');
    advance(5_000);
    await controller.appStateChanged('active');
    advance(30_000);
    await controller.restEnded(5, endMs);
    await settle();
    expect(platform.beeps).toBe(1);
    expect(platform.spoken).toBe(1);
  });

  it('offers exact alarms once, after the rest started, never in the same start as the permission prompt (A2)', async () => {
    const first = setup({ permission: 'undetermined', canExact: false }, { os: 'android', apiLevel: 34 });
    first.controller.restStarted(5, 2_000_000);
    await settle();
    expect(first.onOfferExactAlarm).not.toHaveBeenCalled();
    first.controller.restStarted(6, 2_100_000);
    await settle();
    expect(first.onOfferExactAlarm).toHaveBeenCalledTimes(1);
    expect(first.platform.offered).toBe(true);
    first.controller.restStarted(7, 2_200_000);
    await settle();
    expect(first.onOfferExactAlarm).toHaveBeenCalledTimes(1);
  });

  it('never offers on iOS', async () => {
    const { controller, onOfferExactAlarm } = setup({ canExact: false });
    controller.restStarted(5, 2_000_000);
    await settle();
    expect(onOfferExactAlarm).not.toHaveBeenCalled();
  });
});

describe('live rest countdown (O13)', () => {
  function withCountdown(options = {}, controllerOptions = {}) {
    const log = [];
    const countdown = {
      start: jest.fn(async (args) => log.push(['start', args])),
      update: jest.fn(async (args) => log.push(['update', args])),
      end: jest.fn(async () => log.push(['end'])),
    };
    const rig = setup(options, { countdown, ...controllerOptions });
    const schedule = rig.platform.schedule;
    rig.platform.schedule = async (request) => {
      log.push(['send', request.content.data.source]);
      return schedule(request);
    };
    return { ...rig, countdown, log };
  }

  it('ends the previous countdown, starts the new one, then sends the alert (A1 rule 13)', async () => {
    const { controller, log } = withCountdown();
    controller.restStarted(5, 2_000_000, 90);
    await settle();
    expect(log.map(([op]) => op)).toEqual(['end', 'start', 'send']);
    expect(log[1][1]).toMatchObject({ barStartMs: 2_000_000 - 90_000, endMs: 2_000_000, setId: '5' });
  });

  it('still starts the countdown without notification permission', async () => {
    const { controller, log } = withCountdown({ permission: 'denied' });
    controller.restStarted(5, 2_000_000, 90);
    await settle();
    expect(log.map(([op]) => op)).toEqual(['end', 'start']);
  });

  it('updates with the grown total after ±5 s, with a fresh token', async () => {
    const { controller, log } = withCountdown();
    controller.restStarted(5, 2_000_000, 90);
    await settle();
    await controller.endMoved(2_005_000, 95);
    await settle();
    const update = log.find(([op]) => op === 'update')[1];
    expect(update).toMatchObject({ barStartMs: 2_005_000 - 95_000, endMs: 2_005_000 });
    expect(update.token).not.toBe(log[1][1].token);
  });

  it('never reacts to AppState', async () => {
    const { controller, countdown } = withCountdown();
    controller.restStarted(5, 2_000_000, 90);
    await settle();
    await controller.appStateChanged('background');
    await controller.appStateChanged('active');
    await settle();
    expect(countdown.start).toHaveBeenCalledTimes(1);
    expect(countdown.end).toHaveBeenCalledTimes(1);
  });

  it('ends on every clear', async () => {
    const { controller, countdown } = withCountdown();
    controller.restStarted(5, 2_000_000, 90);
    await settle();
    controller.restCleared();
    await settle();
    expect(countdown.end).toHaveBeenCalledTimes(2);
  });

  it('ends before the foreground alert at zero (O13.3)', async () => {
    const { controller, log } = withCountdown();
    controller.restStarted(5, 2_000_000, 90);
    await settle();
    log.length = 0;
    await controller.restEnded(5, 2_000_000);
    await settle();
    expect(log.map(([op, arg]) => (op === 'send' ? `send:${arg}` : op))).toEqual(['end', 'send:foreground']);
  });

  it('skips the start when the rest already ended before it ran (M1)', async () => {
    const { controller, countdown } = withCountdown();
    controller.restStarted(5, 1_000_000, 90);
    await settle();
    expect(countdown.start).not.toHaveBeenCalled();
  });

  it('skips the start when the rest was cleared before it ran', async () => {
    const { controller, countdown } = withCountdown({ permission: 'undetermined' });
    controller.restStarted(5, 2_000_000, 90);
    controller.restCleared();
    await settle();
    expect(countdown.start).not.toHaveBeenCalled();
  });
});

describe('controller lifecycle', () => {
  it('works again after dispose() + activate() (a re-run effect)', async () => {
    const { platform, controller } = setup();
    controller.dispose();
    controller.activate();
    controller.restStarted(5, 2_000_000, 90);
    await settle();
    expect(platform.pending).toHaveLength(1);
  });
});

describe('spoken cue and A3 pop-up (owner request, 23 Oct 2026)', () => {
  const { REST_SPOKEN_LAST, REST_SPOKEN_TEXT } = require('./restAlerts');

  it('speaks with the beep, once per set, with the short copy when no set is left', async () => {
    const left = { 5: true, 6: false };
    const { platform, controller } = setup({}, { hasNextSet: (setId) => left[setId] });
    await controller.restEnded(5, 2_000_000);
    await controller.restEnded(5, 2_000_000);
    expect(platform.beeps).toBe(2);
    expect(platform.spoken).toBe(1);
    expect(platform.lastSpoken).toBe(REST_SPOKEN_TEXT);
    await controller.restEnded(6, 2_100_000);
    expect(platform.lastSpoken).toBe(REST_SPOKEN_LAST);
  });

  it('stops speech on a new rest and on dispose, not on backgrounding', async () => {
    const { platform, controller } = setup();
    controller.restStarted(5, 2_000_000);
    await settle();
    expect(platform.stops).toBe(1);
    await controller.appStateChanged('background');
    expect(platform.stops).toBe(1);
    controller.dispose();
    expect(platform.stops).toBe(2);
  });

  it('fresh install: rest 1 asks for permission, the pop-up waits for rest 2 and shows once', async () => {
    const onSpeakIntro = jest.fn();
    const { platform, controller } = setup({ permission: 'undetermined' }, { onSpeakIntro });
    platform.introShown = false;
    controller.restStarted(5, 2_000_000);
    await settle();
    expect(platform.requests).toBe(1);
    expect(onSpeakIntro).not.toHaveBeenCalled();
    controller.restStarted(6, 2_100_000);
    await settle();
    expect(onSpeakIntro).toHaveBeenCalledTimes(1);
    expect(platform.introShown).toBe(true);
    controller.restStarted(7, 2_200_000);
    await settle();
    expect(onSpeakIntro).toHaveBeenCalledTimes(1);
  });

  it('Android: a rest that shows the A2 offer leaves the pop-up for the next rest', async () => {
    const onSpeakIntro = jest.fn();
    const { platform, controller, onOfferExactAlarm } = setup({ canExact: false }, { os: 'android', apiLevel: 34, onSpeakIntro });
    platform.introShown = false;
    controller.restStarted(5, 2_000_000);
    await settle();
    expect(onOfferExactAlarm).toHaveBeenCalledTimes(1);
    expect(onSpeakIntro).not.toHaveBeenCalled();
    controller.restStarted(6, 2_100_000);
    await settle();
    expect(onSpeakIntro).toHaveBeenCalledTimes(1);
  });
});

describe('delivered background alert stays (rule 3 is pending-only, rule 11 dropped; Siri announce)', () => {
  const delivered = (setId) => ({ identifier: REST_NOTIFICATION_ID, content: { data: { kind: 'rest-end', source: 'scheduled', setId, token: 'bg' } }, trigger: { type: 'date' } });

  it('is not dismissed when the rest ends while the app is away, nor on resume', async () => {
    const { platform, controller, advance } = setup();
    controller.restStarted(5, 1_060_000);
    await settle();
    await controller.appStateChanged('background');
    await settle();
    // The OS delivers the scheduled alert at the end instant.
    platform.pending = [];
    platform.presented = [delivered(5)];
    advance(70_000);
    await controller.restEnded(5, 1_060_000);
    await settle();
    expect(platform.presented).toHaveLength(1);
    await controller.appStateChanged('active');
    await settle();
    expect(platform.presented).toHaveLength(1);
    expect(platform.beeps).toBe(0);
  });

  it('remove-then-send still replaces a delivered one (rule 10)', async () => {
    const platform = fakePlatform();
    platform.presented = [delivered(5)];
    const notifier = createRestNotifier(platform, () => 't2');
    await notifier.send({ source: 'foreground', setId: 6, endMs: 10 });
    await settle();
    expect(platform.all().map((item) => item.content.data.token)).toEqual(['t2']);
  });
});

describe('rest-end vibration (§7.2 step 2, dated change 23 Oct 2026)', () => {
  it('buzzes once on iOS and keeps the Android pattern, at the beep', async () => {
    const ios = setup();
    await ios.controller.restEnded(5, 2_000_000);
    expect(ios.vibrate).toHaveBeenCalledTimes(1);
    expect(ios.vibrate).toHaveBeenCalledWith();
    const android = setup({}, { os: 'android', apiLevel: 34 });
    await android.controller.restEnded(5, 2_000_000);
    expect(android.vibrate).toHaveBeenCalledWith([0, 200, 100, 200]);
  });

  it('does not buzz when "Vibrate on rest end" is off; the beep still plays', async () => {
    const { platform, controller, vibrate } = setup();
    platform.vibrateOn = false;
    await controller.restEnded(5, 2_000_000);
    expect(vibrate).not.toHaveBeenCalled();
    expect(platform.beeps).toBe(1);
  });

  it('follows the beep skip: no buzz when the background alert already went off', async () => {
    const { controller, vibrate, advance } = setup();
    controller.restStarted(5, 1_060_000);
    await settle();
    await controller.appStateChanged('background');
    await settle();
    advance(70_000);
    await controller.appStateChanged('active');
    await controller.restEnded(5, 1_060_000);
    expect(vibrate).not.toHaveBeenCalled();
  });
});
