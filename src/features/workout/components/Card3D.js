import { CardSurface } from '../../../shared/components/Card';

// v1's `card-3d` (lift shadow, inset ring, top sheen) is retired in v2
// (RN-SPEC-v2-foundation §3, §4.8). Card3D keeps its props and call sites and
// now renders the v2 card surface: color-surface, 1 px hairline, radius 24,
// no shadow. `hero` (optional, set at mount) draws gradient-card at radius 28.
export default function Card3D({ style, children, testID, hero = false }) {
  return (
    <CardSurface testID={testID} hero={hero} style={style}>
      {children}
    </CardSurface>
  );
}
