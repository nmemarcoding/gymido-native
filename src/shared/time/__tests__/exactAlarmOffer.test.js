import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { ExactAlarmOfferDialog } from '../../../features/workout/runtime/Overlays';
import {
  claimExactAlarmOffer,
  EXACT_ALARM_OFFERED_KEY,
  openExactAlarmSettings,
  setExactAlarmModuleForTest,
  shouldOfferExactAlarm,
} from '../exactAlarmOffer';

// A2 (RN-SPEC-time): exact rest alerts on Android, offered ONCE. No path shows
// the offer twice, and no path depends on the answer.

const eligible = {
  platformOS: 'android',
  apiLevel: 34,
  canScheduleExact: false,
  notificationsGranted: true,
  askedThisStart: false,
  offeredBefore: false,
};

describe('shouldOfferExactAlarm (rule 2)', () => {
  it('offers when every condition holds', () => {
    expect(shouldOfferExactAlarm(eligible)).toBe(true);
  });

  it.each([
    ['iOS (A2 is Android-only)', { platformOS: 'ios' }],
    ['below API 31 (nothing to grant)', { apiLevel: 30 }],
    ['already allowed', { canScheduleExact: true }],
    ['no notification permission (O4 does nothing, timing is moot)', { notificationsGranted: false }],
    ['the OS notification dialog was shown this same rest start', { askedThisStart: true }],
    ['offered before (rule 4: once means once)', { offeredBefore: true }],
  ])('does not offer: %s', (_label, change) => {
    expect(shouldOfferExactAlarm({ ...eligible, ...change })).toBe(false);
  });
});

describe('claimExactAlarmOffer (rules 2 and 4)', () => {
  const originalOS = Platform.OS;
  const originalVersion = Platform.Version;
  let native;

  beforeEach(async () => {
    await AsyncStorage.clear();
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    Object.defineProperty(Platform, 'Version', { value: 34, configurable: true });
    native = { canScheduleExactAlarms: jest.fn(() => false), openExactAlarmSettings: jest.fn(() => true) };
    setExactAlarmModuleForTest(native);
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
    Object.defineProperty(Platform, 'Version', { value: originalVersion, configurable: true });
    setExactAlarmModuleForTest(null);
  });

  it('records the offer the moment it is shown, before any answer — so it never shows again', async () => {
    await expect(claimExactAlarmOffer({ granted: true, asked: false })).resolves.toBe(true);
    await expect(AsyncStorage.getItem(EXACT_ALARM_OFFERED_KEY)).resolves.toBe('1');
    // The next rest start: declined, backed out or killed — it's still used up.
    await expect(claimExactAlarmOffer({ granted: true, asked: false })).resolves.toBe(false);
  });

  it('waits for a later rest when the notification dialog was just shown', async () => {
    await expect(claimExactAlarmOffer({ granted: true, asked: true })).resolves.toBe(false);
    await expect(AsyncStorage.getItem(EXACT_ALARM_OFFERED_KEY)).resolves.toBeNull();
    await expect(claimExactAlarmOffer({ granted: true, asked: false })).resolves.toBe(true);
  });

  it('re-checks the grant every time (rule 6): already allowed, no offer', async () => {
    native.canScheduleExactAlarms.mockReturnValue(true);
    await expect(claimExactAlarmOffer({ granted: true, asked: false })).resolves.toBe(false);
  });

  it('shows nothing if the offer cannot be recorded (it could otherwise repeat)', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));
    await expect(claimExactAlarmOffer({ granted: true, asked: false })).resolves.toBe(false);
  });

  it('is never offered on iOS', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    await expect(claimExactAlarmOffer({ granted: true, asked: false })).resolves.toBe(false);
  });

  it('"Open settings" asks the module for Android\'s Alarms & reminders page', () => {
    openExactAlarmSettings();
    expect(native.openExactAlarmSettings).toHaveBeenCalledTimes(1);
  });
});

describe('ExactAlarmOfferDialog (rule 3)', () => {
  const renderDialog = async () => {
    const onNotNow = jest.fn();
    const onOpenSettings = jest.fn();
    await render(<ExactAlarmOfferDialog visible onNotNow={onNotNow} onOpenSettings={onOpenSettings} />);
    return { onNotNow, onOpenSettings };
  };

  it('shows the specced copy', async () => {
    await renderDialog();
    expect(screen.getByText('Get rest alerts on time?')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Android can hold back your rest alert, sometimes by minutes. Allow “Alarms & reminders” for Gymido so it arrives the moment your rest ends.'
      )
    ).toBeOnTheScreen();
    expect(screen.getByTestId('exact-alarm-dialog').props.role).toBe('dialog');
  });

  it('"Open settings" and "Not now" each do exactly their one thing', async () => {
    const { onNotNow, onOpenSettings } = await renderDialog();
    await fireEvent.press(screen.getByText('Open settings'));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByText('Not now'));
    expect(onNotNow).toHaveBeenCalledTimes(1);
  });

  it('a tap on the scrim is "Not now"; a tap on the card is not', async () => {
    const { onNotNow } = await renderDialog();
    await fireEvent.press(screen.getByTestId('exact-alarm-dialog'));
    expect(onNotNow).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('exact-alarm-scrim'));
    expect(onNotNow).toHaveBeenCalledTimes(1);
  });
});
