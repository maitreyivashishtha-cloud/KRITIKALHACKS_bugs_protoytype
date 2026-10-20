/**
 * Demo simulator — offline stand-in for the TinyFish APIs (Indian market).
 *
 * Simulates India's quick-commerce landscape with made-up brands derived
 * from the real players:
 *   Zomora      (derived from Zomato)
 *   Swiggo      (derived from Swiggy)
 *   InstaBasket (derived from Instamart)
 *   AmazNow     (derived from Amazon Now)
 * Our own store "GharKart" competes against them on household essentials.
 *
 * Produces realistic search results and JS-rendered page content so the
 * entire pipeline (search -> fetch -> extract -> ML -> recommend) can be
 * demonstrated without an API key. Prices evolve on each scan (random
 * walk) exactly like a live market.
 */

export interface DemoCompetitor {
  name: string;
  domain: string;
  basePriceDelta: number; // relative to product price
  jitter: number;
}

const DEMO_COMPETITORS: DemoCompetitor[] = [
  { name: "InstaBasket", domain: "instabasket.in", basePriceDelta: -0.05, jitter: 0.02 }, // aggressive discounter
  { name: "AmazNow", domain: "amaznow.in", basePriceDelta: -0.02, jitter: 0.02 },
  { name: "Swiggo", domain: "swiggo.in", basePriceDelta: 0.01, jitter: 0.025 },
  { name: "Zomora", domain: "zomora.in", basePriceDelta: 0.035, jitter: 0.03 }, // premium quick delivery
];

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Pick 3-4 competitors deterministically per product, shuffled a little per scan. */
export function demoCompetitorsFor(productKey: string): DemoCompetitor[] {
  const rand = seededRandom(hashString(productKey) + Date.now() % 97);
  const pool = [...DEMO_COMPETITORS];
  const shuffled = pool.sort(() => rand() - 0.5);
  const count = 3 + Math.floor(rand() * 2); // 3 or 4
  return shuffled.slice(0, count);
}

export function demoSearch(
  productKey: string,
  query: string,
  maxResults: number
): { results: { position: number; site_name: string; title: string; url: string; snippet: string }[] } {
  const competitors = demoCompetitorsFor(productKey);
  const productName = query.replace(/\s+(price|buy).*$/i, "");
  const results = competitors.slice(0, maxResults).map((c, i) => ({
    position: i + 1,
    site_name: c.domain,
    title: `${productName} — Buy Online | ${c.name}`,
    url: `https://${c.domain}/p/${productKey.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    snippet: `${productName} available at ${c.name}. Live price ₹XXX with same-day delivery across India.`,
  }));
  return { results };
}

/** Simulate a TinyFetch response: clean Markdown of a JS-rendered product page. */
export function demoFetch(
  productKey: string,
  results: { url: string; site_name: string; title: string }[]
): { url: string; title: string | null; content: string }[] {
  return results.map((r) => {
    const competitor = DEMO_COMPETITORS.find((c) => r.url.includes(c.domain)) ?? DEMO_COMPETITORS[0];
    const price = simulateCompetitorPrice(productKey, competitor);
    const inStock = Math.random() > 0.08;
    const priceText = `₹${price.toFixed(2)}`;
    const markdown = [
      `# ${r.title ?? competitor.name}`,
      ``,
      `> ${competitor.name} India | Verified listing · Updated ${new Date().toISOString()}`,
      ``,
      `## Price`,
      inStock ? `**${priceText}**` : `**${priceText}** (out of stock)`,
      ``,
      `## Product details`,
      `- Availability: ${inStock ? "In Stock" : "Out of Stock"}`,
      `- Delivery: ${competitor.name === "Zomora" ? "10-minute delivery" : "Same-day delivery"}`,
      `- Deal: ${Math.random() > 0.6 ? "Flash sale ends today" : "Standard price"}`,
      `- MRP: ₹${Math.round(price * 1.4)} (you save ${(Math.random() * 20 + 5).toFixed(0)}%)`,
      ``,
      `<script>window.__NEXT_DATA__ = {"page":"product","offer":{"price":${price.toFixed(2)},"currency":"INR"}}</script>`,
    ].join("\n");
    return { url: r.url, title: r.title ?? null, content: markdown };
  });
}

/** Random-walk price around the product's base, like a real market (₹). */
export function simulateCompetitorPrice(productKey: string, competitor: DemoCompetitor): number {
  const base = DEMO_BASE_PRICES[productKey] ?? 199;
  const rand = seededRandom(hashString(productKey + competitor.domain) + Math.floor(Date.now() / 1000));
  const walk = (rand() - 0.5) * 2 * competitor.jitter;
  const price = base * (1 + competitor.basePriceDelta + walk);
  return Math.round(price * 100) / 100;
}

// Base prices (₹) for the seeded household-essentials catalogue (keys match seed SKUs)
export const DEMO_BASE_PRICES: Record<string, number> = {
  "shineboost-detergent-4kg": 499,
  "sparkledish-gel-750ml": 199,
  "gleemglow-floor-2l": 299,
  "freshshield-toilet-1l": 249,
  "safenest-refill-45ml": 99,
  "puretouch-handwash-15l": 249,
};
