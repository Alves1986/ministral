import { describe, expect, it } from "vitest";
import {
  canAccessGlobalTab,
  canAccessOrganizationTab,
  canManageOrganization,
  getAppRole,
} from "../utils/permissions";
import { User } from "../types";

const makeUser = (overrides: Partial<User> = {}): User => ({
  name: "Pessoa de teste",
  access_role: "member",
  organizationId: "org-1",
  ministryId: "ministry-1",
  ...overrides,
});

describe("separação de papéis", () => {
  it("mantém superadmin no escopo global e fora do menu da organização", () => {
    const user = makeUser({ isSuperAdmin: true, access_role: "admin" });

    expect(getAppRole(user)).toBe("super_admin");
    expect(canAccessGlobalTab(user, "sa-organizations")).toBe(true);
    expect(canAccessOrganizationTab(user, "members", ["members"])).toBe(false);
    expect(canManageOrganization(user)).toBe(false);
  });

  it("permite ao administrador local gerenciar somente sua organização", () => {
    const user = makeUser({ access_role: "admin", isOrgAdmin: true });

    expect(getAppRole(user)).toBe("org_admin");
    expect(canManageOrganization(user)).toBe(true);
    expect(canAccessOrganizationTab(user, "members", ["members"])).toBe(true);
    expect(canAccessGlobalTab(user, "sa-audit")).toBe(false);
  });

  it("mantém o membro nas áreas pessoais e fora das áreas administrativas", () => {
    const user = makeUser();

    expect(getAppRole(user)).toBe("member");
    expect(canAccessOrganizationTab(user, "my-schedule", ["my-schedule"])).toBe(true);
    expect(canAccessOrganizationTab(user, "pending-center", ["pending-center"])).toBe(true);
    expect(canAccessOrganizationTab(user, "members", ["members"])).toBe(false);
    expect(canAccessOrganizationTab(user, "plan", ["plan"])).toBe(false);
  });

  it("não concede administração local sem um escopo de organização", () => {
    const user = makeUser({ access_role: "admin", isOrgAdmin: true, organizationId: undefined });

    expect(getAppRole(user)).toBe("org_admin");
    expect(canManageOrganization(user)).toBe(false);
    expect(canAccessOrganizationTab(user, "members", ["members"])).toBe(false);
  });
});
