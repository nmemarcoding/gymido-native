import { acceptErrorMessage, coachingStatus, deriveHub, trainerDisplayName, trainerInitials } from './myTrainerFormat';

describe('trainerDisplayName', () => {
  // T-64 (27 Oct 2026, PM): the email's local part is no longer a fallback.
  it('uses the display name, else "Trainer" (never the email local part, T-64)', () => {
    expect(trainerDisplayName({ display_name: '  Asad  ', email: 'a@x.com' })).toBe('Asad');
    expect(trainerDisplayName({ display_name: ' ', email: ' coach@x.com' })).toBe('Trainer');
    expect(trainerDisplayName({ email: 'coach@x.com' })).toBe('Trainer');
    expect(trainerDisplayName({ email: '@x.com' })).toBe('Trainer');
    expect(trainerDisplayName(null)).toBe('Trainer');
  });
});

describe('trainerInitials (T-64)', () => {
  it('initials only from the display name (an address-shaped one drops its domain), else the neutral "T"', () => {
    expect(trainerInitials({ display_name: 'Alex Kim', email: 'zz@x.com' })).toBe('AK');
    expect(trainerInitials({ display_name: 'sara.lopez@example.com' })).toBe('SL');
    expect(trainerInitials({ display_name: '  ', email: 'coach@x.com' })).toBe('T');
    expect(trainerInitials({ email: 'coach@x.com' })).toBe('T');
    expect(trainerInitials(null)).toBe('T');
  });
});

describe('coachingStatus (Profile P1.3 2a)', () => {
  it('names an active trainer', () => {
    expect(coachingStatus({ relationship: { status: 'active' }, trainer: { display_name: 'Asad' } }, [])).toBe('Coached by Asad');
    // T-64: the Profile coaching card never shows part of the address.
    expect(coachingStatus({ relationship: { status: 'active' }, trainer: { email: 'coach@x.com' } }, [])).toBe('Coached by Trainer');
  });

  it('counts only invitations sent by a trainer', () => {
    const none = { relationship: null, trainer: null };
    expect(coachingStatus(none, [])).toBe('No trainer yet');
    expect(coachingStatus(none, [{ requested_by: 'trainer' }, { requested_by: 'member' }])).toBe('No trainer yet · 1 invitation');
    expect(coachingStatus(none, [{ requested_by: 'trainer' }, { requested_by: 'trainer' }])).toBe('No trainer yet · 2 invitations');
  });
});

describe('deriveHub (MT1.2–MT1.3 + Batch B)', () => {
  const invite = { status: 'pending', requested_by: 'trainer' };
  const request = { status: 'pending', requested_by: 'client' };

  it('orders the blocks for a member with no coach, invitations first', () => {
    expect(deriveHub({ relationship: null, trainer: null, requests: [invite, request], isTrainer: false }).blocks).toEqual([
      'invitations',
      'empty',
      'outgoing',
      'findTrainer',
      'becomeTrainer',
    ]);
  });

  it('shows the coach and links for a member with a coach', () => {
    const hub = deriveHub({ relationship: { status: 'active' }, trainer: { display_name: 'Asad' }, requests: [], isTrainer: false });
    expect(hub.blocks).toEqual(['activeTrainer', 'links', 'becomeTrainer']);
    expect(hub.trainerName).toBe('Asad');
  });

  it('gives trainers the links but never the find/apply cards (⚠MT-6)', () => {
    expect(deriveHub({ relationship: null, trainer: null, requests: [], isTrainer: true }).blocks).toEqual(['trainerMode', 'links']);
    expect(deriveHub({ relationship: { status: 'active' }, trainer: null, requests: [], isTrainer: true }).blocks).toEqual([
      'trainerMode',
      'activeTrainer',
      'links',
    ]);
  });

  it('ignores a relationship that is not active (⚠MT-8) and names a missing trainer by id', () => {
    const hub = deriveHub({ relationship: { status: 'ended', trainer_user_id: 7 }, trainer: null, requests: [], isTrainer: false });
    expect(hub.hasActiveTrainer).toBe(false);
    expect(hub.trainerName).toBe('Trainer #7');
  });
});

describe('acceptErrorMessage (MT1.6)', () => {
  it('uses the server message on 409 and fixed copy otherwise', () => {
    expect(acceptErrorMessage(409, 'End your current trainer first')).toBe('End your current trainer first');
    expect(acceptErrorMessage(404, 'x')).toBe('That request is no longer available.');
    expect(acceptErrorMessage(500, 'x')).toBe('We could not accept that request. Please try again.');
  });
});
