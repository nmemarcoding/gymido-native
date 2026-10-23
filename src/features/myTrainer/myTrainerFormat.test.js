import { coachingStatus, trainerDisplayName } from './myTrainerFormat';

describe('trainerDisplayName', () => {
  it('uses the display name, then the email local part, then "Trainer"', () => {
    expect(trainerDisplayName({ display_name: '  Asad  ', email: 'a@x.com' })).toBe('Asad');
    expect(trainerDisplayName({ display_name: ' ', email: ' coach@x.com' })).toBe('coach');
    expect(trainerDisplayName({ email: '@x.com' })).toBe('Trainer');
    expect(trainerDisplayName(null)).toBe('Trainer');
  });
});

describe('coachingStatus (Profile P1.3 2a)', () => {
  it('names an active trainer', () => {
    expect(coachingStatus({ relationship: { status: 'active' }, trainer: { display_name: 'Asad' } }, [])).toBe('Coached by Asad');
  });

  it('counts only invitations sent by a trainer', () => {
    const none = { relationship: null, trainer: null };
    expect(coachingStatus(none, [])).toBe('No trainer yet');
    expect(coachingStatus(none, [{ requested_by: 'trainer' }, { requested_by: 'member' }])).toBe('No trainer yet · 1 invitation');
    expect(coachingStatus(none, [{ requested_by: 'trainer' }, { requested_by: 'trainer' }])).toBe('No trainer yet · 2 invitations');
  });
});
