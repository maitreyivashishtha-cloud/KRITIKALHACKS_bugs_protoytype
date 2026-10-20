import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/** GET /api/products — list tracked products with live competitor snapshot + ML trend */
export async function GET() {
  const products = await db.product.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      competitors: true,
      pricePoints: { orderBy: { capturedAt: "desc" } },
      recommendations: {
        where: { status: "PENDING" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const data = products.map((p) => {
    const latest = new Map<string, { price: number; at: Date; inStock: boolean }>();
    for (const pt of p.pricePoints) {
      if (!pt.competitorId) continue;
      const cur = latest.get(pt.competitorId);
      if (!cur || pt.capturedAt > cur.at) {
        latest.set(pt.competitorId, { price: pt.price, at: pt.capturedAt, inStock: pt.inStock });
      }
    }
    const competitorSnapshots = [...latest.entries()]
      .map(([cid, v]) => {
        const c = p.competitors.find((x) => x.id === cid);
        return c ? { id: cid, name: c.name, domain: c.domain, productUrl: c.productUrl, ...v } : null;
      })
      .filter(Boolean) as {
      id: string; name: string; domain: string; productUrl: string | null;
      price: number; at: Date; inStock: boolean;
    }[];

    const lowest = competitorSnapshots.length
      ? competitorSnapshots.reduce((m, c) => (c.price < m.price ? c : m))
      : null;
    const gapPct = lowest ? ((p.myPrice - lowest.price) / lowest.price) * 100 : 0;

    // recent trend over last 10 observations
    const recent = p.pricePoints.slice(0, 10).map((x) => x.price).reverse();
    const trendPct = recent.length >= 3
      ? ((recent[recent.length - 1] - recent[0]) / recent[0]) * 100
      : 0;

    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      category: p.category,
      myPrice: p.myPrice,
      cost: p.cost,
      createdAt: p.createdAt,
      competitorCount: competitorSnapshots.length,
      competitors: competitorSnapshots,
      lowestCompetitor: lowest,
      gapPct: Math.round(gapPct * 100) / 100,
      trendPct: Math.round(trendPct * 100) / 100,
      observationCount: p.pricePoints.length,
      lastScanAt: p.pricePoints[0]?.capturedAt ?? null,
      pendingRecommendation: p.recommendations[0] ?? null,
    };
  });

  return NextResponse.json({ products: data });
}

/** POST /api/products — add a product to track */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.name || !body?.sku || typeof body?.myPrice !== "number" || typeof body?.cost !== "number") {
    return NextResponse.json(
      { error: "name, sku, myPrice (number) and cost (number) are required" },
      { status: 400 }
    );
  }
  try {
    const product = await db.product.create({
      data: {
        name: String(body.name),
        sku: String(body.sku),
        category: body.category ? String(body.category) : "General",
        myPrice: body.myPrice,
        cost: body.cost,
      },
    });
    return NextResponse.json({ product }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "SKU already exists" }, { status: 409 });
  }
}
