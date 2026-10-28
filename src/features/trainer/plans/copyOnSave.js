// T-78 (owner bug, 28 Oct 2026; RN-SPEC-TRAINER-PLANS C10, web 71fe6f83): a
// plan copy is created only on "Save copy" in the "Name your copy" dialog.
// Save = (1) the copy POST, (2) only if a field changed, a PATCH of the NEW
// copy with the changed fields, (3) the caller opens the copy. A failed
// PATCH deletes the copy at once, so nothing is left behind and the dialog
// can Save again (POST + PATCH); only a failed DELETE leaves the copy, and
// the caller then opens it. No new endpoints: each actor's copy, update and
// delete routes.

import { getStatus } from '../../../shared/api/apiError';

export const COPY_DIALOG_TITLE = 'Name your copy';
export const COPY_SAVE_LABEL = 'Save copy';
export const COPY_SAVE_FAILED_TITLE = 'Could not save your copy';
export const COPY_KEPT_TITLE = 'Copied, but the details didn’t save';
export const COPY_KEPT_MESSAGE = 'Your copy is open: edit its details to try again.';

const hasId = (id) => !(id === undefined || id === null || id === '');

// Resolves to one outcome, never throws:
//   { kind: 'copyFailed', error }   the POST failed; nothing exists
//   { kind: 'noId' }                a 201 without a plan id (T-16)
//   { kind: 'copied', id }          done (patched when something changed)
//   { kind: 'patchFailed', error }  the PATCH failed and the copy is deleted
//   { kind: 'kept', id }            the PATCH and the DELETE both failed
export async function saveCopy({ copy, writesFor, changes = {} }) {
  let created;
  try {
    created = await copy();
  } catch (error) {
    return { kind: 'copyFailed', error };
  }
  if (!hasId(created?.id)) {
    return { kind: 'noId' };
  }
  const id = created.id;
  if (Object.keys(changes).length === 0) {
    return { kind: 'copied', id };
  }
  const writes = writesFor(id);
  try {
    await writes.updatePlan(changes);
    return { kind: 'copied', id };
  } catch (error) {
    try {
      await writes.deletePlan();
    } catch {
      return { kind: 'kept', id };
    }
    return { kind: 'patchFailed', error };
  }
}

const PLAN_FIELDS = ['name', 'category_id', 'days_per_week', 'difficulty_level_id', 'description'];

// A 422 with `errors` → the plan form's field errors (⚠B-2: keys other than
// the five fields show nowhere); anything else → null. Edit details and
// "Name your copy" both use it.
export function planFieldErrors(error) {
  const serverErrors = error?.response?.data?.errors;
  if (getStatus(error) !== 422 || !serverErrors || typeof serverErrors !== 'object') {
    return null;
  }
  const fieldErrors = {};
  for (const field of PLAN_FIELDS) {
    const messages = serverErrors[field];
    if (Array.isArray(messages) && messages.length > 0) {
      fieldErrors[field] = messages[0];
    }
  }
  return fieldErrors;
}
