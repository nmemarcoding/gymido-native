export const PLANS_SUBTITLE = 'Your plans and the public catalog. Copy a catalog plan to change it.';

// T-121 H1 (web 2.1.10): "Your plans" = pool plans missing from the public
// catalog (GET /plans hides private plans from non-admins); the rest is the
// "Catalog". An admin's /plans lists every plan, so the split can't work for
// them: one list (`split` false, everything in `catalog`), the safe side.
export function splitPlans({ pool, catalog, admin = false }) {
  if (admin || !catalog) {
    return { split: false, own: [], catalog: pool };
  }
  const publicIds = new Set(catalog.map((plan) => String(plan.id)));
  return {
    split: true,
    own: pool.filter((plan) => !publicIds.has(String(plan.id))),
    catalog: pool.filter((plan) => publicIds.has(String(plan.id))),
  };
}

// Client-side name search over everything loaded (case-insensitive, trimmed).
export function matchesPlanName(plan, query) {
  const needle = query.trim().toLowerCase();
  return !needle || String(plan?.name ?? '').toLowerCase().includes(needle);
}
