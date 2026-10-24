import { apiClient } from '../../shared/api/client';
import {
  applicationBody,
  getMyTrainerApplication,
  getTrainer,
  listTrainers,
  requestCoaching,
  submitTrainerApplication,
} from './api/trainersApi';
import {
  APPLICATION_MAX_LENGTH,
  FORM_COPY,
  STATUS_SENTENCES,
  applicationErrorMessage,
  applicationView,
  clampPage,
  normalizePagination,
  pagerText,
  readTrainerList,
  requestErrorMessage,
  showsPager,
  trainersEmptyCopy,
} from './trainersFormat';

jest.mock('../../shared/api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
}));

const ok = (data) => ({ data: { data } });

beforeEach(() => jest.clearAllMocks());

describe('trainers API (§TR4)', () => {
  it('lists with exact params, omitting an empty search', async () => {
    apiClient.get.mockResolvedValue(ok({ items: [] }));
    await listTrainers({ page: 1, search: '' });
    expect(apiClient.get).toHaveBeenLastCalledWith('/trainers', { params: { page: 1, per_page: 20 } });
    await listTrainers({ page: 3, search: 'asad@' });
    expect(apiClient.get).toHaveBeenLastCalledWith('/trainers', { params: { page: 3, per_page: 20, search: 'asad@' } });
  });

  it('reads one trainer and posts a request with no body', async () => {
    apiClient.get.mockResolvedValue(ok({ trainer: { email: 'a@b.c' } }));
    expect(await getTrainer('7')).toEqual({ email: 'a@b.c' });
    expect(apiClient.get).toHaveBeenLastCalledWith('/trainers/7');
    apiClient.post.mockResolvedValue(ok({ relationship: { status: 'pending' } }));
    expect(await requestCoaching('7')).toEqual({ status: 'pending' });
    expect(apiClient.post).toHaveBeenLastCalledWith('/trainers/7/requests');
  });

  it('treats a missing application as null', async () => {
    apiClient.get.mockResolvedValue(ok({}));
    expect(await getMyTrainerApplication()).toBeNull();
    expect(apiClient.get).toHaveBeenLastCalledWith('/my-trainer-application');
  });

  it('sends {"message"} trimmed, or {} when empty', async () => {
    expect(applicationBody('  hi \n')).toEqual({ message: 'hi' });
    expect(applicationBody('   ')).toEqual({});
    apiClient.post.mockResolvedValue(ok({ application: { status: 'pending' } }));
    expect(await submitTrainerApplication('')).toEqual({ status: 'pending' });
    expect(apiClient.post).toHaveBeenLastCalledWith('/trainer-application', {});
  });
});

describe('TR1 list rules', () => {
  it('reads items and the nested pagination (⚠TR-1)', () => {
    expect(readTrainerList({ items: 'x', pagination: { page: 2, per_page: 20, total: 41, total_pages: 3 } }, 20)).toEqual({
      trainers: [],
      pagination: { currentPage: 2, totalPages: 3, totalRecords: 41, perPage: 20 },
    });
    expect(normalizePagination(undefined, 20)).toEqual({ currentPage: 1, totalPages: 1, totalRecords: 0, perPage: 20 });
  });

  it('shows the pager only above one page and clamps the page', () => {
    expect(showsPager({ totalPages: 0 })).toBe(false);
    expect(showsPager({ totalPages: 1 })).toBe(false);
    expect(showsPager({ totalPages: 2 })).toBe(true);
    expect(pagerText({ currentPage: 2, totalPages: 3, totalRecords: 41 })).toBe('Page 2 of 3 · 41 total');
    expect(clampPage(0, 3)).toBe(1);
    expect(clampPage(4, 3)).toBe(3);
    expect(clampPage(2, 0)).toBe(1);
  });

  it('picks the empty copy by search', () => {
    expect(trainersEmptyCopy('x')).toEqual({ title: 'No trainers match that search', message: 'Try a different search term.' });
    expect(trainersEmptyCopy('')).toEqual({
      title: 'No trainers yet',
      message: 'Trainers appear here once they set up their profile.',
    });
  });
});

describe('TR2 request errors', () => {
  it('maps 409 / 404 / other', () => {
    expect(requestErrorMessage(409, 'A request is already pending.')).toBe('A request is already pending.');
    expect(requestErrorMessage(404, 'x')).toBe('This trainer is no longer available.');
    expect(requestErrorMessage(500, 'x')).toBe('We could not send your request. Please try again.');
  });
});

describe('TR3 application rules', () => {
  const base = { isTrainer: false, loading: false, error: null, application: null };

  it('picks the first matching state', () => {
    expect(applicationView({ ...base, isTrainer: true, loading: true, error: 'x' })).toBe('alreadyTrainer');
    expect(applicationView({ ...base, loading: true })).toBe('loading');
    expect(applicationView({ ...base, error: 'boom' })).toBe('error');
    expect(applicationView(base)).toBe('form');
    expect(applicationView({ ...base, application: { status: 'rejected' } })).toBe('rejected');
    expect(applicationView({ ...base, application: { status: 'approved' } })).toBe('approved');
    expect(applicationView({ ...base, application: { status: 'pending' } })).toBe('pending');
    // ⚠TR-8
    expect(applicationView({ ...base, application: { status: 'weird' } })).toBe('pending');
  });

  it('maps submit errors and keeps the copy exact', () => {
    expect(applicationErrorMessage(409, 'You already have a pending application.')).toBe('You already have a pending application.');
    expect(applicationErrorMessage(422, 'x')).toBe('We could not submit your application. Please try again.');
    expect(APPLICATION_MAX_LENGTH).toBe(1000);
    expect(FORM_COPY.again.submit).toBe('Submit new application');
    expect(STATUS_SENTENCES.approved).toBe('You’ve been approved. Sign out and back in to activate your trainer tools.');
  });
});
