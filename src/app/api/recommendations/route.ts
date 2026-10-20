import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/** GET /api/recommendations — pending recommendations with product info */
export async function GET() {
  const recs = await db.recommendation.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
    include: { product: { select: { name: true, sku: true, category: true } } },
  });
  return NextResponse.json({ recommendations: recs });
}

/**
 * POST /api/recommendations
 *  body: { id: string, action: "apply" | "dismiss" }
 *
 * apply   -> auto-reprice: product.myPrice = recommendedPrice
 * dismiss -> archive the recommendation
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.id || !["apply", "dismiss"].includes(body?.action)) {
    return NextResponse.json({ error: 'id and action ("apply"|"dismiss") required' }, { status: 400 });
  }

  const rec = await db.recommendation.findUnique({ where: { id: String(body.id) }, include: { product: true } });
  if (!rec) return NextResponse.json({ error: "Recommendation not found" }, { status: 404 });
  if (rec.status !== "PENDING") return NextResponse.json({ error: `Already ${rec.status.toLowerCase()}` }, { status: 409 });

  if (body.action === "apply") {
    await db.$transaction([
      db.product.update({ where: { id: rec.productId }, data: { myPrice: rec.recommendedPrice } }),
      // log our own price point so charts show the reprice
      db.pricePoint.create({
        data: { productId: rec.productId, source: "own", price: rec.recommendedPrice },
      }),
      db.recommendation.update({ where: { id: rec.id }, data: { status: "APPLIED" } }),
    ]);
    return NextResponse.json({ ok: true, applied: true, newPrice: rec.recommendedPrice });
  }

  await db.recommendation.update({ where: { id: rec.id }, data: { status: "DISMISSED" } });
  return NextResponse.json({ ok: true, applied: false });
}
