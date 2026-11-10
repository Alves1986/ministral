export type PlanType = "trial" | "pro" | "enterprise";

export const PLAN_LIMITS: Record<PlanType, {
  ministries: number;
  membersPerMinistry: number;
  aiWeeklyLimit: number;
  aiAllowedModels: "basic" | "all";
}> = {
  trial: {
    ministries: 2,
    membersPerMinistry: 30,
    aiWeeklyLimit: 25,
    aiAllowedModels: "basic",
  },
  pro: {
    ministries: 3,
    membersPerMinistry: 50,
    aiWeeklyLimit: 150,
    aiAllowedModels: "all",
  },
  enterprise: {
    ministries: Infinity,
    membersPerMinistry: Infinity,
    aiWeeklyLimit: Infinity,
    aiAllowedModels: "all",
  },
};

export const FULL_ACCESS_TABS = [
  "repertoire",
  "schedule-rules",
  "monthly-report",
  "report",
  "advanced-ai",
] as const;

export function getPlanType(value?: string | null): PlanType {
  if (value === "pro" || value === "enterprise") return value;
  return "trial";
}

export function getPlanLimits(value?: string | null) {
  return PLAN_LIMITS[getPlanType(value)];
}

export function canUseFullOperationalFeatures(value?: string | null): boolean {
  // O Trial é uma experiência completa por tempo limitado; os limites são de volume.
  return true;
}
