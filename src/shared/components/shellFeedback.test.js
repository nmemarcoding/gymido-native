import RouteErrorBoundary from './RouteErrorBoundary';
import { addToast, removeToast, useToastStore } from './toastStore';

jest.mock('expo', () => ({ reloadAppAsync: jest.fn() }));

describe('RouteErrorBoundary (§9.2)', () => {
  it('trips on a render error and reloads the app on demand', () => {
    expect(RouteErrorBoundary.getDerivedStateFromError(new Error('boom'))).toEqual({ hasError: true });
    const reload = jest.fn();
    const boundary = new RouteErrorBoundary({ reload });
    expect(boundary.state.hasError).toBe(false);
    boundary.reload();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe('toastStore (§8)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useToastStore.setState({ toasts: [] });
  });
  afterEach(() => jest.useRealTimers());

  it('stacks toasts and removes each after its duration', () => {
    jest.setSystemTime(1000);
    addToast('success', 'A');
    jest.setSystemTime(2000);
    const id = addToast('error', 'B', 'msg', 0);
    expect(useToastStore.getState().toasts.map((t) => t.title)).toEqual(['A', 'B']);
    jest.advanceTimersByTime(5000);
    expect(useToastStore.getState().toasts.map((t) => t.title)).toEqual(['B']);
    removeToast(id);
    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it('closes same-millisecond toasts together (⚠S5)', () => {
    jest.setSystemTime(3000);
    const id = addToast('info', 'A');
    addToast('info', 'B');
    removeToast(id);
    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it('defaults to the info tone', () => {
    addToast();
    expect(useToastStore.getState().toasts[0]).toMatchObject({ tone: 'info', title: '', message: '' });
  });
});
