import { describe, expect, it } from "vitest";
import { z } from "zod";

import { mapZodFieldErrors } from "./field-errors";

const schema = z.object({
  name: z.string().min(1, "Name required"),
  email: z.string().email("Bad email"),
  note: z.string().max(5, "Too long"),
});

describe("mapZodFieldErrors", () => {
  it("maps each issue to its field, keeping the first message per field", () => {
    const result = schema.safeParse({ name: "", email: "x", note: "toolong" });
    if (result.success) throw new Error("expected failure");

    const errors = mapZodFieldErrors(result.error.issues, [
      "name",
      "email",
      "note",
    ] as const);

    expect(errors.name).toBe("Name required");
    expect(errors.email).toBe("Bad email");
    expect(errors.note).toBe("Too long");
  });

  it("ignores issues for fields not in the allowed list", () => {
    const result = schema.safeParse({ name: "", email: "x", note: "toolong" });
    if (result.success) throw new Error("expected failure");

    const errors = mapZodFieldErrors(result.error.issues, ["name"] as const);

    expect(errors.name).toBe("Name required");
    expect(Object.keys(errors)).toHaveLength(1);
  });

  it("returns an empty object when there are no issues", () => {
    expect(mapZodFieldErrors([], ["name"] as const)).toEqual({});
  });
});
