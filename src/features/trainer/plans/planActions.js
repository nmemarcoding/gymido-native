import { exerciseName } from './planFormat';

// The confirmed actions of the plan screen (spec §B4).
export const PlanAction = Object.freeze({
  deactivatePlan: 'deactivatePlan',
  deactivateRefused: 'deactivateRefused',
  deletePlan: 'deletePlan',
  deleteDay: 'deleteDay',
  deleteExercise: 'deleteExercise',
  deleteSet: 'deleteSet',
});

// The B4 table: title, description, confirm label and tone per action. The
// adapter's `text` supplies the descriptions that differ per audience (C6).
export function getActionCopy(action, text = {}) {
  switch (action.type) {
    case PlanAction.deactivatePlan:
      return {
        title: 'Deactivate this plan?',
        description: text.deactivateDescription,
        confirmLabel: 'Deactivate plan',
        tone: 'primary',
      };
    case PlanAction.deactivateRefused:
      return {
        title: 'This plan can’t be deleted',
        description: text.refusedDeleteDescription,
        confirmLabel: 'Deactivate plan',
        tone: 'primary',
      };
    case PlanAction.deletePlan:
      return {
        title: 'Delete this plan?',
        description: 'This removes the plan with all its days, exercises and sets. It can’t be undone.',
        confirmLabel: 'Delete plan',
        tone: 'danger',
      };
    case PlanAction.deleteDay:
      return {
        title: `Delete Day ${action.day.day_number}?`,
        description: 'This removes the day with its exercises and sets. It can’t be undone.',
        confirmLabel: 'Delete day',
        tone: 'danger',
      };
    case PlanAction.deleteExercise:
      return {
        title: `Remove ${exerciseName(action.exercise)}?`,
        description: 'This removes the exercise and its sets from this day.',
        confirmLabel: 'Remove exercise',
        tone: 'danger',
      };
    case PlanAction.deleteSet:
      return {
        title: `Delete set ${action.set.set_number}?`,
        description: `This removes set ${action.set.set_number} from ${exerciseName(action.exercise)}.`,
        confirmLabel: 'Delete set',
        tone: 'danger',
      };
    default:
      return { title: '', description: '', confirmLabel: '', tone: 'danger' };
  }
}
