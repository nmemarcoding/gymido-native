import { Text } from 'react-native';
import TestRenderer from 'react-test-renderer';

import PillButton from './PillButton';

function labelOf(element) {
  let renderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer.root.findByType(Text);
}

describe('button labels on Android', () => {
  it.each([
    ['PillButton', <PillButton key="pill" title="Add weight" onPress={() => {}} />],
    ['PillButton small', <PillButton key="pill-small" title="Add weight" size="small" onPress={() => {}} />],
  ])('%s label stays on one line with simple breaking', (_name, element) => {
    const label = labelOf(element);
    expect(label.props.textBreakStrategy).toBe('simple');
  });
});
