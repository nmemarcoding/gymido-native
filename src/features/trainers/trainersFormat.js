// Text and state rules of RN-SPEC-trainers.

// shared/api/apiHelpers normalizePagination: missing → page 1, 1 page, 0 total,
// the requested per_page.
export function normalizePagination(pagination, perPage) {
  const p = pagination ?? {};
  return {
    currentPage: p.page ?? 1,
    totalPages: p.total_pages ?? 1,
    totalRecords: p.total ?? 0,
    perPage: p.per_page ?? perPage,
  };
}

// TR1.1 step 3: `items` (not an array → []) and the nested pagination (⚠TR-1).
export function readTrainerList(body, perPage) {
  return {
    trainers: Array.isArray(body?.items) ? body.items : [],
    pagination: normalizePagination(body?.pagination, perPage),
  };
}

// TR1.4: shown only with more than one page (⚠TR-1).
export function showsPager(pagination) {
  return (pagination?.totalPages ?? 0) > 1;
}

export function pagerText({ currentPage, totalPages, totalRecords }) {
  return `Page ${currentPage} of ${totalPages} · ${totalRecords} total`;
}

export function clampPage(page, totalPages) {
  return Math.min(Math.max(page, 1), Math.max(1, totalPages));
}

export function trainersEmptyCopy(search) {
  return search
    ? { title: 'No trainers match that search', message: 'Try a different search term.' }
    : { title: 'No trainers yet', message: 'Trainers appear here once they set up their profile.' };
}

// TR2a failure toast message.
export function requestErrorMessage(status, serverMessage) {
  if (status === 409) {
    return serverMessage;
  }
  if (status === 404) {
    return 'This trainer is no longer available.';
  }
  return 'We could not send your request. Please try again.';
}

// TR3.4 failure message.
export function applicationErrorMessage(status, serverMessage) {
  return status === 409 ? serverMessage : 'We could not submit your application. Please try again.';
}

// TR3.2: the first matching body state.
export function applicationView({ isTrainer, loading, error, application }) {
  if (isTrainer) {
    return 'alreadyTrainer';
  }
  if (loading) {
    return 'loading';
  }
  if (error) {
    return 'error';
  }
  if (!application) {
    return 'form';
  }
  if (application.status === 'rejected') {
    return 'rejected';
  }
  if (application.status === 'approved') {
    return 'approved';
  }
  // ⚠TR-8: anything else reads as under review.
  return 'pending';
}

export const STATUS_SENTENCES = Object.freeze({
  rejected: 'This application wasn’t approved. You’re welcome to apply again below.',
  approved: 'You’ve been approved. Sign out and back in to activate your trainer tools.',
  pending: 'An admin is reviewing your application. We’ll let you know once it’s decided.',
});

export const FORM_COPY = Object.freeze({
  first: {
    heading: 'Apply to coach',
    blurb: 'Send an application and an admin will review it.',
    submit: 'Submit application',
  },
  again: {
    heading: 'Apply again',
    blurb: 'Your previous application stays on file as history.',
    submit: 'Submit new application',
  },
});

export const APPLICATION_MAX_LENGTH = 1000;
