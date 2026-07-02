import type { Role } from "./data/types";

/**
 * Route-level access policy (RBAC enforcement, not just nav hiding).
 * The first matching rule wins; routes with no rule are open to every signed-in role.
 * Keep this in sync with the nav `roles` in components/app-shell.tsx.
 */
const SALES: Role[] = ["super-admin", "manager", "agent"];

const ROUTE_ACCESS: { prefix: string; roles: Role[] }[] = [
  { prefix: "/clients", roles: ["super-admin"] },
  { prefix: "/team", roles: ["manager"] },
  { prefix: "/analytics", roles: ["super-admin", "manager"] },
  { prefix: "/settings", roles: ["manager"] }, // system/workflow config
  { prefix: "/inventory", roles: SALES },
  { prefix: "/pipeline", roles: SALES },
  { prefix: "/broadcast", roles: SALES },
  { prefix: "/meetings", roles: SALES },
  { prefix: "/approvals", roles: SALES },
  // open to all signed-in roles: /home, /leads, /worklist, /tasks, /concierge, /logistics, /buyers
];

export function canAccess(pathname: string, role: Role): boolean {
  const rule = ROUTE_ACCESS.find((r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"));
  return rule ? rule.roles.includes(role) : true;
}
