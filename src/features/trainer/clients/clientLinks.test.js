import { Dimensions } from 'react-native';

import { openAssignPlan, openClientDetail } from './clientLinks';

// T-55: on a tablet window (≥ 768) a link to a client opens the Clients
// master/detail with that client selected (`selected`, web ?client=), popping
// back to the list if C2 is on top. Phones keep the v1 push of C2 on C1.
const mockNavigate = jest.fn();
jest.mock('../../../navigation/navigationRef', () => ({
  navigationRef: { isReady: () => true, navigate: (...args) => mockNavigate(...args) },
}));

function setWidth(width) {
  jest.spyOn(Dimensions, 'get').mockReturnValue({ width, height: 1000, scale: 2, fontScale: 1 });
}

afterEach(() => {
  jest.restoreAllMocks();
  mockNavigate.mockClear();
});

describe('openClientDetail', () => {
  it('phone: pushes C2 on C1 (unchanged)', () => {
    setWidth(390);
    openClientDetail(7);
    expect(mockNavigate).toHaveBeenCalledWith('AppShell', {
      screen: 'TClients',
      params: { screen: 'TrainerClient', params: { clientUserId: 7 }, initial: false },
    });
  });

  it.each([768, 834, 1194, 1366])('tablet %i: the list with the client selected, popping back to it', (width) => {
    setWidth(width);
    openClientDetail(7);
    expect(mockNavigate).toHaveBeenCalledWith('AppShell', {
      screen: 'TClients',
      params: { screen: 'TrainerClients', params: { selected: '7' }, pop: true },
    });
  });
});

describe('openAssignPlan (unchanged at every width)', () => {
  it('opens T1 in assign mode', () => {
    setWidth(834);
    openAssignPlan(7);
    expect(mockNavigate).toHaveBeenCalledWith('AppShell', {
      screen: 'TPlans',
      params: { screen: 'TrainerPlans', params: { assignTo: '7' } },
    });
  });
});
