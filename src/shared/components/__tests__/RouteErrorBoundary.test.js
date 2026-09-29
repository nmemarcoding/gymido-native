import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { DebugCrashProbe, requestRenderCrash, resetDebugCrashForTest } from '../../../dev/debugCrash';
import RouteErrorBoundary from '../RouteErrorBoundary';

// RN-SPEC-app-shell §9.2, mirroring the web's RouteErrorBoundary.test.jsx:
// children render when nothing throws; a throwing child shows "Something went
// wrong"; "Reload app" calls the reload. Plus: no automatic reset, and the
// debug crash toggle trips it.

function Thrower({ fail }) {
  if (fail) {
    throw new Error('render failed');
  }
  return <Text>Healthy</Text>;
}

let consoleError;
beforeEach(() => {
  // The boundary logs in development, and React reports the caught error.
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  resetDebugCrashForTest();
});
afterEach(() => consoleError.mockRestore());

describe('RouteErrorBoundary', () => {
  it('renders its children when nothing throws', async () => {
    await render(
      <RouteErrorBoundary reload={jest.fn()}>
        <Thrower fail={false} />
      </RouteErrorBoundary>
    );
    expect(screen.getByText('Healthy')).toBeOnTheScreen();
    expect(screen.queryByTestId('route-error-fallback')).not.toBeOnTheScreen();
  });

  it('replaces a crashing tree with the fallback, with the exact copy and nothing else', async () => {
    await render(
      <RouteErrorBoundary reload={jest.fn()}>
        <Thrower fail />
      </RouteErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeOnTheScreen();
    expect(screen.getByText('We hit a problem rendering this page. Reload the app to try again.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Reload app' })).toBeOnTheScreen();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(consoleError).toHaveBeenCalledWith('Route render failed', expect.any(Error));
  });

  it('"Reload app" calls the reload', async () => {
    const reload = jest.fn();
    await render(
      <RouteErrorBoundary reload={reload}>
        <Thrower fail />
      </RouteErrorBoundary>
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Reload app' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('never resets on its own: a healthy re-render stays on the fallback', async () => {
    const { rerender } = await render(
      <RouteErrorBoundary reload={jest.fn()}>
        <Thrower fail />
      </RouteErrorBoundary>
    );
    await rerender(
      <RouteErrorBoundary reload={jest.fn()}>
        <Thrower fail={false} />
      </RouteErrorBoundary>
    );
    expect(screen.getByTestId('route-error-fallback')).toBeOnTheScreen();
    expect(screen.queryByText('Healthy')).not.toBeOnTheScreen();
  });

  it('the debug crash toggle trips it', async () => {
    await render(
      <RouteErrorBoundary reload={jest.fn()}>
        <DebugCrashProbe />
        <Thrower fail={false} />
      </RouteErrorBoundary>
    );
    expect(screen.getByText('Healthy')).toBeOnTheScreen();
    await act(async () => requestRenderCrash());
    expect(screen.getByTestId('route-error-fallback')).toBeOnTheScreen();
  });
});
