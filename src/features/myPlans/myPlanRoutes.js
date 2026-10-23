import { routes } from '../../navigation/routes';

// Route names for My plans (RN-SPEC-MEMBER-PLANS §M0).
export const myPlanRoutes = Object.freeze({
  MyPlans: routes.MyPlans, // /plans/mine
  MyPlanCreate: routes.MyPlanCreate, // /plans/mine/new
  MyPlan: routes.MyPlan, // /plans/mine/:planId
  PlanGenerator: routes.PlanGenerator, // /plans/generate
});
