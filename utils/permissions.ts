import { User } from "../types";

export type AppRole = "member" | "org_admin" | "super_admin";

export const GLOBAL_ADMIN_TABS = [
  "super-admin",
  "sa-organizations",
  "sa-telemetry",
  "sa-broadcast",
  "sa-billing",
  "sa-users",
  "sa-support",
  "sa-audit",
  "sa-quotas",
] as const;

export const ORGANIZATION_ADMIN_TABS = [
  "schedule-editor",
  "monthly-report",
  "repertoire-manager",
  "report",
  "event-rules",
  "schedule-rules",
  "send-announcements",
  "members",
  "advanced-ai",
  "support-admin",
  "plan",
] as const;

const isValidScopeId = (value?: string | null) =>
  Boolean(value && value !== "undefined" && value !== "null");

/**
 * Resolves the application role with superadmin precedence. The legacy
 * `access_role=admin` is treated as local administration only; it never
 * grants access to the global platform shell.
 */
export const getAppRole = (user?: User | null): AppRole => {
  if (user?.isSuperAdmin) return "super_admin";
  if (user?.isOrgAdmin || user?.access_role === "admin") return "org_admin";
  return "member";
};

export const isSuperAdmin = (user?: User | null) =>
  getAppRole(user) === "super_admin";

export const isOrganizationAdmin = (user?: User | null) =>
  getAppRole(user) === "org_admin";

export const hasOrganizationScope = (user?: User | null) =>
  isValidScopeId(user?.organizationId);

export const canAccessGlobalTab = (user: User | null | undefined, tab: string) =>
  isSuperAdmin(user) && (GLOBAL_ADMIN_TABS as readonly string[]).includes(tab);

export const canManageOrganization = (user?: User | null) =>
  isOrganizationAdmin(user) && hasOrganizationScope(user);

export const canAccessOrganizationTab = (
  user: User | null | undefined,
  tab: string,
  enabledTabs: string[] = [],
) => {
  const role = getAppRole(user);
  if (role === "super_admin") return false;
  if (role === "org_admin" && !hasOrganizationScope(user)) return false;
  if ((ORGANIZATION_ADMIN_TABS as readonly string[]).includes(tab)) {
    return role === "org_admin" && (enabledTabs.includes(tab) || tab === "plan");
  }
  return enabledTabs.includes(tab) || [
    "dashboard",
    "my-schedule",
    "pending-center",
    "history",
  ].includes(tab);
};

export const getRoleLabel = (user?: User | null) => {
  switch (getAppRole(user)) {
    case "super_admin":
      return "Super Admin Global";
    case "org_admin":
      return "Administrador";
    default:
      return "Membro";
  }
};
