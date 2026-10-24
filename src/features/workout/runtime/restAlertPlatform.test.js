jest.mock(
  'expo-notifications',
  () => ({
    AndroidImportance: { HIGH: 4 },
    setNotificationHandler: jest.fn(),
    setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
    deleteNotificationChannelAsync: jest.fn(() => Promise.resolve()),
    getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'denied' })),
  }),
  { virtual: true }
);
jest.mock(
  'expo-audio',
  () => ({
    createAudioPlayer: jest.fn(() => ({ seekTo: jest.fn(), play: jest.fn() })),
    setAudioModeAsync: jest.fn(() => Promise.resolve()),
    setIsAudioActiveAsync: jest.fn(() => Promise.resolve()),
  }),
  { virtual: true }
);
jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn() }), { virtual: true });
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(() => Promise.resolve(null)), setItem: jest.fn(() => Promise.resolve()) }));

const Notifications = require('expo-notifications');
const { createAudioPlayer, setAudioModeAsync } = require('expo-audio');
const AsyncStorage = require('@react-native-async-storage/async-storage');
const { default: restAlertPlatform, initRestAlerts, permissionState } = require('./restAlertPlatform');

describe('restAlertPlatform', () => {
  it('registers the handler once and keys it on the source (O4 rule 4)', async () => {
    initRestAlerts();
    initRestAlerts();
    expect(Notifications.setNotificationHandler).toHaveBeenCalledTimes(1);
    const { handleNotification } = Notifications.setNotificationHandler.mock.calls[0][0];
    const behavior = await handleNotification({ request: { content: { data: { kind: 'rest-end', source: 'foreground' } } } });
    expect(behavior).toMatchObject({ shouldShowBanner: true, shouldShowList: false, shouldPlaySound: false });
  });

  it('reads the permission status and the once-only offer key (A2 rule 4)', async () => {
    await expect(restAlertPlatform.getPermission()).resolves.toBe('granted');
    await expect(restAlertPlatform.readOffered()).resolves.toBe(false);
    await restAlertPlatform.markOffered();
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('gymido.exactAlarmOffered', '1');
  });

  it('creates the beep player once and replays it from the start', async () => {
    await restAlertPlatform.playBeep();
    await restAlertPlatform.playBeep();
    expect(createAudioPlayer).toHaveBeenCalledTimes(1);
    const player = createAudioPlayer.mock.results[0].value;
    expect(player.seekTo).toHaveBeenCalledWith(0);
    expect(player.play).toHaveBeenCalledTimes(2);
  });

  it('treats a never-answered permission as undetermined, as the web does with "default"', () => {
    expect(permissionState({ status: 'granted', granted: true })).toBe('granted');
    expect(permissionState({ status: 'denied', granted: false, canAskAgain: true })).toBe('undetermined');
    expect(permissionState({ status: 'undetermined', granted: false, canAskAgain: true })).toBe('undetermined');
    expect(permissionState({ status: 'denied', granted: false, canAskAgain: false })).toBe('denied');
  });

  it('sets the beep audio mode once: audible on silent, ducking other audio (owner ruling)', () => {
    expect(setAudioModeAsync).toHaveBeenCalledTimes(1);
    expect(setAudioModeAsync).toHaveBeenCalledWith({ playsInSilentMode: true, interruptionMode: 'duckOthers', shouldPlayInBackground: false });
  });

  it('a failing audio mode never blocks the beep and is retried next time', async () => {
    let platform;
    jest.isolateModules(() => {
      const audio = require('expo-audio');
      audio.setAudioModeAsync.mockClear();
      audio.createAudioPlayer.mockClear();
      audio.setAudioModeAsync.mockImplementationOnce(() => Promise.reject(new Error('busy')));
      platform = require('./restAlertPlatform').default;
    });
    const audio = require('expo-audio');
    await platform.playBeep();
    const first = audio.createAudioPlayer.mock.results[0].value;
    expect(first.play).toHaveBeenCalledTimes(1);
    await platform.playBeep();
    expect(audio.setAudioModeAsync).toHaveBeenCalledTimes(2);
  });

  it('asks once: after one request a denied+canAskAgain answer is "denied" (web asks only while "default")', () => {
    expect(permissionState({ status: 'denied', granted: false, canAskAgain: true }, true)).toBe('denied');
    expect(permissionState({ status: 'undetermined', granted: false, canAskAgain: true }, true)).toBe('undetermined');
    expect(permissionState({ status: 'granted', granted: true }, true)).toBe('granted');
  });

  it('records the ask before the OS dialog and reads it back', async () => {
    AsyncStorage.setItem.mockClear();
    Notifications.getPermissionsAsync.mockResolvedValue({ status: 'denied', granted: false, canAskAgain: true });
    AsyncStorage.getItem.mockResolvedValueOnce(null);
    await expect(restAlertPlatform.getPermission()).resolves.toBe('undetermined');
    await expect(restAlertPlatform.requestPermission()).resolves.toBe('denied');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('gymido.notificationPermissionAsked', '1');
    expect(AsyncStorage.setItem.mock.invocationCallOrder[0]).toBeLessThan(Notifications.requestPermissionsAsync.mock.invocationCallOrder[0]);
    AsyncStorage.getItem.mockImplementation((key) => Promise.resolve(key === 'gymido.notificationPermissionAsked' ? '1' : null));
    await expect(restAlertPlatform.getPermission()).resolves.toBe('denied');
  });

  it('an unreadable asked flag never risks a second ask', async () => {
    Notifications.getPermissionsAsync.mockResolvedValue({ status: 'denied', granted: false, canAskAgain: true });
    AsyncStorage.getItem.mockImplementationOnce(() => Promise.reject(new Error('io')));
    await expect(restAlertPlatform.getPermission()).resolves.toBe('denied');
  });
});

