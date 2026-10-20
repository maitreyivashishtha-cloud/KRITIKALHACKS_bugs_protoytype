import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scanProduct, type ScanOutcome } from "@/lib/engine";
import { isLiveMode } from "@/lib/tinyfish";

/**
 * POST /api/scan
 *  body: { productId?: string } — omit to scan ALL products (full sweep).
 *
 * Runs the TinyFish intelligence pipeline per product:
 *   TinySearch -> TinyFetch -> price extraction -> ML -> recommendation.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const productIds: string[] = body?.productId
    ? [String(body.productId)]
    : (await db.product.findMany({ select: { id: true } })).map((p) => p.id);

  if (!productIds.length) {
    return NextResponse.json({ error: "No products to scan. Add one first." }, { status: 400 });
  }

  const outcomes: ScanOutcome[] = [];
  for (const id of productIds) {
    try {
      outcomes.push(await scanProduct(id));
    } catch (e) {
      outcomes.push({
        productId: id,
        productName: "unknown",
        mode: isLiveMode() ? "live" : "demo",
        status: "failed",
        searchQueries: 0,
        pagesFetched: 0,
        pricesExtracted: 0,
        message: e instanceof Error ? e.message : "Scan failed",
      });
    }
  }

  const summary = {
    scanned: outcomes.length,
    succeeded: outcomes.filter((o) => o.status !== "failed").length,
    pricesCaptured: outcomes.reduce((s, o) => s + o.pricesExtracted, 0),
    pagesFetched: outcomes.reduce((s, o) => s + o.pagesFetched, 0),
    recommendationsCreated: outcomes.filter((o) => o.recommendation).length,
    mode: outcomes[0]?.mode ?? (isLiveMode() ? "live" : "demo"),
  };

  return NextResponse.json({ summary, outcomes });
}
