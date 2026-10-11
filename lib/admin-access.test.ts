import { describe, expect, it } from "vitest";

import { canViewWaitlistAdmin } from "./admin-access";

const base = {
  configuredSecret: undefined,
  providedSecret: undefined,
  isProduction: false,
  isDemoOwner: false,
};

describe("canViewWaitlistAdmin", () => {
  it("grants access with the matching secret", () => {
    expect(
      canViewWaitlistAdmin({
        ...base,
        configuredSecret: "s3cret",
        providedSecret: "s3cret",
        isProduction: true,
      }),
    ).toBe(true);
  });

  it("denies a wrong or missing secret, even for the demo owner", () => {
    for (const providedSecret of ["nope", "s3cre", undefined]) {
      expect(
        canViewWaitlistAdmin({
          ...base,
          configuredSecret: "s3cret",
          providedSecret,
          isDemoOwner: true,
        }),
      ).toBe(false);
    }
  });

  it("allows the demo-owner fallback in development when no secret is set", () => {
    expect(canViewWaitlistAdmin({ ...base, isDemoOwner: true })).toBe(true);
  });

  it("fails closed in production when no secret is configured", () => {
    expect(
      canViewWaitlistAdmin({ ...base, isProduction: true, isDemoOwner: true }),
    ).toBe(false);
  });
});
