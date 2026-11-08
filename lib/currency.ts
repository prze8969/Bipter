/** Display-only currency conversion. USDC is treated as 1 USD. Rates are never used for settlement. */

export const SUPPORTED = ["USD", "INR", "EUR", "GBP", "JPY", "AUD", "CAD", "SGD", "AED", "BRL"] as const;
export type CurrencyCode = (typeof SUPPORTED)[number];

/**
 * Static fallback, approximate USD -> X rates, used only if the live FX fetch fails.
 * Display only; marked "approx." in the UI.
 */
export const FALLBACK_RATES: Record<CurrencyCode, number> = {
  USD: 1,
  INR: 84,
  EUR: 0.92,
  GBP: 0.78,
  JPY: 150,
  AUD: 1.52,
  CAD: 1.37,
  SGD: 1.34,
  AED: 3.6725,
  BRL: 5.6,
};

const REGION_TO_CURRENCY: Record<string, CurrencyCode> = {
  US: "USD", IN: "INR", GB: "GBP", JP: "JPY", AU: "AUD", CA: "CAD", SG: "SGD", AE: "AED", BR: "BRL",
  DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", NL: "EUR", IE: "EUR", PT: "EUR", AT: "EUR", BE: "EUR", FI: "EUR", GR: "EUR",
};

const TZ_TO_CURRENCY: Record<string, CurrencyCode> = {
  "Asia/Kolkata": "INR", "Asia/Calcutta": "INR", "Europe/London": "GBP", "Asia/Tokyo": "JPY",
  "Asia/Singapore": "SGD", "Asia/Dubai": "AED", "America/Sao_Paulo": "BRL", "Australia/Sydney": "AUD",
  "America/Toronto": "CAD",
};

/** navigator.language region first, then timezone, then USD. */
export function detectCurrency(): CurrencyCode {
  if (typeof navigator === "undefined") return "USD";
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const region = new Intl.Locale(navigator.language).maximize().region;
    // en-US is the default on many machines; prefer timezone when it disagrees with a US locale.
    if (region && region !== "US" && REGION_TO_CURRENCY[region]) return REGION_TO_CURRENCY[region];
    if (tz && TZ_TO_CURRENCY[tz]) return TZ_TO_CURRENCY[tz];
    if (region && REGION_TO_CURRENCY[region]) return REGION_TO_CURRENCY[region];
  } catch {
    /* ignore */
  }
  return "USD";
}

export type Rates = { rates: Record<CurrencyCode, number>; source: "live" | "fallback"; asOf: string | null };

/** Free, no-key FX API. Falls back to the static table on any failure. */
export async function fetchRates(): Promise<Rates> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    if (!res.ok) throw new Error(String(res.status));
    const json = await res.json();
    if (json.result !== "success") throw new Error("bad result");
    const rates = { ...FALLBACK_RATES };
    for (const c of SUPPORTED) if (typeof json.rates?.[c] === "number") rates[c] = json.rates[c];
    return { rates, source: "live", asOf: json.time_last_update_utc ?? null };
  } catch {
    return { rates: { ...FALLBACK_RATES }, source: "fallback", asOf: null };
  }
}

export function formatMoney(usd: number, code: CurrencyCode, rate: number, locale = "en-US") {
  const v = usd * rate;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: code,
    maximumFractionDigits: code === "JPY" ? 0 : 2,
  }).format(v);
}
