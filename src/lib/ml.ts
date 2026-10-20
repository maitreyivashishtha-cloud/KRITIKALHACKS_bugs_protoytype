/**
 * PricePulse ML engine — pure TypeScript, zero dependencies.
 * Currency formatting: ₹ (Indian market).
 *
 * Three models drive the repricing decisions:
 *
 *  1. Trend forecasting      — OLS linear regression over a competitor's price
 *                              history predicts the next observation and the
 *                              market direction (RISING / FALLING / STABLE).
 *  2. Anomaly detection      — z-score outliers flag flash sales / data glitches
 *                              so a one-day price war doesn't trigger a bad reprice.
 *  3. Repricing recommender  — policy-driven target price (UNDERCUT / MATCH /
 *                              PREMIUM) with business guardrails (margin floor,
 *                              max step per cycle) and a calibrated confidence
 *                              score built from data volume, dispersion,
 *                              anomaly count and forecast fit.
 */

import { inr } from "./format";

export interface PriceObservation {
  price: number;
  capturedAt: Date;
}

export type TrendLabel = "RISING" | "FALLING" | "STABLE";

export interface Forecast {
  nextPrice: number;
  slopePerDay: number;
  r2: number;
  trend: TrendLabel;
}

export interface Anomaly {
  index: number;
  price: number;
  zScore: number;
  capturedAt: Date;
}

/* ---------------------------- 1. trend forecast ---------------------------- */

export function linearForecast(series: PriceObservation[]): Forecast | null {
  const pts = series
    .map((o) => ({ x: o.capturedAt.getTime() / 86_400_000, y: o.price })) // x in days
    .sort((a, b) => a.x - b.x);
  const n = pts.length;
  if (n < 3) return null;

  const meanX = pts.reduce((s, p) => s + p.x, 0) / n;
  const meanY = pts.reduce((s, p) => s + p.y, 0) / n;

  let sxx = 0, sxy = 0;
  for (const p of pts) {
    sxx += (p.x - meanX) ** 2;
    sxy += (p.x - meanX) * (p.y - meanY);
  }
  if (sxx === 0) return null;

  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;

  let ssTot = 0, ssRes = 0;
  for (const p of pts) {
    const pred = intercept + slope * p.x;
    ssTot += (p.y - meanY) ** 2;
    ssRes += (p.y - pred) ** 2;
  }
  const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);
  const nextX = pts[n - 1].x + 1;
  const nextPrice = round2(intercept + slope * nextX);

  const priceScale = Math.abs(meanY) || 1;
  const slopePct = (slope / priceScale) * 100; // % of price level per day
  const trend: TrendLabel = slopePct > 0.08 ? "RISING" : slopePct < -0.08 ? "FALLING" : "STABLE";

  return { nextPrice, slopePerDay: round4(slope), r2: round3(r2), trend };
}

/* --------------------------- 2. anomaly detection -------------------------- */

export function detectAnomalies(series: PriceObservation[], threshold = 2.5): Anomaly[] {
  const n = series.length;
  if (n < 6) return [];
  const values = series.map((o) => o.price);
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
  if (sd === 0) return [];

  return series
    .map((o, i) => ({ index: i, price: o.price, zScore: (o.price - mean) / sd, capturedAt: o.capturedAt }))
    .filter((p) => Math.abs(p.zScore) >= threshold)
    .map((p) => ({ ...p, zScore: round2(p.zScore) }));
}

/* ------------------------- 3. repricing recommender ------------------------ */

export type Strategy = "UNDERCUT" | "MATCH" | "PREMIUM";

export interface RepricingInput {
  myPrice: number;
  cost: number;
  strategy: Strategy;
  undercutPct: number; // e.g. 1.5 => beat lowest by 1.5%
  maxDeltaPct: number; // e.g. 5 => never move more than 5% per cycle
  floorMarginPct: number; // e.g. 10 => price >= cost * 1.10
  competitorPrices: number[]; // cleaned (anomaly-filtered) live observations
  forecast?: Forecast | null;
  anomalyCount?: number;
  totalObservations?: number;
}

export interface RepricingOutput {
  recommendedPrice: number;
  action: "UNDERCUT" | "MATCH" | "RAISE" | "HOLD";
  confidence: number; // 0..1
  rationale: string;
  guardrails: { applied: string[] };
}

