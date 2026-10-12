import { describe, expect, it } from "vitest";
import { describeError } from "./log-error";

describe("describeError", () => {
  it("keeps name, message, code and stack", () => {
    const error = Object.assign(new Error("Request failed with status 401"), {
      code: "ERR_BAD_REQUEST",
    });
    expect(describeError(error)).toMatchObject({
      name: "Error",
      message: "Request failed with status 401",
      code: "ERR_BAD_REQUEST",
    });
  });

  it("drops request config, so an SDK error's auth header never reaches logs", () => {
    const axiosLike = Object.assign(new Error("Request failed"), {
      config: { headers: { Authorization: "Bearer TEST_API_KEY:secret" } },
      response: { data: { entitySecretCiphertext: "ciphertext" } },
    });
    const logged = JSON.stringify(describeError(axiosLike));
    expect(logged).not.toContain("TEST_API_KEY");
    expect(logged).not.toContain("ciphertext");
  });

  it("handles thrown non-Error values", () => {
    expect(describeError("boom")).toEqual({
      name: "NonError",
      message: "boom",
    });
  });
});
