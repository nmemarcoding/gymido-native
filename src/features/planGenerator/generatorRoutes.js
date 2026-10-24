import { routes } from '../../navigation/routes';

// Route names and web paths for G1 and G2 (RN-SPEC-PLAN-GENERATOR §G0),
// both pushed on the Plans stack.
export const generatorRoutes = Object.freeze({
  PlanGenerator: routes.PlanGenerator,
  PlanGeneratorPreview: routes.PlanGeneratorPreview,
});

export const generatorPaths = Object.freeze({
  PlanGenerator: '/plans/generate',
  PlanGeneratorPreview: '/plans/generate/preview',
});
