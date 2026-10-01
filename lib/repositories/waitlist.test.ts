import { describe, expect, it } from "vitest";

import { waitlistSignupInputSchema } from "@/lib/domain/types";
import { addWaitlistSignup, listWaitlistSignups } from "./waitlist";

describe("waitlistSignupInputSchema", () => {
  it("accepts a valid signup", () => {
    const result = waitlistSignupInputSchema.safeParse({
      name: "Sam",
      email: "sam@example.com",
      businessType: "Bakery",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = waitlistSignupInputSchema.safeParse({
      name: "Sam",
      email: "not-an-email",
      businessType: "Bakery",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a blank name", () => {
    const result = waitlistSignupInputSchema.safeParse({
      name: "  ",
      email: "sam@example.com",
      businessType: "Bakery",
    });
    expect(result.success).toBe(false);
  });
});

describe("addWaitlistSignup / listWaitlistSignups", () => {
  it("records a signup with a generated id and timestamp", () => {
    const before = listWaitlistSignups().length;
    const signup = addWaitlistSignup({
      name: "Sam",
      email: "sam@example.com",
      businessType: "Bakery",
    });

    expect(signup.id).toBeTruthy();
    expect(signup.createdAt).toBeTruthy();
    expect(listWaitlistSignups()).toHaveLength(before + 1);
    expect(listWaitlistSignups().at(-1)?.email).toBe("sam@example.com");
  });
});
