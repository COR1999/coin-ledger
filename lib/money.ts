/**
 * Money handling. All amounts are integer cents (euro minor units) internally;
 * decimal strings are used only at boundaries (agent input, API, UI). Never use
 * floats for money — see CLAUDE.md engineering standards.
 */

/** Matches a non-negative decimal with up to two fractional digits. */
const DECIMAL_RE = /^\d+(\.\d{1,2})?$/;

/**
 * Parse a decimal amount string (e.g. "2400.00", "30", "12.5") into integer
 * cents. Rejects negatives, empty strings and more than two decimal places so
 * malformed money never enters the engines.
 */
export function parseAmountToCents(amount: string): number {
  const trimmed = amount.trim();
  if (!DECIMAL_RE.test(trimmed)) {
    throw new Error(`Invalid money amount: "${amount}"`);
  }
  const [whole, fraction = ""] = trimmed.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return cents;
}

/** Format integer cents as a two-decimal string, e.g. 240000 -> "2400.00". */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const fraction = (abs % 100).toString().padStart(2, "0");
  return `${sign}${whole}.${fraction}`;
}

/**
 * Format integer cents as a euro display string, dropping ".00" for whole
 * amounts: 10000 -> "€100", 10050 -> "€100.50". For human-readable reasons.
 */
export function formatEuros(cents: number): string {
  const decimal = formatCents(cents);
  const display = decimal.endsWith(".00") ? decimal.slice(0, -3) : decimal;
  return `€${display}`;
}

/**
 * Build integer cents from whole euros and optional cents, avoiding float
 * literals in seed and policy data: eur(2800) === 280000, eur(12, 50) === 1250.
 */
export function eur(euros: number, cents = 0): number {
  return euros * 100 + cents;
}

/**
 * Format integer cents for on-screen display, with thousands grouping and a
 * trailing ".00" only when there are fractional cents: 1842000 -> "€18,420",
 * 569050 -> "€5,690.50", -280000 -> "-€2,800". Rounding-free — cents are exact.
 */
export function formatEurosDisplay(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const fraction = abs % 100;
  const grouped = whole.toLocaleString("en-IE");
  const suffix =
    fraction === 0 ? "" : `.${fraction.toString().padStart(2, "0")}`;
  return `${sign}€${grouped}${suffix}`;
}
