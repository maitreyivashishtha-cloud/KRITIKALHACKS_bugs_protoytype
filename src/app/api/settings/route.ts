import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/engine";

/** GET /api/settings — repricing policy (+ masked TinyFish key status) */
export async function GET() {
  const settings = await getSettings();
  const { apiKey, ...rest } = settings;
  return NextResponse.json({
    settings: {
      ...rest,
      apiKeySet: Boolean(apiKey),
      apiKeyPreview: apiKey ? `••••${apiKey.slice(-4)}` : null,
    },
  });
}

/**
 * PUT /api/settings — update repricing policy (strategy, guardrails)
 * and optionally store the TinyFish API key.
 * Send `apiKey` as a non-empty string to set/replace it; send `null` to clear.
 */
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (["UNDERCUT", "MATCH", "PREMIUM"].includes(body.strategy)) data.strategy = body.strategy;
  if (typeof body.undercutPct === "number") data.undercutPct = Math.min(20, Math.max(0, body.undercutPct));
  if (typeof body.maxDeltaPct === "number") data.maxDeltaPct = Math.min(30, Math.max(0.5, body.maxDeltaPct));
  if (typeof body.floorMarginPct === "number") data.floorMarginPct = Math.min(100, Math.max(0, body.floorMarginPct));
  if (typeof body.autoApply === "boolean") data.autoApply = body.autoApply;
  if (typeof body.apiKey === "string" && body.apiKey.trim()) data.apiKey = body.apiKey.trim();
  if (body.apiKey === null) data.apiKey = null;

  await getSettings(); // ensure singleton exists
  const settings = await db.setting.update({ where: { id: "singleton" }, data });
  const { apiKey, ...rest } = settings;
  return NextResponse.json({
    settings: {
      ...rest,
      apiKeySet: Boolean(apiKey),
      apiKeyPreview: apiKey ? `••••${apiKey.slice(-4)}` : null,
    },
  });
}
