import { View } from 'react-native';
import { act, create } from 'react-test-renderer';

import { handOffToWorkout } from '../shell/shellLinks';
import { cancelEnrollment, getCurrentPlan, startPlan } from './api/myPlansApi';
import { useMemberStart } from './useMemberStart';

const mockNavigation = {
  push: jest.fn(),
  dispatch: jest.fn(),
  getState: () => ({ key: 'plans-stack', routes: [{ key: 'lib' }, { key: 'm3' }] }),
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ key: 'm3' }),
  CommonActions: { reset: (state) => ({ type: 'RESET', payload: state }) },
}));
jest.mock('../shell/shellLinks', () => ({ handOffToWorkout: jest.fn() }));
jest.mock('./api/myPlansApi', () => ({
  getCurrentPlan: jest.fn(),
  cancelEnrollment: jest.fn(),
  startPlan: jest.fn(),
}));
jest.mock('../../shared/components/toastStore', () => ({ ...jest.requireActual('../../shared/components/toastStore'),
  ToastTone: { success: 'success', error: 'error' },
  addToast: jest.fn(),
}));
jest.mock('../../shared/components/ConfirmDialog', () => (props) => {
  const { View: MockView } = require('react-native');
  return props.isOpen ? <MockView {...props} /> : null;
});

function Harness(props) {
  const { headerActions, banners, overlays } = useMemberStart(props);
  return (
    <View>
      {headerActions}
      {banners}
      {overlays}
    </View>
  );
}

const texts = (tree) =>
  tree.root
    .findAll((node) => node.type === 'Text')
    .map((node) => [].concat(node.props.children).filter((part) => typeof part === 'string').join(''));
const find = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.type !== 'string')[0];

async function render(props) {
  let tree;
  await act(async () => {
    tree = create(<Harness {...props} />);
  });
  return tree;
}

const plan = { id: 7, name: 'Strength', is_active: true };
const days = [{ id: 1 }];

beforeEach(() => jest.clearAllMocks());

describe('useMemberStart (§M3.4)', () => {
  it('shows the current-plan banner and no Start for the current plan', async () => {
    getCurrentPlan.mockResolvedValue({ enrollment: { id: 4, workout_plan_id: 7 }, schedule: null });
    const tree = await render({ planId: '7', plan, days });
    expect(find(tree, 'my-plan-start')).toBeUndefined();
    expect(texts(tree)).toEqual(expect.arrayContaining(['This is your current plan', 'Change training days']));
    await act(async () => find(tree, 'my-plan-change-days').props.onPress());
    expect(mockNavigation.push).toHaveBeenCalledWith('PlanDetail', { planId: '7' });
  });

  it('disables Start with a hint when the plan has no days', async () => {
    getCurrentPlan.mockRejectedValue({ response: { status: 404 } });
    const tree = await render({ planId: '7', plan, days: [] });
    expect(find(tree, 'my-plan-start').props.disabled).toBe(true);
    expect(texts(tree)).toContain('Add a day to start this plan.');
  });

  it('confirms a switch, cancels, enrols and hands off to Workout', async () => {
    getCurrentPlan.mockResolvedValue({ enrollment: { id: 4, workout_plan_id: 3 } });
    cancelEnrollment.mockResolvedValue({});
    startPlan.mockResolvedValue({ id: 9 });
    const tree = await render({ planId: '7', plan, days });
    await act(async () => find(tree, 'my-plan-start').props.onPress());
    const dialog = find(tree, 'my-plan-switch-dialog');
    expect(dialog.props.isOpen).toBe(true);
    expect(dialog.props.title).toBe('Switch to this plan?');
    expect(dialog.props.tone).toBe('primary');
    await act(async () => dialog.props.onConfirm());
    expect(cancelEnrollment).toHaveBeenCalledWith(4);
    expect(startPlan).toHaveBeenCalledWith('7', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    expect(handOffToWorkout).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'Strength activated.');
  });

  it('retries without cancelling again after a cancel went through but the enrol failed (W4)', async () => {
    getCurrentPlan.mockResolvedValue({ enrollment: { id: 4, workout_plan_id: 3 } });
    cancelEnrollment.mockResolvedValue({});
    startPlan.mockRejectedValueOnce({ response: { status: 500, data: { message: 'Server error' } } }).mockResolvedValueOnce({ id: 9 });
    const tree = await render({ planId: '7', plan, days });
    await act(async () => find(tree, 'my-plan-start').props.onPress());
    await act(async () => find(tree, 'my-plan-switch-dialog').props.onConfirm());
    expect(handOffToWorkout).not.toHaveBeenCalled();
    // Second press: no enrollment left, so no confirm and no second cancel.
    await act(async () => find(tree, 'my-plan-start').props.onPress());
    expect(find(tree, 'my-plan-switch-dialog').props.isOpen).toBe(false);
    expect(cancelEnrollment).toHaveBeenCalledTimes(1);
    expect(startPlan).toHaveBeenCalledTimes(2);
    expect(handOffToWorkout).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'Strength activated.');
  });

  it('starts at once with no current plan and keeps a 403 inline (⚠M-3)', async () => {
    getCurrentPlan.mockRejectedValue({ response: { status: 404 } });
    startPlan.mockRejectedValue({ response: { status: 403, data: { message: 'You have a trainer.' } } });
    const tree = await render({ planId: '7', plan, days });
    await act(async () => find(tree, 'my-plan-start').props.onPress());
    expect(find(tree, 'my-plan-switch-dialog').props.isOpen).toBe(false);
    expect(cancelEnrollment).not.toHaveBeenCalled();
    expect(texts(tree)).toEqual(
      expect.arrayContaining([
        'Could not start this plan',
        'You have a trainer. They’re kept safe and come back when coaching ends. Your trainer manages your training for now.',
      ])
    );
  });
});
