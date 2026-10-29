import { act, create } from 'react-test-renderer';

import { getServerHealth } from '../../shared/api/healthApi';
import AppVersionFooter from './AppVersionFooter';

jest.mock('../../shared/api/healthApi', () => ({ getServerHealth: jest.fn() }));

// T-90 + addendum: the app line from the config; the server line only once
// GET /health answers with a version (hidden while loading, on an error or
// when unreachable). Both selectable plain text with the SR label.
const CONFIG = { version: '2.0.8', ios: { buildNumber: '13' }, android: { versionCode: 13 } };
const hosts = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.type === 'string');

async function render(config = CONFIG) {
  let tree;
  await act(async () => {
    tree = create(<AppVersionFooter config={config} />);
  });
  return tree;
}

afterEach(() => jest.clearAllMocks());

describe('AppVersionFooter', () => {
  it('app line now; server line after /health; both selectable, labelled, not buttons', async () => {
    let resolve;
    getServerHealth.mockReturnValue(new Promise((done) => (resolve = done)));
    const tree = await render();
    const app = hosts(tree, 'app-version')[0];
    expect(app.props.children).toMatch(/^Version 2\.0\.8 \(13\)$/);
    expect(app.props.selectable).toBe(true);
    expect(app.props.accessibilityLabel).toBe('App version 2.0.8, build 13');
    expect(app.props.accessibilityRole).toBeUndefined();
    expect(app.props.onPress).toBeUndefined();
    // Loading: no server line.
    expect(hosts(tree, 'server-version')).toHaveLength(0);
    await act(async () => resolve({ version: '4.1.0', build: '8a12bd7' }));
    const server = hosts(tree, 'server-version')[0];
    expect(server.props.children).toBe('Server 8a12bd7');
    expect(server.props.selectable).toBe(true);
    expect(server.props.accessibilityLabel).toBe('Server build 8a12bd7');
    act(() => tree.unmount());
  });

  it('a failed / unreachable /health → no server line (no placeholder)', async () => {
    getServerHealth.mockRejectedValue(new Error('Network Error'));
    const tree = await render();
    expect(hosts(tree, 'app-version')).toHaveLength(1);
    expect(hosts(tree, 'server-version')).toHaveLength(0);
    act(() => tree.unmount());
  });

  it('a local "dev" build → no server line; no app version and no server → nothing', async () => {
    getServerHealth.mockResolvedValue({ version: '4.1.0', build: 'dev' });
    const tree = await render();
    expect(hosts(tree, 'app-version')).toHaveLength(1);
    expect(hosts(tree, 'server-version')).toHaveLength(0);
    act(() => tree.unmount());
    getServerHealth.mockResolvedValue(null);
    const empty = await render({});
    expect(hosts(empty, 'app-version-footer')).toHaveLength(0);
    act(() => empty.unmount());
  });
});
