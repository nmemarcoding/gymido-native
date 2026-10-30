import { Dimensions } from 'react-native';

import { openAssignPlan, openClientDetail, openClientSelection } from './clientLinks';

// T-55 (t55m: merged onto Phase 6): on a tablet window (≥ 768) the Plans
// "Back to client" link opens the Clients master/detail with that client
// selected (`client`, web ?client=), popping back to the list if C2 is on top.
// Phones keep the v1 push of C2 on C1. openClientDetail keeps P6's push.
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

describe('openClientDetail (Phase 6 wins: pushes C2 at every width; tablet shows the P6 tablet page)', () => {
  it('phone: pushes C2 on C1 (unchanged)', () => {
    setWidth(390);
    openClientDetail(7);
    expect(mockNavigate).toHaveBeenCalledWith('AppShell', {
      screen: 'TClients',
      params: { screen: 'TrainerClient', params: { clientUserId: 7 }, initial: false },
    });
  });

  it.each([768, 834, 1194, 1366])('tablet %i: still the C2 push (Today "View →" opens the P6 tablet page), activity rides along', (width) => {
    setWidth(width);
    openClientDetail(7, { week: null });
    expect(mockNavigate).toHaveBeenCalledWith('AppShell', {
      screen: 'TClients',
      params: { screen: 'TrainerClient', params: { clientUserId: 7, clientActivity: { week: null } }, initial: false },
    });
  });
});

// T-55 + RN-SPEC-TRAINER-CLIENTS 07c6d708: "Change plan" → the trainer Plans
// screen → "← Back to client #N" returns to the tablet master/detail with that
// client selected (`client`, web ?client=), popping back to the list.
describe('openClientSelection', () => {
  it('phone: pushes C2 on C1 (as openClientDetail)', () => {
    setWidth(390);
    openClientSelection(7);
    expect(mockNavigate).toHaveBeenCalledWith('AppShell', {
      screen: 'TClients',
      params: { screen: 'TrainerClient', params: { clientUserId: 7 }, initial: false },
    });
  });

  it.each([768, 834, 1194, 1366])('tablet %i: the list with the client selected, popping back to it', (width) => {
    setWidth(width);
    openClientSelection(7);
    expect(mockNavigate).toHaveBeenCalledWith('AppShell', {
      screen: 'TClients',
      params: { screen: 'TrainerClients', params: { client: '7' }, pop: true },
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

describe('T-121 M10: openAssignPlan carries the client name', () => {
  it('a real name rides along as assignName (trimmed); blank → no key (T1 falls back to "client #id")', () => {
    setWidth(390);
    openAssignPlan(7, '  Sara Lopez ');
    expect(mockNavigate).toHaveBeenLastCalledWith('AppShell', {
      screen: 'TPlans',
      params: { screen: 'TrainerPlans', params: { assignTo: '7', assignName: 'Sara Lopez' } },
    });
    openAssignPlan(7, '   ');
    expect(mockNavigate).toHaveBeenLastCalledWith('AppShell', {
      screen: 'TPlans',
      params: { screen: 'TrainerPlans', params: { assignTo: '7' } },
    });
  });
});
