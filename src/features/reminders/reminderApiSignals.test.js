import { apiClient } from '../../shared/api/client';
import { cancelEnrollment as cancelMyPlan, getCurrentPlan, startPlan } from '../myPlans/api/myPlansApi';
import { acceptGeneratedPlan } from '../planGenerator/api/generatorApi';
import { cancelEnrollment, createSchedule, enrollInPlan, replaceSchedule } from '../plans/api/libraryApi';
import { abandonWorkout, completeWorkout, deleteWorkout, startWorkout } from '../workout/api/workoutApi';
import { signalReminders } from './reminderSignals';

jest.mock('../../shared/api/client', () => ({
  apiClient: { get: jest.fn(), put: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock('./reminderSignals', () => ({ signalReminders: jest.fn() }));

const ok = (data) => Promise.resolve({ data: { data } });

beforeEach(() => {
  jest.clearAllMocks();
  for (const method of ['get', 'put', 'post', 'patch', 'delete']) {
    apiClient[method].mockImplementation(() => ok({ enrollment: { id: 1 }, ok: true }));
  }
});

// T-103: every call that changes what is due tells the reminders, after it
// succeeded; the response is returned unchanged.
test.each([
  ['libraryApi.createSchedule', () => createSchedule(31, [])],
  ['libraryApi.replaceSchedule', () => replaceSchedule(31, [])],
  ['libraryApi.cancelEnrollment', () => cancelEnrollment(31)],
  ['libraryApi.enrollInPlan', () => enrollInPlan({ workout_plan_id: 3 })],
  ['myPlansApi.cancelEnrollment', () => cancelMyPlan(31)],
  ['generatorApi.acceptGeneratedPlan', () => acceptGeneratedPlan({})],
  ['workoutApi.deleteWorkout', () => deleteWorkout(5)],
])('%s → planChanged', async (_name, call) => {
  await expect(call()).resolves.toEqual({ enrollment: { id: 1 }, ok: true });
  expect(signalReminders.mock.calls).toEqual([['planChanged']]);
});

test('myPlansApi.startPlan → planChanged, still returns the enrollment', async () => {
  await expect(startPlan(3, '2026-10-29')).resolves.toEqual({ id: 1 });
  expect(signalReminders.mock.calls).toEqual([['planChanged']]);
});

test('workoutApi.completeWorkout → workoutFinished', async () => {
  await expect(completeWorkout(5)).resolves.toEqual({ enrollment: { id: 1 }, ok: true });
  expect(signalReminders.mock.calls).toEqual([['workoutFinished']]);
});

test('a failed call signals nothing', async () => {
  apiClient.post.mockImplementation(() => Promise.reject(new Error('500')));
  apiClient.put.mockImplementation(() => Promise.reject(new Error('500')));
  await expect(completeWorkout(5)).rejects.toThrow('500');
  await expect(replaceSchedule(31, [])).rejects.toThrow('500');
  expect(signalReminders).not.toHaveBeenCalled();
});

test('reads and other workout calls signal nothing', async () => {
  await getCurrentPlan();
  await startWorkout({});
  await abandonWorkout(5);
  expect(signalReminders).not.toHaveBeenCalled();
});
