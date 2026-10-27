import { Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import { todayCard } from './home/homeFormat';
import { createdMessage, daysAWeekUnit, daysPillLabel, minutesPillLabel } from './planGenerator/generatorCopy';
import { daysSelectedLabel } from './plans/components/ScheduleSetupCard';
import { activePlanDaysLabel, planCardDaysLabel, workoutDaysLabel } from './plans/libraryFormat';
import PlanCard from './trainer/plans/components/PlanCard';
import { formatDaysPerWeek } from './trainer/plans/planFormat';
import { fullPlanMessage } from './trainer/plans/planValidation';
import { sheetSubtitle } from './workout/runtime/ExerciseNavigation';
import { shareSummaryText } from './workout/runtime/restPresentation';
import { trainingDaysLabel } from './workout/workoutFormat';

// RN-SPEC-v2-foundation §7.1 (dated changes 27 Oct 2026): singular day counts,
// U+00A0 between a number and day(s)/min on screen, raw names in share text.

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => ({ width: 390, height: 844, fontScale: 1, scale: 3 }) }));
jest.mock('../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));

const NAME = 'Get stronger · 3 days';
const SHOWN = 'Get stronger · 3 days';

function texts(root) {
  return root
    .findAllByType(Text)
    .map((node) => [].concat(node.props.children).filter((child) => typeof child === 'string').join(''))
    .filter(Boolean);
}

describe('plan names on screen', () => {
  it('a plan card shows "… 3 days" with U+00A0, and a 1-day plan reads "1 day / week"', () => {
    let tree;
    act(() => {
      tree = create(<PlanCard plan={{ id: 7, name: NAME, days_per_week: 1, category: { name: 'Strength' } }} onView={() => {}} />);
    });
    expect(texts(tree.root)).toEqual(expect.arrayContaining([SHOWN, '1 day / week']));
    expect(texts(tree.root)).not.toContain(NAME);
  });

  it('messages and subtitles that name a plan join its number and unit', () => {
    expect(createdMessage(NAME)).toBe(`${SHOWN} created.`);
    expect(sheetSubtitle(NAME, [{}, {}])).toMatch(/^Get stronger · 3 days · /);
  });

  it('the Share text keeps the raw name (no U+00A0)', () => {
    const text = shareSummaryText({ planName: NAME, durationSeconds: 60, totalVolume: 0, totalReps: 0, completedSets: 1, totalSets: 1 });
    expect(text.split('\n')[0]).toBe(`Workout complete: ${NAME}`);
    expect(text).not.toContain(' ');
  });
});

describe('day counts: the singular for exactly 1', () => {
  it.each([
    [formatDaysPerWeek({ days_per_week: 1 }), '1 day / week'],
    [planCardDaysLabel({ days_per_week: 1 }), '1 day / week'],
    [activePlanDaysLabel({ days_per_week: 1 }), '1 training day / week'],
    [workoutDaysLabel(1), '1 workout day'],
    [trainingDaysLabel(1), '1 training day'],
    [daysPillLabel(1), '1 day'],
    [daysAWeekUnit(1), ' day a week'],
    [daysAWeekUnit(3), ' days a week'],
    [minutesPillLabel(60), '60 min'],
    [daysSelectedLabel(0, 1), '0 of 1 day selected'],
    [todayCard({ today_status: { is_workout_day: true } }, 1).sub, "Choose the 1 day you'll train each week."],
    [fullPlanMessage(1), 'This plan already has its 1 day.'],
    [fullPlanMessage(3), 'This plan already has all 3 days.'],
    [fullPlanMessage(null), 'This plan already has all available days.'],
  ])('%j', (actual, expected) => {
    expect(actual).toBe(expected);
  });
});
