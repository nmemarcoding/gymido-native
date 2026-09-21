import { apiClient } from '../shared/api/client';

// Routes apiClient calls to handlers keyed "METHOD /path", records every
// request, and wraps results in the backend envelope { success, data }
// (RN-SPEC-plans §6.1). A handler returns the `data` payload, a
// `respond(status, data)` object, or throws an httpError / networkError.
//
// Handlers can be a value, a function (called with { body, calls }), or an
// array consumed one entry per call (the last entry repeats).

export function httpError(status, body) {
  const error = new Error(`Request failed with status code ${status}`);
  error.isAxiosError = true;
  error.response = { status, data: body };
  return error;
}

export function networkError(message = 'Network Error') {
  const error = new Error(message);
  error.isAxiosError = true;
  return error;
}

export function respond(status, data) {
  return { __respond: true, status, data };
}

export function mockApi(handlers) {
  const calls = [];
  const queues = {};

  const resolveHandler = (key) => {
    const handler = handlers[key];
    if (Array.isArray(handler)) {
      queues[key] = queues[key] ?? 0;
      const entry = handler[Math.min(queues[key], handler.length - 1)];
      queues[key] += 1;
      return entry;
    }
    return handler;
  };

  const dispatch = (method) =>
    jest.fn(async (url, bodyOrConfig) => {
      const body = method === 'GET' ? undefined : bodyOrConfig;
      const key = `${method} ${url}`;
      calls.push({ method, url, body });
      if (!(key in handlers)) {
        throw new Error(`Unexpected request: ${key}`);
      }
      let result = resolveHandler(key);
      if (typeof result === 'function') {
        result = await result({ body, calls });
      }
      if (result instanceof Error) {
        throw result;
      }
      const status = result?.__respond ? result.status : method === 'POST' ? 201 : 200;
      const data = result?.__respond ? result.data : result;
      return { status, data: { success: true, message: 'ok', data }, headers: {}, config: { method } };
    });

  jest.spyOn(apiClient, 'get').mockImplementation(dispatch('GET'));
  jest.spyOn(apiClient, 'post').mockImplementation(dispatch('POST'));
  jest.spyOn(apiClient, 'put').mockImplementation(dispatch('PUT'));

  return {
    calls,
    // Requests after the initial loads, e.g. the submit flow.
    mutations: () => calls.filter((call) => call.method !== 'GET'),
    count: (method, url) => calls.filter((call) => call.method === method && call.url === url).length,
  };
}
