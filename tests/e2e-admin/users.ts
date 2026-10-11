/** Test accounts created by global-setup (local test backend only). */
export interface TestUser {
  email: string;
  password: string;
  name: string;
  /** Administrator profile state, or null for a plain Auth user. */
  profile: "active" | "inactive" | null;
}

export const USERS = {
  admin: {
    email: "admin.e2e@bsr.test",
    password: "Admin-e2e-2026",
    name: "Giulia Ferri",
    profile: "active",
  },
  second: {
    email: "second.e2e@bsr.test",
    password: "Second-e2e-2026",
    name: "Paolo Conti",
    profile: "active",
  },
  recovery: {
    email: "recovery.e2e@bsr.test",
    password: "Recovery-e2e-2026",
    name: "Sara Gallo",
    profile: "active",
  },
  inactive: {
    email: "inactive.e2e@bsr.test",
    password: "Inactive-e2e-2026",
    name: "Ex Admin",
    profile: "inactive",
  },
  user: {
    email: "user.e2e@bsr.test",
    password: "User-e2e-2026",
    name: "Plain User",
    profile: null,
  },
} satisfies Record<string, TestUser>;
