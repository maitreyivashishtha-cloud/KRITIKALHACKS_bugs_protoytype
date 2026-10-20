/**
 * Price extraction — turns messy Markdown/JSON page content from TinyFetch
 * into structured price observations.
 *
 * Handles the common shapes found on modern e-commerce pages:
 *  1. JSON-LD structured data (schema.org "Offer" / "price")
 *  2. Embedded JSON blobs (e.g. window.__NEXT_DATA__, Shopify analytics)
 *  3. Markdown/HTML price text ($1,299.00 / USD 189 / ₹24,999 / €59,99)
 */

export interface ExtractedPrice {
  price: number;
  currency: string;
  inStock: boolean | null;
  context: string; // short snippet around the match, for UI transparency
  method: "json-ld" | "embedded-json" | "text-pattern";
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  $: "USD",
  "₹": "INR",
  "€": "EUR",
  "£": "GBP",
};

/** Extract candidate prices from a cleaned page (markdown or stringified JSON). */
export function extractPrices(content: string): ExtractedPrice[] {
  const out: ExtractedPrice[] = [];
  const seen = new Set<string>();

  const push = (p: ExtractedPrice) => {
    const key = `${p.method}:${p.price}`;
    if (!seen.has(key) && isPlausible(p.price)) {
      seen.add(key);
      out.push(p);
    }
  };

  // 1) JSON-LD / offers blocks
  for (const m of content.matchAll(/"@type"\s*:\s*"(?:Offer|AggregateOffer)"[^}]{0,600}/g)) {
    const block = m[0];
    const pm = block.match(/"(?:price|lowPrice|highPrice)"\s*:\s*"?([\d,]+(?:\.\d{1,2})?)"?/i);
    if (pm) {
      push({
        price: parseNumber(pm[1]),
        currency: currencyFrom(block) || "USD",
        inStock: /"(?:availability|InStock)"/i.test(block) ? !/OutOfStock/i.test(block) : null,
        context: trimContext(block),
        method: "json-ld",
      });
    }
  }

  // 2) Embedded JSON price fields (Next.js/Shopify style payloads)
  for (const m of content.matchAll(/"(?:price|currentPrice|salePrice|finalPrice|amount)"\s*:\s*"?([\d,]+(?:\.\d{1,2})?)"?/g)) {
    const idx = m.index ?? 0;
    push({
      price: parseNumber(m[1]),
      currency: currencyFrom(content.slice(Math.max(0, idx - 120), idx + 120)) || "USD",
      inStock: null,
      context: trimContext(content.slice(Math.max(0, idx - 80), idx + 80)),
      method: "embedded-json",
    });
  }

  // 3) Human-readable price text (markdown bold, headings, plain text)
  for (const m of content.matchAll(/(?:[$₹€£]|USD\s|INR\s|EUR\s|GBP\s)\s?([\d,]+(?:\.\d{1,2})?)/g)) {
    const idx = m.index ?? 0;
    const around = content.slice(Math.max(0, idx - 60), idx + 60);
    if (/srp|msrp|compare at|was\s*\$/i.test(around)) continue; // skip reference prices
    push({
      price: parseNumber(m[1]),
      currency: currencyFrom(around) || "USD",
      inStock: /out of stock/i.test(around) ? false : /in stock/i.test(around) ? true : null,
      context: trimContext(around),
      method: "text-pattern",
    });
  }

  return out;
}

/** Pick the most credible price observation from a page. */
export function pickBestPrice(candidates: ExtractedPrice[]): ExtractedPrice | null {
  if (!candidates.length) return null;
  const rank = (m: ExtractedPrice["method"]) => (m === "json-ld" ? 0 : m === "embedded-json" ? 1 : 2);
  const sorted = [...candidates].sort((a, b) => rank(a.method) - rank(b.method));
  // json-ld / embedded-json wins outright; for text matches prefer the median (robust to noise)
  if (sorted[0].method !== "text-pattern") return sorted[0];
  const nums = candidates.map((c) => c.price).sort((a, b) => a - b);
  const median = nums[Math.floor(nums.length / 2)];
  return candidates.find((c) => c.price === median) ?? sorted[0];
}

export function isPlausible(price: number): boolean {
  return Number.isFinite(price) && price >= 0.5 && price <= 500000;
}

function parseNumber(raw: string): number {
  return parseFloat(raw.replace(/,/g, ""));
}

function currencyFrom(context: string): string | null {
  const symbol = context.match(/[$₹€£]/)?.[0];
  if (symbol && CURRENCY_SYMBOLS[symbol]) return CURRENCY_SYMBOLS[symbol];
  const code = context.match(/\b(USD|INR|EUR|GBP)\b/)?.[1];
  return code || null;
}

function trimContext(s: string): string {
  return s.replace(/\s+/g, " ").trim().slice(0, 140);
}
