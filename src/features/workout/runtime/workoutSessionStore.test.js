import { act, create } from 'react-test-renderer';

import { AuthStatus, useAuthStore } from '../../auth/authStore';
import useRestAlerts from './useRestAlerts';
import { endSessionState, peekSession, sessionEntry, useSessionValue } from './workoutSessionStore';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(() => Promise.resolve(null)), setItem: jest.fn(() => Promise.resolve()) }));
jest.mock('./restAlerts', () => ({
  createRestAlertController: jest.fn((options) => ({
    options,
    activate: jest.fn(),
    dispose: jest.fn(),
    appStateChanged: jest.fn(),
  })),
}));
const { createRestAlertController } = require('./restAlerts');

afterEach(() => {
  endSessionState();
  createRestAlertController.mockClear();
});

// T-59 follow-up (PM + reviewer, 27 Oct): the live session's runtime state
// outlives any remount of the Workout screen (font scale, rotation, leaving
// and coming back); it ends with the session, on sign-out, or when another
// session starts.
describe('workoutSessionStore', () => {
  it('one entry per session: the same id returns it; another id disposes it and starts clean', () => {
    const first = sessionEntry('S1');
    first.values.drafts = { 7: { weight: '40' } };
    const controller = { dispose: jest.fn() };
    first.controller = controller;
    expect(sessionEntry('S1')).toBe(first);

    const second = sessionEntry('S2');
    expect(second).not.toBe(first);
    expect(second.values).toEqual({});
    expect(controller.dispose).toHaveBeenCalledTimes(1);
    expect(peekSession('S1')).toBeNull();
  });

  it('endSessionState disposes the controller; peek never creates an entry', () => {
    const controller = { dispose: jest.fn() };
    sessionEntry('S1').controller = controller;
    endSessionState();
    expect(controller.dispose).toHaveBeenCalledTimes(1);
    expect(peekSession('S1')).toBeNull();
    expect(peekSession('S1')).toBeNull();
  });

  it('signing out ends the session state', () => {
    const controller = { dispose: jest.fn() };
    sessionEntry('S1').controller = controller;
    act(() => useAuthStore.setState({ status: AuthStatus.signedOut }));
    expect(controller.dispose).toHaveBeenCalledTimes(1);
    expect(peekSession('S1')).toBeNull();
  });

  it('useSessionValue survives a remount of the same session and starts clean for a new one', () => {
    let value;
    let setValue;
    function Probe({ id }) {
      [value, setValue] = useSessionValue(id, 'drafts', {});
      return null;
    }
    let tree;
    act(() => {
      tree = create(<Probe id="S1" />);
    });
    act(() => setValue({ 7: { weight: '42.5' } }));
    act(() => tree.unmount());
    act(() => {
      tree = create(<Probe id="S1" />);
    });
    expect(value).toEqual({ 7: { weight: '42.5' } });
    act(() => tree.unmount());
    act(() => {
      tree = create(<Probe id="S2" />);
    });
    expect(value).toEqual({});
    act(() => tree.unmount());
  });
});

describe('useRestAlerts with a session', () => {
  const platform = {};
  function mount(id, onValue) {
    function Probe() {
      onValue(useRestAlerts(platform, () => true, id));
      return null;
    }
    let tree;
    act(() => {
      tree = create(<Probe />);
    });
    return tree;
  }

  it('a remount keeps the SAME controller (no dispose, so the scheduled alert stays); the dialogs follow the current mount', () => {
    let first;
    let tree = mount('S1', (value) => (first = value));
    const controller = first.alerts;
    act(() => tree.unmount());
    expect(controller.dispose).not.toHaveBeenCalled();

    let second;
    tree = mount('S1', (value) => (second = value));
    expect(second.alerts).toBe(controller);
    expect(createRestAlertController).toHaveBeenCalledTimes(1);
    act(() => controller.options.onOfferExactAlarm());
    expect(second.offerOpen).toBe(true);
    act(() => tree.unmount());
  });

  it('the session end disposes it once', () => {
    let value;
    const tree = mount('S1', (next) => (value = next));
    act(() => tree.unmount());
    endSessionState();
    expect(value.alerts.dispose).toHaveBeenCalledTimes(1);
  });
});

// PM (realistic case, 27 Oct): after the session ends elsewhere the user
// often stays on Today or leaves the app in the background, so the Workout
// loader never runs. The store re-checks the server itself — on foreground,
// on Today's focus, and once just before a stored rest ends while the
// Workout screen is away — so no stale "rest over" fires. (A rest whose end
// passes while the app stays in the background the whole time is beyond any
// app code: the OS shows the scheduled notification.)
describe('verifySessionState (ended elsewhere, screen away)', () => {
  const { verifySessionState, handleAppStateChange, restScreenMounted, restScreenUnmounted } = require('./workoutSessionStore');
  let controller;
  beforeEach(() => {
    controller = { dispose: jest.fn() };
    sessionEntry(5).controller = controller;
  });

  it('no active session or another one → the entry ends and its alert is cancelled; the same one keeps it; a failure keeps it', async () => {
    await verifySessionState({ fetchCurrent: () => Promise.resolve({ id: 5 }) });
    expect(peekSession(5)).not.toBeNull();
    await verifySessionState({ fetchCurrent: () => Promise.reject(new Error('Network Error')) });
    expect(peekSession(5)).not.toBeNull();
    await verifySessionState({ fetchCurrent: () => Promise.resolve(null) });
    expect(peekSession(5)).toBeNull();
    expect(controller.dispose).toHaveBeenCalledTimes(1);
  });

  it('without a stored session it never calls the server', async () => {
    endSessionState();
    const fetchCurrent = jest.fn(() => Promise.resolve(null));
    await verifySessionState({ fetchCurrent });
    expect(fetchCurrent).not.toHaveBeenCalled();
  });

  it('coming back to the foreground re-checks; going away does not', async () => {
    const fetchCurrent = jest.fn(() => Promise.resolve(null));
    await handleAppStateChange('background', { fetchCurrent });
    expect(fetchCurrent).not.toHaveBeenCalled();
    await handleAppStateChange('active', { fetchCurrent });
    expect(fetchCurrent).toHaveBeenCalledTimes(1);
    expect(peekSession(5)).toBeNull();
  });

  it('a rest left running while the screen is away is re-checked once, 5 s before its end; a remount cancels that', () => {
    jest.useFakeTimers();
    try {
      const fetchCurrent = jest.fn(() => Promise.resolve({ id: 5 }));
      const entry = sessionEntry(5);
      entry.rest = { setId: 'A', startMs: Date.now(), total: 60 };
      restScreenUnmounted(5, { fetchCurrent });
      jest.advanceTimersByTime(54000);
      expect(fetchCurrent).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1000);
      expect(fetchCurrent).toHaveBeenCalledTimes(1);

      fetchCurrent.mockClear();
      entry.rest = { setId: 'B', startMs: Date.now(), total: 60 };
      restScreenUnmounted(5, { fetchCurrent });
      restScreenMounted(5);
      jest.advanceTimersByTime(70000);
      expect(fetchCurrent).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