describe('spoken rest cue (owner request, 23 Oct 2026)', () => {
  const Speech = require('expo-speech');
  const { REST_SPOKEN_TEXT } = require('./restAlerts');
  const { loadSpeakRestAlerts, setSpeakRestAlerts } = require('./speakRestAlerts');

  beforeEach(() => {
    jest.useFakeTimers();
    Speech.speak.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('is on by default and speaks the copy after the beep, in the beep audio mode', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(null);
    await loadSpeakRestAlerts();
    restAlertPlatform.speakRestEnd(REST_SPOKEN_TEXT);
    await Promise.resolve();
    await Promise.resolve();
    expect(Speech.speak).not.toHaveBeenCalled();
    jest.advanceTimersByTime(599);
    expect(Speech.speak).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    for (let i = 0; i < 20; i += 1) {
      await Promise.resolve();
    }
    expect(setAudioModeAsync).toHaveBeenCalled();
    // Re-activated before speaking (Android refuses to play while released).
    expect(require('expo-audio').setIsAudioActiveAsync).toHaveBeenCalledWith(true);
    expect(Speech.speak).toHaveBeenCalledWith(REST_SPOKEN_TEXT, expect.objectContaining({ language: 'en', useApplicationAudioSession: true }));
    // The session is released when the speech ends.
    const { setIsAudioActiveAsync } = require('expo-audio');
    Speech.speak.mock.calls[0][1].onDone();
    jest.runOnlyPendingTimers();
    await Promise.resolve();
    expect(setIsAudioActiveAsync).toHaveBeenCalledWith(false);
  });

  it('stays silent when "Speak rest alerts" is off, and stores the choice', async () => {
    await setSpeakRestAlerts(false);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('gymido.speakRestAlerts', '0');
    restAlertPlatform.speakRestEnd(REST_SPOKEN_TEXT);
    await Promise.resolve();
    jest.advanceTimersByTime(1000);
    expect(Speech.speak).not.toHaveBeenCalled();
    AsyncStorage.getItem.mockResolvedValueOnce('0');
    await loadSpeakRestAlerts();
    restAlertPlatform.speakRestEnd(REST_SPOKEN_TEXT);
    jest.advanceTimersByTime(1000);
    expect(Speech.speak).not.toHaveBeenCalled();
    await setSpeakRestAlerts(true);
  });
});
