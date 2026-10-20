/**
 * Scan engine — the heart of PricePulse.
 *
 * Pipeline per product:
 *   1. TinySearch  : find live competitor product pages (fresh, not cached)
 *   2. TinyFetch   : render JS pages, return clean Markdown
 *   3. Extract     : parse prices (JSON-LD → embedded JSON → text patterns)
 *   4. Persist     : upsert competitors + store price points
 *   5. ML          : forecast trend, detect anomalies, produce recommendation
 *   6. Audit       : write a ScanLog row with usage counters
 */

import { db } from "@/lib/db";
import { searchAndFetch } from "@/lib/tinyfish";
import { extractPrices, pickBestPrice } from "@/lib/extract";
import { detectAnomalies, filterOutliers, linearForecast, recommendPrice, type Strategy } from "@/lib/ml";

export interface ScanOutcome {
  productId: string;
  productName: string;
  mode: "live" | "demo";
  status: "success" | "partial" | "failed";
  searchQueries: number;
  pagesFetched: number;
  pricesExtracted: number;
  message?: string;
  recommendation?: {
    id: string;
    action: string;
    currentPrice: number;
    recommendedPrice: number;
    confidence: number;
    rationale: string;
  };
}

export async function scanProduct(productId: string): Promise<ScanOutcome> {
  const product = await db.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error(`Product ${productId} not found`);

  const settings = await getSettings();
  const productKey = product.sku.toLowerCase(); // matches demo base-price table keys
  const searchQuery = `${product.name} price buy online`;

  // 1 + 2: TinySearch + TinyFetch (or demo simulator)
  let mode: "live" | "demo";
  let pages: { url: string; title: string | null; content: string }[];
  let status: ScanOutcome["status"] = "success";
  let message: string | undefined;

  try {
    const outcome = await searchAndFetch({
      searchQuery,
      purpose: `Find live competitor prices for ${product.name} to feed an automated repricing engine`,
      productKey,
      maxResults: 5,
      apiKey: settings.apiKey ?? undefined, // in-app key (Settings dialog) overrides nothing; env still works
    });
    mode = outcome.mode;
    pages = outcome.pages;
    if (outcome.fetchErrors.length) {
      status = "partial";
      message = `${outcome.fetchErrors.length} page(s) failed extraction: ${outcome.fetchErrors.map((e) => e.error).join(", ")}`;
    }
  } catch (e) {
    await db.scanLog.create({
      data: {
        productId,
        mode: "live",
        status: "failed",
        message: e instanceof Error ? e.message : "Unknown TinyFish error",
      },
    });
    return {
      productId,
      productName: product.name,
      mode: "live",
      status: "failed",
      searchQueries: 1,
      pagesFetched: 0,
      pricesExtracted: 0,
      message: e instanceof Error ? e.message : "Unknown TinyFish error",
    };
  }

  // 3 + 4: extract prices, upsert competitors, persist observations
  let searchQueries = 1;
  let pagesFetched = 0;
  let pricesExtracted = 0;

  for (const page of pages) {
    pagesFetched++;
    let domain = "unknown";
    try {
      domain = new URL(page.url).hostname.replace(/^www\./, "");
    } catch {
      continue;
    }

    const candidates = extractPrices(page.content);
    const best = pickBestPrice(candidates);
    if (!best) continue;

    const competitor = await db.competitor.upsert({
      where: { productId_domain: { productId, domain } },
      create: {
        productId,
        domain,
        name: domain.split(".")[0].replace(/^\w/, (c) => c.toUpperCase()),
        productUrl: page.url,
        lastCheckedAt: new Date(),
      },
      update: { productUrl: page.url, lastCheckedAt: new Date() },
    });

    await db.pricePoint.create({
      data: {
        productId,
        competitorId: competitor.id,
        source: mode === "live" ? "tinyfish" : "demo",
        price: best.price,
        currency: best.currency,
        inStock: best.inStock ?? true,
      },
    });
    pricesExtracted++;
  }

  // 5: ML analysis on the accumulated history
  const history = await db.pricePoint.findMany({
    where: { productId, competitorId: { not: null } },
    orderBy: { capturedAt: "asc" },
    include: { competitor: true },
  });

  const observations = history.map((p) => ({ price: p.price, capturedAt: p.capturedAt }));
  const forecast = linearForecast(observations);
  const anomalies = detectAnomalies(observations);
  const cleanPrices = filterOutliers(observations).map((o) => o.price);
  // keep only the freshest observation per competitor for the recommender
  const latestPerCompetitor = new Map<string, number>();
  for (const p of history) {
    if (p.competitorId) latestPerCompetitor.set(p.competitorId, p.price);
  }
  const currentMarket = [...latestPerCompetitor.values()];

  const rec = recommendPrice({
    myPrice: product.myPrice,
    cost: product.cost,
    strategy: settings.strategy as Strategy,
    undercutPct: settings.undercutPct,
    maxDeltaPct: settings.maxDeltaPct,
    floorMarginPct: settings.floorMarginPct,
    competitorPrices: currentMarket.length ? currentMarket : cleanPrices,
    forecast,
    anomalyCount: anomalies.length,
    totalObservations: observations.length,
  });

  const saved = await db.recommendation.create({
    data: {
      productId,
      currentPrice: product.myPrice,
      recommendedPrice: rec.recommendedPrice,
      action: rec.action,
      confidence: rec.confidence,
      rationale: rec.rationale,
    },
  });

  // 6: audit trail
  await db.scanLog.create({
    data: { productId, mode, status, searchQueries, pagesFetched, pricesExtracted, message },
  });

  return {
    productId,
    productName: product.name,
    mode,
    status,
    searchQueries,
    pagesFetched,
    pricesExtracted,
    message,
    recommendation: {
      id: saved.id,
      action: rec.action,
      currentPrice: rec.currentPrice ?? product.myPrice,
      recommendedPrice: rec.recommendedPrice,
      confidence: rec.confidence,
      rationale: rec.rationale,
    },
  };
}

export async function getSettings() {
  let s = await db.setting.findUnique({ where: { id: "singleton" } });
  if (!s) {
    s = await db.setting.create({ data: { id: "singleton" } });
  }
  return s;
}
