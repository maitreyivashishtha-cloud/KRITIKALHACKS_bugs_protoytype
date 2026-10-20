import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/products/[id] — update price / cost / name */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof body.myPrice === "number") data.myPrice = body.myPrice;
  if (typeof body.cost === "number") data.cost = body.cost;
  if (body.name) data.name = String(body.name);

  const product = await db.product.update({ where: { id }, data });
  return NextResponse.json({ product });
}

/** DELETE /api/products/[id] — stop tracking a product */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  await db.product.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
