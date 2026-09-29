import { render, screen } from '@testing-library/react-native';
import { readFileSync } from 'fs';
import path from 'path';

import GradientFill from '../GradientFill';

// RN-SPEC-workout §19.10.1. An SVG gradient's direction is its x1/y1/x2/y2,
// which no CSS angle string reaches, so it is pinned here.

// The first rendered node carrying a gradient vector.
function findVector(node) {
  if (!node || typeof node !== 'object') {
    return null;
  }
  if (Array.isArray(node)) {
    return node.map(findVector).find(Boolean) || null;
  }
  if (node.props && 'x2' in node.props && 'y2' in node.props && !('width' in node.props)) {
    const { x1, y1, x2, y2 } = node.props;
    return { x1, y1, x2, y2 };
  }
  return findVector(node.children);
}

const vectorOf = async (props) => {
  await render(<GradientFill id="g" width={112} height={48} colors={['#f7ce4f', '#f4b400']} {...props} />);
  return findVector(screen.toJSON());
};

describe('GradientFill direction', () => {
  it("'vertical' is `to bottom`", async () => {
    expect(await vectorOf({ direction: 'vertical' })).toEqual({ x1: '0', y1: '0', x2: '0', y2: '1' });
  });

  it("'diagonal' (the default) is the 135deg deviation", async () => {
    expect(await vectorOf({})).toEqual({ x1: '0', y1: '0', x2: '1', y2: '1' });
  });

  it('"Did it" draws vertical and the SetRow badge diagonal, as the web does', () => {
    const source = readFileSync(
      path.join(__dirname, '../../../features/workout/runtime/ExerciseStage.js'),
      'utf8'
    );
    const fill = (id) => source.slice(source.indexOf(`id={\`${id}-`), source.indexOf('/>', source.indexOf(`id={\`${id}-`)));
    expect(fill('set-action')).toContain('direction="vertical"');
    expect(fill('set-badge')).toContain('direction="diagonal"');
  });
});
