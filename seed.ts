/**
 * Seed script — realistic 45-day market history for 6 household essentials,
 * priced in ₹ for the Indian quick-commerce market.
 *
 * Competitors are made-up brands derived from real Indian players:
 *   Zomora      (derived from Zomato)
 *   Swiggo      (derived from Swiggy)
 *   InstaBasket (derived from Instamart)
 *   AmazNow     (derived from Amazon Now)
 * Our own store: GharKart.
 *
 * Run: bun prisma/seed.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PRODUCTS = [
  { name: "ShineBoost Detergent Powder 4 kg", sku: "shineboost-detergent-4kg", category: "Laundry", myPrice: 512, cost: 352, base: 499 },
  { name: "SparkleDish Dishwash Gel 750 ml", sku: "sparkledish-gel-750ml", category: "Kitchen Care", myPrice: 204, cost: 132, base: 199 },
  { name: "GleemGlow Floor Cleaner 2 L", sku: "gleemglow-floor-2l", category: "Floor Care", myPrice: 309, cost: 196, base: 299 },
  { name: "FreshShield Toilet Cleaner 1 L", sku: "freshshield-toilet-1l", category: "Bathroom Care", myPrice: 255, cost: 158, base: 249 },
  { name: "SafeNest Mosquito Repellent Refill 45 ml", sku: "safenest-refill-45ml", category: "Pest Control", myPrice: 104, cost: 56, base: 99 },
  { name: "PureTouch Handwash Refill 1.5 L", sku: "puretouch-handwash-15l", category: "Handwash", myPrice: 259, cost: 164, base: 249 },
];

const COMPETITORS = [
  { name: "InstaBasket", domain: "instabasket.in", delta: -0.05, jitter: 0.02 }, // aggressive discounter
  { name: "AmazNow", domain: "amaznow.in", delta: -0.02, jitter: 0.02 },
  { name: "Swiggo", domain: "swiggo.in", delta: 0.01, jitter: 0.025 },
  { name: "Zomora", domain: "zomora.in", delta: 0.035, jitter: 0.03 }, // premium 10-min delivery
];

const DAYS = 45;

async function main() {
  console.log("Clearing existing data...");
  await db.scanLog.deleteMany();
  await db.recommendation.deleteMany();
  await db.pricePoint.deleteMany();
  await db.competitor.deleteMany();
  await db.product.deleteMany();
  await db.setting.deleteMany();

  await db.setting.create({
    data: { id: "singleton", strategy: "UNDERCUT", undercutPct: 1.5, maxDeltaPct: 5, floorMarginPct: 10, autoApply: false },
  });

  const now = Date.now();

  for (const [pi, p] of PRODUCTS.entries()) {
    const product = await db.product.create({
      data: { name: p.name, sku: p.sku, category: p.category, myPrice: p.myPrice, cost: p.cost },
    });

    // our own (GharKart) price log — a couple of manual reprices over the window
    await db.pricePoint.create({
      data: { productId: product.id, source: "own", price: p.myPrice, capturedAt: new Date(now - DAYS * 86400000) },
    });
    await db.pricePoint.create({
      data: { productId: product.id, source: "own", price: p.myPrice, capturedAt: new Date(now - 86400000) },
    });

    const rand = mulberry32(1337 + pi * 97);

    for (const c of COMPETITORS) {
      const competitor = await db.competitor.create({
        data: {
          productId: product.id,
          name: c.name,
          domain: c.domain,
          productUrl: `https://${c.domain}/p/${p.sku}`,
          lastCheckedAt: new Date(now - 3600000),
        },
      });

      let price = p.base * (1 + c.delta);
      let flashSaleDay = -1;
      if (rand() > 0.55) flashSaleDay = Math.floor(rand() * (DAYS - 5)); // one competitor had a flash sale

      for (let d = DAYS; d >= 0; d--) {
        const drift = 0.0016 * (rand() - 0.5); // gentle market drift
        price *= 1 + drift;
        let observed = Math.round(price * 100) / 100;

        if (d === flashSaleDay) observed = Math.round(observed * 0.82 * 100) / 100; // 18% flash-sale spike
        observed = Math.max(observed, p.cost * 0.75); // sanity floor

        await db.pricePoint.create({
          data: {
            productId: product.id,
            competitorId: competitor.id,
            source: "demo",
            price: observed,
            inStock: rand() > 0.06,
            capturedAt: new Date(now - d * 86400000 - Math.floor(rand() * 3600000)),
          },
        });
      }
    }

    // one seed recommendation so the feed is not empty
    const history = await db.pricePoint.findMany({ where: { productId: product.id, competitorId: { not: null } } });
    if (history.length) {
      const lowest = Math.min(...history.slice(-12).map((h) => h.price));
      const target = Math.max(p.cost * 1.1, Math.round(lowest * 0.985 * 100) / 100);
      await db.recommendation.create({
        data: {
          productId: product.id,
          currentPrice: p.myPrice,
          recommendedPrice: target,
          action: target < p.myPrice ? "UNDERCUT" : "RAISE",
          confidence: 0.72 + rand() * 0.2,
          rationale: `Seeded policy action: lowest live competitor (InstaBasket/Swiggo/Zomora/AmazNow) observed at ₹${lowest.toFixed(2)}; target set to lowest − 1.5% within margin guardrails.`,
        },
      });
    }
    console.log(`Seeded ${p.name} (4 competitors, ${COMPETITORS.length * (DAYS + 1)} observations)`);
  }

  const total = await db.pricePoint.count();
  console.log(`Done. ${await db.product.count()} products, ${await db.competitor.count()} competitors, ${total} price points (INR).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
