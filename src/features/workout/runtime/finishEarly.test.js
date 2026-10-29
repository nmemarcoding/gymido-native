import { getPreference, setPreference } from '../../../shared/storage/preferences';
import {
  FINISH_EARLY_MESSAGES,
  LAST_MESSAGE_KEY,
  finishEarlyMessage,
  pickMessageIndex,
  readLastMessageIndex,
  resetFinishEarlyMemory,
  saveLastMessageIndex,
  setsLeftText,
} from './finishEarly';


jest.mock('../../../shared/storage/preferences', () => ({ getPreference: jest.fn(), setPreference: jest.fn() }));

// T-105 (UX ruling §2/§2a; RN-SPEC-workout dated 29 Oct 2026; web finishEarly.t105.test.js).
beforeEach(() => {
  jest.clearAllMocks();
  resetFinishEarlyMemory();
});

describe('messages', () => {
  it('the 10 final messages; emoji only on 1, 5, 6 and 7, always last', () => {
    expect(FINISH_EARLY_MESSAGES).toHaveLength(10);
    expect(FINISH_EARLY_MESSAGES.map((message) => message.emoji ?? null)).toEqual(['💪', null, null, null, '🏆', '👀', '🔥', null, null, null]);
  });

  it('{sets} = "1 set" / "{n} sets", {n} = the number; the SR label has no emoji', () => {
    expect(setsLeftText(1)).toBe('1 set');
    expect(setsLeftText(3)).toBe('3 sets');
    expect(finishEarlyMessage(1, 1)).toEqual({ text: 'Only 1 set left. Finish strong.', emoji: null, label: 'Only 1 set left. Finish strong.' });
    expect(finishEarlyMessage(0, 3)).toEqual({
      text: 'Leaving already? 3 sets to go. Future you will thank you.',
      emoji: '💪',
      label: 'Leaving already? 3 sets to go. Future you will thank you.',
    });
    expect(finishEarlyMessage(4, 2).text).toBe('Every set counts. 2 more and today is a win.');
    expect(finishEarlyMessage(3, 14).text).toBe("You started, and that's the hard part. 14 sets left, you've got this.");
  });
});

describe('rotation', () => {
  it('never repeats the last index; any index without one', () => {
    for (let last = 0; last < 10; last += 1) {
      for (const r of [0, 0.25, 0.5, 0.75, 0.9999]) {
        const pick = pickMessageIndex(last, () => r);
        expect(pick).not.toBe(last);
        expect(pick).toBeGreaterThanOrEqual(0);
        expect(pick).toBeLessThan(10);
      }
    }
    expect(pickMessageIndex(null, () => 0)).toBe(0);
    expect(pickMessageIndex(null, () => 0.9999)).toBe(9);
    expect(pickMessageIndex(3, () => 0)).toBe(0);
    expect(pickMessageIndex(0, () => 0)).toBe(1);
  });

  it('the last index is kept on the device; a storage failure keeps it in memory', async () => {
    getPreference.mockResolvedValueOnce('4');
    expect(await readLastMessageIndex()).toBe(4);
    saveLastMessageIndex(7);
    expect(setPreference).toHaveBeenCalledWith(LAST_MESSAGE_KEY, '7');
    getPreference.mockResolvedValueOnce(null);
    expect(await readLastMessageIndex()).toBe(7);
    expect(LAST_MESSAGE_KEY).toBe('gymido.finishEarly.lastMessage');
  });
});
