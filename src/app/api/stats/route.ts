import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isLiveMode } from "@/lib/tinyfish";
import { getSettings } from "@/lib/engine";

/** GET /api/stats — dashboard KPIs + current integration mode */
export async function GET() {
  const settings = await getSettings();
  const [productCount, pricePointCount, pendingRecs, appliedRecs, recentScans, ownPrices, competitorPrices] =
    await Promise.all([
      db.product.count(),
      db.pricePoint.count(),
      db.recommendation.count({ where: { status: "PENDING" } }),
      db.recommendation.count({ where: { status: "APPLIED" } }),
      db.scanLog.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
      db.pricePoint.count({ where: { source: "own" } }),
      db.pricePoint.count({ where: { source: { in: ["tinyfish", "demo"] } } }),
    ]);

  // average price gap across products (my price vs lowest live competitor)
  const products = await db.product.findMany({
    include: { pricePoints: { where: { competitorId: { not: null } }, orderBy: { capturedAt: "desc" } } },
  });

  let gapSum = 0;
  let gapCount = 0;
  let anomalyCount = 0;
  for (const p of products) {
    const latestByCompetitor = new Map<string, number>();
    for (const pt of p.pricePoints) {
      if (pt.competitorId && !latestByCompetitor.has(pt.competitorId)) {
        latestByCompetitor.set(pt.competitorId, pt.price);
      }
    }
    const prices = [...latestByCompetitor.values()];
    if (prices.length && p.myPrice > 0) {
      const lowest = Math.min(...prices);
      gapSum += ((p.myPrice - lowest) / lowest) * 100;
      gapCount++;
    }
    // anomaly detection over each product's full observation history
    const allPrices = p.pricePoints.map((pt) => pt.price);
    if (allPrices.length >= 6) {
      const mean = allPrices.reduce((s, v) => s + v, 0) / allPrices.length;
      const sd = Math.sqrt(allPrices.reduce((s, v) => s + (v - mean) ** 2, 0) / allPrices.length) || 1;
      anomalyCount += allPrices.filter((v) => Math.abs((v - mean) / sd) >= 2.5).length;
    }
  }

  return NextResponse.json({
    mode: isLiveMode(settings?.apiKey ?? undefined) ? "live" : "demo",
    productCount,
    pricePointCount,
    competitorPriceCount: competitorPrices,
    ownPriceCount: ownPrices,
    pendingRecommendations: pendingRecs,
    appliedRecommendations: appliedRecs,
    avgGapPct: gapCount ? Math.round((gapSum / gapCount) * 100) / 100 : 0,
    anomalyCount,
    lastScanAt: recentScans[0]?.createdAt ?? null,
    lastScan: recentScans[0] ?? null,
    recentScans: recentScans.map((s) => ({
      id: s.id,
      productId: s.productId,
      mode: s.mode,
      status: s.status,
      pricesExtracted: s.pricesExtracted,
      pagesFetched: s.pagesFetched,
      createdAt: s.createdAt,
    })),
  });
}