export function recommendPrice(input: RepricingInput): RepricingOutput {
  const {
    myPrice, cost, strategy, undercutPct, maxDeltaPct, floorMarginPct,
    competitorPrices, forecast, anomalyCount = 0, totalObservations = 0,
  } = input;

  const guardrails: string[] = [];
  const lowest = competitorPrices.length ? Math.min(...competitorPrices) : null;
  const avg = competitorPrices.length
    ? competitorPrices.reduce((s, v) => s + v, 0) / competitorPrices.length
    : null;

  // raw policy target
  let target: number;
  if (lowest === null || avg === null) {
    return {
      recommendedPrice: myPrice,
      action: "HOLD",
      confidence: 0.2,
      rationale: "No live competitor observations yet — waiting for the next TinyFish scan.",
      guardrails,
    };
  }

  switch (strategy) {
    case "UNDERCUT":
      target = lowest * (1 - undercutPct / 100);
      break;
    case "MATCH":
      target = avg;
      break;
    case "PREMIUM":
      target = Math.max(myPrice, avg * 1.05);
      break;
  }

  // Guardrail 1: margin floor — never price below cost + floorMarginPct
  const floor = cost * (1 + floorMarginPct / 100);
  if (target < floor) {
    target = floor;
    guardrails.push(`Margin floor applied: price kept at cost + ${floorMarginPct}% (${inr(floor)}).`);
  }

  // Guardrail 2: step limit — max move per cycle to avoid whiplash
  const maxUp = myPrice * (1 + maxDeltaPct / 100);
  const maxDown = myPrice * (1 - maxDeltaPct / 100);
  if (target > maxUp) {
    target = maxUp;
    guardrails.push(`Step limit: increase capped at ${maxDeltaPct}% per cycle.`);
  }
  if (target < maxDown) {
    target = maxDown;
    guardrails.push(`Step limit: decrease capped at ${maxDeltaPct}% per cycle.`);
  }

  target = round2(target);

  const deltaPct = ((target - myPrice) / myPrice) * 100;
  let action: RepricingOutput["action"];
  if (deltaPct <= -0.3) action = "UNDERCUT";
  else if (deltaPct >= 0.3) action = "RAISE";
  else action = "HOLD";

  /* ---- confidence calibration (0..1) ---- */
  const volumeScore = clamp01((totalObservations - 5) / 40);          // 5..45 obs
  const dispersion = avg ? (standardDeviation(competitorPrices) / avg) : 1;
  const stabilityScore = clamp01(1 - dispersion * 6);                  // tight market = high
  const anomalyScore = clamp01(1 - anomalyCount / 3);                  // anomalies reduce trust
  const fitScore = forecast ? clamp01(0.5 + forecast.r2 / 2) : 0.5;    // forecast quality
  const confidence = round3(
    0.3 * volumeScore + 0.25 * stabilityScore + 0.2 * anomalyScore + 0.25 * fitScore
  );

  /* ---- rationale (explainability for the judges) ---- */
  const parts: string[] = [];
  parts.push(
    `Lowest live competitor is ${inr(lowest)} (market avg ${inr(avg)} across ${competitorPrices.length} sources).`
  );
  if (strategy === "UNDERCUT") parts.push(`Policy: undercut lowest by ${undercutPct}%.`);
  if (strategy === "MATCH") parts.push(`Policy: match market average.`);
  if (strategy === "PREMIUM") parts.push(`Policy: hold premium (avg +5%).`);
  if (forecast && forecast.trend !== "STABLE") {
    parts.push(
      `Regression forecast sees a ${forecast.trend.toLowerCase()} market (R² ${forecast.r2}); next expected price ${inr(forecast.nextPrice)}.`
    );
  }
  if (anomalyCount > 0) {
    parts.push(`${anomalyCount} anomalous observation${anomalyCount > 1 ? "s" : ""} excluded (flash sale or glitch).`);
  }
  if (guardrails.length) parts.push(guardrails.join(" "));

  return { recommendedPrice: target, action, confidence, rationale: parts.join(" "), guardrails };
}

/* --------------------------------- helpers -------------------------------- */

export function ema(values: number[], alpha = 0.3): number[] {
  const out: number[] = [];
  let prev = values[0];
  for (const v of values) {
    prev = alpha * v + (1 - alpha) * prev;
    out.push(prev);
  }
  return out;
}

export function standardDeviation(values: number[]): number {
  const n = values.length;
  if (!n) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
}

/** Remove anomaly observations before feeding the recommender. */
export function filterOutliers(series: PriceObservation[], threshold = 2.5): PriceObservation[] {
  const anomalies = new Set(detectAnomalies(series, threshold).map((a) => a.index));
  return series.filter((_, i) => !anomalies.has(i));
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const round2 = (v: number) => Math.round(v * 100) / 100;
const round3 = (v: number) => Math.round(v * 1000) / 1000;
const round4 = (v: number) => Math.round(v * 10000) / 10000;
