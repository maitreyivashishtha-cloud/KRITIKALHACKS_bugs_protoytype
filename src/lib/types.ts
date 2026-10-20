/** Shared API response types used across the dashboard. */

export interface CompetitorSnapshot {
  id: string;
  name: string;
  domain: string;
  productUrl: string | null;
  price: number;
  at: string;
  inStock: boolean;
}

export interface PendingRecommendation {
  id: string;
  action: string;
  currentPrice: number;
  recommendedPrice: number;
  confidence: number;
  rationale: string;
}

export interface ProductRow {
  id: string;
  name: string;
  sku: string;
  category: string;
  myPrice: number;
  cost: number;
  createdAt: string;
  competitorCount: number;
  competitors: CompetitorSnapshot[];
  lowestCompetitor: CompetitorSnapshot | null;
  gapPct: number;
  trendPct: number;
  observationCount: number;
  lastScanAt: string | null;
  pendingRecommendation: PendingRecommendation | null;
}

export interface Stats {
  mode: "live" | "demo";
  productCount: number;
  pricePointCount: number;
  competitorPriceCount: number;
  ownPriceCount: number;
  pendingRecommendations: number;
  appliedRecommendations: number;
  avgGapPct: number;
  anomalyCount: number;
  lastScanAt: string | null;
  lastScan: { mode: string; status: string; pricesExtracted: number } | null;
  recentScans: { id: string; productId: string; mode: string; status: string; pricesExtracted: number; pagesFetched: number; createdAt: string }[];
}

export interface RecommendationRow {
  id: string;
  productId: string;
  currentPrice: number;
  recommendedPrice: number;
  action: string;
  confidence: number;
  rationale: string;
  status: string;
  createdAt: string;
  product: { name: string; sku: string; category: string };
}

export interface HistoryData {
  product: { id: string; name: string; sku: string; myPrice: number; cost: number };
  series: { date: string; price: number; source: string; competitor: string }[];
  forecast: { nextPrice: number; slopePerDay: number; r2: number; trend: string } | null;
  anomalies: { date: string; price: number; zScore: number }[];
  competitors: { name: string; domain: string; price: number; at: string }[];
}

export interface ScanOutcomeDto {
  productId: string;
  productName: string;
  mode: "live" | "demo";
  status: string;
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

export interface ScanResponse {
  summary: {
    scanned: number;
    succeeded: number;
    pricesCaptured: number;
    pagesFetched: number;
    recommendationsCreated: number;
    mode: string;
  };
  outcomes: ScanOutcomeDto[];
}

export interface SettingsData {
  id: string;
  strategy: "UNDERCUT" | "MATCH" | "PREMIUM";
  undercutPct: number;
  maxDeltaPct: number;
  floorMarginPct: number;
  autoApply: boolean;
  apiKeySet?: boolean;
  apiKeyPreview?: string | null;
}
