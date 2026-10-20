import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { OUR_STORE } from "@/lib/format";
import { detectAnomalies, linearForecast } from "@/lib/ml";

/** GET /api/history?productId=... — price series for charts + ML insights */
export async function GET(req: NextRequest) {
  const productId = req.nextUrl.searchParams.get("productId");
  if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });

  const product = await db.product.findUnique({ where: { id: productId } });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const points = await db.pricePoint.findMany({
    where: { productId },
    orderBy: { capturedAt: "asc" },
    include: { competitor: { select: { name: true, domain: true } } },
  });

  const series = points.map((p) => ({
    date: p.capturedAt.toISOString(),
    price: p.price,
    source: p.source,
    competitor: p.competitor ? p.competitor.name : OUR_STORE,
  }));

  const observations = points.map((p) => ({ price: p.price, capturedAt: p.capturedAt }));
  const forecast = linearForecast(observations);
  const anomalies = detectAnomalies(observations).map((a) => ({
    date: a.capturedAt.toISOString(),
    price: a.price,
    zScore: a.zScore,
  }));

  // per-competitor latest prices for the chart legend / table
  const latestByCompetitor = new Map<string, { name: string; domain: string; price: number; at: string }>();
  for (const p of points) {
    if (!p.competitor) continue;
    latestByCompetitor.set(p.competitor.name, {
      name: p.competitor.name,
      domain: p.competitor.domain,
      price: p.price,
      at: p.capturedAt.toISOString(),
    });
  }

  return NextResponse.json({
    product: { id: product.id, name: product.name, sku: product.sku, myPrice: product.myPrice, cost: product.cost },
    series,
    forecast,
    anomalies,
    competitors: [...latestByCompetitor.values()],
  });
}
