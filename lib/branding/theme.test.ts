import { describe, expect, it } from "vitest";

import { brandThemeCssVars, getBrandTheme } from "./theme";

describe("getBrandTheme", () => {
  it("returns Mario's Coffee's theme for its business id", () => {
    const theme = getBrandTheme("marios-coffee");
    expect(theme.colors.primary).toBe("#4A2C1D");
  });

  it("falls back to the default theme for an unrecognized business id — never unstyled", () => {
    const theme = getBrandTheme("some-future-client");
    expect(theme.businessId).toBe("marios-coffee");
  });
});

describe("brandThemeCssVars", () => {
  it("maps every theme color to its matching CSS custom property name", () => {
    const vars = brandThemeCssVars(getBrandTheme("marios-coffee"));
    expect(vars["--primary"]).toBe("#4A2C1D");
    expect(vars["--background"]).toBe("#FAF6F0");
    expect(vars["--accent"]).toBe("#C4702B");
    expect(Object.keys(vars)).toHaveLength(17);
  });
});
