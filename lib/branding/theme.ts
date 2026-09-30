/**
 * Per-company brand theme. Only color is swappable per business — typography
 * (Geist, app-wide) and semantic status colors (positive/caution/danger,
 * defined directly in components via Tailwind's fixed palette, not here) stay
 * constant across every tenant so the product reads consistently regardless
 * of whose brand is active. Multi-business itself is out of scope (see
 * CLAUDE.md) — this only keeps a future client's color a config change
 * instead of a rewrite. See docs/spec/brand.md.
 */
export interface BrandTheme {
  businessId: string;
  colors: {
    background: string;
    foreground: string;
    card: string;
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    muted: string;
    mutedForeground: string;
    accent: string;
    accentForeground: string;
    border: string;
    input: string;
    ring: string;
  };
}

/** Mario's Coffee — "Espresso & Ink": warm espresso ink on cream, copper accent. */
const mariosCoffeeTheme: BrandTheme = {
  businessId: "marios-coffee",
  colors: {
    background: "#FAF6F0",
    foreground: "#2B1B12",
    card: "#FFFFFF",
    primary: "#4A2C1D",
    primaryForeground: "#FAF6F0",
    secondary: "#F3E2CE",
    secondaryForeground: "#4A2C1D",
    muted: "#F3EEE5",
    mutedForeground: "#7A6A5C",
    accent: "#C4702B",
    accentForeground: "#FAF6F0",
    border: "#E8DFD3",
    input: "#E8DFD3",
    ring: "#C4702B",
  },
};

const THEMES_BY_BUSINESS_ID: Record<string, BrandTheme> = {
  [mariosCoffeeTheme.businessId]: mariosCoffeeTheme,
};

const DEFAULT_THEME = mariosCoffeeTheme;

/** Falls back to the default theme for an unrecognized business — never unstyled. */
export function getBrandTheme(businessId: string): BrandTheme {
  return THEMES_BY_BUSINESS_ID[businessId] ?? DEFAULT_THEME;
}

/**
 * CSS custom properties for a theme, keyed to match the token names declared
 * in app/globals.css. React's CSSProperties type doesn't model arbitrary
 * custom properties, hence the cast at the call site.
 */
export function brandThemeCssVars(theme: BrandTheme): Record<string, string> {
  const c = theme.colors;
  return {
    "--background": c.background,
    "--foreground": c.foreground,
    "--card": c.card,
    "--card-foreground": c.foreground,
    "--popover": c.card,
    "--popover-foreground": c.foreground,
    "--primary": c.primary,
    "--primary-foreground": c.primaryForeground,
    "--secondary": c.secondary,
    "--secondary-foreground": c.secondaryForeground,
    "--muted": c.muted,
    "--muted-foreground": c.mutedForeground,
    "--accent": c.accent,
    "--accent-foreground": c.accentForeground,
    "--border": c.border,
    "--input": c.input,
    "--ring": c.ring,
  };
}
