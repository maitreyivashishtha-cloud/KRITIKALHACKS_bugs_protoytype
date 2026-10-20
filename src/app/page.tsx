"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Activity, ArrowDownRight, ArrowUpRight, ExternalLink, Gauge, LayoutDashboard, ListChecks,
  Plus, Radar, RefreshCw, Settings2, Target, TrendingUp, Zap,
} from "lucide-react";
import { AddProductDialog } from "@/components/add-product-dialog";
import { FlowerLogo } from "@/components/logo";
import { IntelligenceChart } from "@/components/intelligence-chart";
import { ScanDialog } from "@/components/scan-dialog";
import { SettingsDialog } from "@/components/settings-dialog";
import { toast } from "@/hooks/use-toast";
import { OUR_STORE, inr } from "@/lib/format";
import type {
  HistoryData, ProductRow, RecommendationRow, ScanResponse, SettingsData, Stats,
} from "@/lib/types";

const PIPELINE = [
  { n: "TinySearch", d: "find live pages" },
  { n: "TinyFetch", d: "JS → Markdown" },
  { n: "Extract", d: "parse prices" },
  { n: "ML engine", d: "forecast + guardrails" },
  { n: "Reprice", d: "apply" },
];

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationRow[]>([]);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("All");

  const [scanOpen, setScanOpen] = useState(false);
  const [scanRunning, setScanRunning] = useState(false);
  const [scanResponse, setScanResponse] = useState<ScanResponse | null>(null);
  const [scanScope, setScanScope] = useState("all products");
  const [scanRunId, setScanRunId] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  /* ------------------------------ data loading ------------------------------ */

  const loadStats = useCallback(async () => {
    const res = await fetch("/api/stats");
    setStats(await res.json());
  }, []);

  const loadProducts = useCallback(async () => {
    const res = await fetch("/api/products");
    const data = await res.json();
    setProducts(data.products);
    return data.products as ProductRow[];
  }, []);

  const loadRecommendations = useCallback(async () => {
    const res = await fetch("/api/recommendations");
    const data = await res.json();
    setRecommendations(data.recommendations);
  }, []);

  const loadSettings = useCallback(async () => {
    const res = await fetch("/api/settings");
    const data = await res.json();
    setSettings(data.settings);
  }, []);

  const loadHistory = useCallback(async (productId: string) => {
    const res = await fetch(`/api/history?productId=${productId}`);
    if (!res.ok) return;
    setHistory(await res.json());
  }, []);

  useEffect(() => {
    (async () => {
      await Promise.all([loadStats(), loadSettings(), loadRecommendations()]);
      const prods = await loadProducts();
      if (prods.length) {
        setSelectedId((cur) => cur ?? prods[0].id);
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (selectedId) loadHistory(selectedId);
  }, [selectedId, loadHistory]);

  /* -------------------------------- actions --------------------------------- */

  const runScan = useCallback(
    async (productId?: string, productName?: string) => {
      setScanScope(productId ? productName ?? "selected product" : "all products");
      setScanResponse(null);
      setScanRunning(true);
      setScanRunId((n) => n + 1);
      setScanOpen(true);
      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(productId ? { productId } : {}),
        });
        const data: ScanResponse = await res.json();
        if (!res.ok) throw new Error((data as unknown as { error?: string }).error || "Scan failed");
        setScanResponse(data);

        // auto-apply policy: apply recommendations right after the scan
        if (settings?.autoApply) {
          const recs = data.outcomes.map((o) => o.recommendation).filter(Boolean);
          let applied = 0;
          for (const r of recs) {
            if (!r) continue;
            const ar = await fetch("/api/recommendations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: r.id, action: "apply" }),
            });
            if (ar.ok) applied++;
          }
          if (applied) {
            toast({ title: `Auto-repriced ${applied} product${applied > 1 ? "s" : ""}`, description: "Auto-apply policy is enabled." });
          }
        }

        await Promise.all([loadStats(), loadProducts(), loadRecommendations()]);
        if (selectedId) await loadHistory(selectedId);
      } catch (e) {
        toast({
          title: "Scan failed",
          description: e instanceof Error ? e.message : "Unknown error",
          variant: "destructive",
        });
        setScanOpen(false);
      } finally {
        setScanRunning(false);
      }
    },
    [settings, selectedId, loadStats, loadProducts, loadRecommendations, loadHistory]
  );

  const actOnRecommendation = useCallback(
    async (id: string, action: "apply" | "dismiss") => {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Action failed", description: data.error, variant: "destructive" });
        return;
      }
      toast({
        title: action === "apply" ? `Price updated to ${inr(data.newPrice)}` : "Recommendation dismissed",
        description: action === "apply" ? "Your store price has been repriced." : undefined,
      });
      await Promise.all([loadRecommendations(), loadStats(), loadProducts()]);
      if (selectedId) await loadHistory(selectedId);
    },
    [loadRecommendations, loadStats, loadProducts, loadHistory, selectedId]
  );

  const deleteProduct = useCallback(
    async (p: ProductRow) => {
      await fetch(`/api/products/${p.id}`, { method: "DELETE" });
      toast({ title: `${p.name} removed`, description: "Stopped tracking this product." });
      const prods = await loadProducts();
      if (selectedId === p.id) {
        setSelectedId(prods[0]?.id ?? null);
        setHistory(null);
      }
      await loadStats();
      await loadRecommendations();
    },
    [loadProducts, loadStats, loadRecommendations, selectedId]
  );

  const selectedProduct = useMemo(() => products.find((p) => p.id === selectedId) ?? null, [products, selectedId]);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(products.map((p) => p.category)))],
    [products]
  );
  const visibleProducts = useMemo(
    () => (category === "All" ? products : products.filter((p) => p.category === category)),
    [products, category]
  );

  /* --------------------------------- render --------------------------------- */

  return (
    <div className="min-h-screen text-wine">
      {/* ambient glows on the wine background */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-[420px] w-[420px] rounded-full bg-leaf/10 blur-3xl" />
        <div className="absolute -bottom-32 right-1/5 h-[420px] w-[420px] rounded-full bg-blush/15 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-[1440px] px-3 py-3 md:px-6 md:py-6">
        <div className="overflow-hidden rounded-[28px] border border-blush/40 bg-shell shadow-[0_40px_90px_-30px_rgba(40,8,22,0.55)]">
          {/* top nav */}
          <header className="flex flex-wrap items-center gap-3 border-b border-wine/10 px-4 py-3.5 md:px-7">
            <a href="#top" className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl border border-blush/40 bg-wine shadow-sm">
                <FlowerLogo size={34} />
              </span>
              <span>
                <span className="block font-display text-lg uppercase leading-none tracking-wide text-wine">
                  GharKart
                </span>
                <span className="block text-[11px] leading-tight text-mist">
                  PricePulse · Live Competitor Intelligence
                </span>
              </span>
            </a>

            <nav className="ml-4 hidden items-center gap-1 rounded-full border border-wine/10 bg-panel p-1 lg:flex">
              <NavPill href="#top" icon={<LayoutDashboard className="h-3.5 w-3.5" />} label="Dashboard" active />
              <NavPill href="#intelligence" icon={<TrendingUp className="h-3.5 w-3.5" />} label="Price chart" />
              <NavPill href="#actions" icon={<ListChecks className="h-3.5 w-3.5" />} label="Actions" />
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium text-mist transition-colors hover:bg-panel2 hover:text-wine"
              >
                <Settings2 className="h-3.5 w-3.5" /> Settings
              </button>
            </nav>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border border-wine/10 bg-panel px-3 py-1.5 text-[11px] font-semibold ${
                  stats?.mode === "live" ? "text-leaf-ink" : "text-rose"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${stats?.mode === "live" ? "animate-pulse bg-leaf" : "bg-blush"}`} />
                {stats?.mode === "live" ? "TinyFish LIVE" : "DEMO MODE — add API key"}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSettingsOpen(true)}
                aria-label="Repricing settings"
                className="text-mist hover:bg-panel2 hover:text-wine lg:hidden"
              >
                <Settings2 className="h-4 w-4" />
              </Button>
              <span className="grid h-9 w-9 place-items-center rounded-full border border-wine/20 bg-gradient-to-br from-blush to-wine font-display text-xs text-cream" title="GharKart store admin">
                GK
              </span>
            </div>
          </header>

          <div id="top" className="px-4 pb-8 pt-6 md:px-7">
            {/* hero — the team's floral pattern over a wine band */}
            <section className="relative mb-6 overflow-hidden rounded-3xl border border-blush/30 bg-wine px-5 py-9 md:px-10 md:py-12">
              <div aria-hidden className="absolute inset-0 bg-[url('/floral-bg.png')] bg-cover bg-center opacity-55" />
              <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-wine/85 via-wine/40 to-wine/85" />
              <div className="relative flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="mb-2.5 inline-flex items-center gap-2 rounded-full border border-blush/40 bg-wine/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-blush">
                    Live Competitor Intelligence Engine
                  </p>
                  <h1 className="font-display text-4xl uppercase tracking-tight text-cream md:text-5xl">
                    Price<span className="text-leaf">Pulse</span>
                  </h1>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-cream/75">
                    Real-time competitor pricing for {OUR_STORE}&apos;s household essentials — TinySearch finds the
                    pages, TinyFetch reads the prices behind the JS, the ML engine reprices within your guardrails.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setAddOpen(true)}
                    className="rounded-full border-cream/40 bg-wine/40 text-cream hover:bg-cream/15 hover:text-cream"
                  >
                    <Plus className="h-4 w-4" /> Add product
                  </Button>
                  <Button
                    onClick={() => runScan()}
                    className="rounded-full bg-leaf font-semibold text-[#0c2910] shadow-[0_0_30px_-8px_rgba(105,216,99,0.55)] hover:bg-leaf/90"
                  >
                    <Radar className="h-4 w-4" /> Run full scan
                  </Button>
                </div>
              </div>
            </section>

            {/* category filter + pipeline */}
            <section aria-label="Filters and pipeline" className="mb-6 flex flex-wrap items-center gap-2">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    category === c
                      ? "border-blush bg-blush font-semibold text-[#40152a]"
                      : "border-wine/15 bg-panel text-mist hover:border-blush/60 hover:text-wine"
                  }`}
                >
                  {c}
                </button>
              ))}
              <span className="mx-1 hidden h-5 w-px bg-wine/10 md:block" />
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5">
                {PIPELINE.map((s, i, arr) => (
                  <span key={s.n} className="flex items-center gap-1.5">
                    <span className="rounded-full border border-wine/10 bg-panel px-3 py-1.5 text-[11px]">
                      <span className="font-semibold text-rose">{s.n}</span>{" "}
                      <span className="text-mist">{s.d}</span>
                    </span>
                    {i < arr.length - 1 && <span className="text-wine/25">→</span>}
                  </span>
                ))}
              </div>
            </section>

            {/* KPI cards */}
            <section aria-label="Key metrics" className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
              <KpiCard
                icon={<span className="grid h-7 w-7 place-items-center rounded-lg bg-leaf/10"><Gauge className="h-4 w-4 text-leaf-ink" /></span>}
                label="Products tracked"
                value={stats?.productCount ?? "—"}
              />
              <KpiCard
                icon={<span className="grid h-7 w-7 place-items-center rounded-lg bg-blush/15"><Activity className="h-4 w-4 text-rose" /></span>}
                label="Competitor prices"
                value={stats?.competitorPriceCount ?? "—"}
              />
              <KpiCard
                icon={<span className="grid h-7 w-7 place-items-center rounded-lg bg-wine/10"><Target className="h-4 w-4 text-wine" /></span>}
                label="Avg price gap"
                value={stats ? `${stats.avgGapPct > 0 ? "+" : ""}${stats.avgGapPct.toFixed(1)}%` : "—"}
                hint={stats && stats.avgGapPct > 0 ? "you are above market" : "vs lowest competitor"}
              />
              <KpiCard
                icon={<span className="grid h-7 w-7 place-items-center rounded-lg bg-rosy/10"><Zap className="h-4 w-4 text-rosy" /></span>}
                label="Anomalies flagged"
                value={stats?.anomalyCount ?? "—"}
                hint="flash sales / glitches"
              />
              <KpiCard
                icon={<span className="grid h-7 w-7 place-items-center rounded-lg bg-leaf/10"><TrendingUp className="h-4 w-4 text-leaf-ink" /></span>}
                label="Pending actions"
                value={stats?.pendingRecommendations ?? "—"}
                hint={`${stats?.appliedRecommendations ?? 0} applied`}
              />
            </section>

            {/* main grid */}
            <div className="grid gap-4 xl:grid-cols-3">
              {/* products table */}
              <Card id="products" className="rounded-2xl border-wine/10 bg-panel xl:col-span-2">
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                  <div>
                    <CardTitle className="font-display text-sm font-bold uppercase tracking-widest text-wine">Tracked products</CardTitle>
                    <CardDescription className="text-mist">Live market position per product</CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => Promise.all([loadStats(), loadProducts(), loadRecommendations()])} aria-label="Refresh data" className="text-mist hover:bg-panel2 hover:text-wine">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-wine/10 hover:bg-transparent">
                          <TableHead className="text-mist">Product</TableHead>
                          <TableHead className="text-right text-mist">My price</TableHead>
                          <TableHead className="text-right text-mist">Lowest rival</TableHead>
                          <TableHead className="text-right text-mist">Gap</TableHead>
                          <TableHead className="text-right text-mist">Trend</TableHead>
                          <TableHead className="text-right text-mist">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          <TableRow>
                            <TableCell colSpan={6} className="py-10 text-center text-mist">Loading market data…</TableCell>
                          </TableRow>
                        ) : visibleProducts.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="py-10 text-center text-mist">
                              {products.length === 0
                                ? "No products yet — add one and run your first scan."
                                : `No products in “${category}”.`}
                            </TableCell>
                          </TableRow>
                        ) : (
                          visibleProducts.map((p) => (
                            <TableRow
                              key={p.id}
                              className={`cursor-pointer border-wine/10 hover:bg-panel2 ${selectedId === p.id ? "bg-blush/20" : ""}`}
                              onClick={() => setSelectedId(p.id)}
                            >
                              <TableCell>
                                <p className="font-medium text-wine">{p.name}</p>
                                <p className="text-xs text-mist">
                                  {p.sku} · {p.competitorCount} rivals · {p.observationCount} obs
                                </p>
                              </TableCell>
                              <TableCell className="text-right font-display font-semibold">{inr(p.myPrice)}</TableCell>
                              <TableCell className="text-right">
                                {p.lowestCompetitor ? (
                                  <>
                                    <p className="font-medium text-rose">{inr(p.lowestCompetitor.price)}</p>
                                    <p className="text-xs text-mist">{p.lowestCompetitor.name}</p>
                                  </>
                                ) : (
                                  <span className="text-xs text-mist">scan needed</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <GapBadge gapPct={p.gapPct} />
                              </TableCell>
                              <TableCell className="text-right">
                                <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${p.trendPct > 0.3 ? "text-rosy" : p.trendPct < -0.3 ? "text-leaf-ink" : "text-mist"}`}>
                                  {p.trendPct > 0.3 ? <ArrowUpRight className="h-3.5 w-3.5" /> : p.trendPct < -0.3 ? <ArrowDownRight className="h-3.5 w-3.5" /> : null}
                                  {p.trendPct > 0.3 ? "rising" : p.trendPct < -0.3 ? "falling" : "stable"}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 rounded-full border-wine/20 bg-panel px-3 text-xs text-wine hover:bg-panel2"
                                    onClick={(e) => { e.stopPropagation(); runScan(p.id, p.name); }}
                                  >
                                    <Radar className="h-3 w-3" /> Scan
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 rounded-full px-3 text-xs text-mist hover:bg-panel2 hover:text-rosy"
                                    onClick={(e) => { e.stopPropagation(); deleteProduct(p); }}
                                  >
                                    Remove
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* reprice queue */}
              <Card id="actions" className="rounded-2xl border-wine/10 bg-panel">
                <CardHeader className="pb-3">
                  <CardTitle className="font-display text-sm font-bold uppercase tracking-widest text-wine">Reprice queue</CardTitle>
                  <CardDescription className="text-mist">
                    Policy: {settings?.strategy ?? "—"} · undercut {settings?.undercutPct ?? "—"}% · max step {settings?.maxDeltaPct ?? "—"}%
                  </CardDescription>
                </CardHeader>
                <CardContent className="max-h-[430px] space-y-3 overflow-y-auto pr-1">
                  {recommendations.length === 0 ? (
                    <p className="py-8 text-center text-sm text-mist">
                      No pending recommendations. Run a scan to let the ML engine analyze the market.
                    </p>
                  ) : (
                    recommendations.map((r) => (
                      <div key={r.id} className="rounded-xl border border-wine/10 bg-panel2 p-3">
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium text-wine">{r.product.name}</p>
                          <ActionBadge action={r.action} />
                        </div>
                        <p className="text-xs text-mist">
                          {inr(r.currentPrice)} <span className="text-wine/30">→</span>{" "}
                          <span className={r.recommendedPrice < r.currentPrice ? "font-semibold text-leaf-ink" : "font-semibold text-rose"}>
                            {inr(r.recommendedPrice)}
                          </span>
                          <span className="ml-1 text-wine/30">
                            ({(((r.recommendedPrice - r.currentPrice) / r.currentPrice) * 100).toFixed(1)}%)
                          </span>
                        </p>
                        <div className="my-2 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-wine/10">
                            <div
                              className={`h-full rounded-full ${r.action === "RAISE" ? "bg-blush" : "bg-leaf"}`}
                              style={{ width: `${Math.round(r.confidence * 100)}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-mist">{Math.round(r.confidence * 100)}% conf.</span>
                        </div>
                        <p className="mb-2.5 line-clamp-3 text-[11px] leading-relaxed text-mist">{r.rationale}</p>
                        <div className="flex gap-2">
                          <Button size="sm" className="h-7 flex-1 rounded-full bg-leaf text-xs font-semibold text-[#0c2910] hover:bg-leaf/90" onClick={() => actOnRecommendation(r.id, "apply")}>
                            Apply reprice
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 flex-1 rounded-full border-wine/15 bg-panel text-xs text-mist hover:bg-panel2 hover:text-wine" onClick={() => actOnRecommendation(r.id, "dismiss")}>
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            {/* price intelligence */}
            <Card id="intelligence" className="mt-4 rounded-2xl border-wine/10 bg-panel">
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0 pb-2">
                <div>
                  <CardTitle className="font-display text-sm font-bold uppercase tracking-widest text-wine">
                    Price intelligence — {history?.product.name ?? "select a product"}
                  </CardTitle>
                  <CardDescription className="text-mist">
                    {history?.forecast
                      ? `OLS forecast: next price ~${inr(history.forecast.nextPrice)} · trend ${history.forecast.trend.toLowerCase()} · R² ${history.forecast.r2} · ${history.anomalies.length} anomalies flagged`
                      : "45-day market view: our price vs live competitor observations"}
                  </CardDescription>
                </div>
                <Select value={selectedId ?? ""} onValueChange={setSelectedId}>
                  <SelectTrigger className="w-56 border-wine/15 bg-panel2 text-wine">
                    <SelectValue placeholder="Choose product" />
                  </SelectTrigger>
                  <SelectContent className="border-wine/10 bg-panel text-wine">
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                {history ? (
                  <IntelligenceChart history={history} />
                ) : (
                  <div className="flex h-[340px] items-center justify-center text-sm text-mist">
                    {loading ? "Loading chart…" : "Select a product to view its market chart"}
                  </div>
                )}

                {/* competitor sources */}
                {history && history.competitors.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {history.competitors.map((c) => (
                      <a
                        key={c.domain}
                        href={`https://${c.domain}`}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex items-center gap-2 rounded-full border border-wine/10 bg-panel2 px-3 py-1.5 text-xs transition-colors hover:border-leaf/50"
                      >
                        <span className="font-medium text-wine/85 group-hover:text-wine">{c.name}</span>
                        <span className="text-leaf-ink">{inr(c.price)}</span>
                        <ExternalLink className="h-3 w-3 text-mist" />
                      </a>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* footer — floral wine band */}
          <footer className="relative overflow-hidden border-t border-blush/30 bg-wine px-4 py-4 md:px-7">
            <div aria-hidden className="absolute inset-0 bg-[url('/floral-bg.png')] bg-cover bg-center opacity-40" />
            <div className="relative flex flex-wrap items-center justify-between gap-2 text-xs text-cream/75">
              <p>
                PricePulse — Live Competitor Intelligence Engine · <span className="text-cream">Tracking {OUR_STORE} household essentials · Built for Kritical Hacks 2026</span>
              </p>
              <p>
                Web data powered by{" "}
                <a href="https://tinyfish.ai" target="_blank" rel="noreferrer" className="font-medium text-blush hover:underline">
                  TinyFish
                </a>{" "}
                (TinySearch · TinyFetch)
              </p>
            </div>
          </footer>
        </div>
      </div>

      {/* dialogs */}
      <ScanDialog key={scanRunId} open={scanOpen} onOpenChange={setScanOpen} response={scanResponse} running={scanRunning} scope={scanScope} />
      <AddProductDialog open={addOpen} onOpenChange={setAddOpen} onAdded={() => Promise.all([loadProducts(), loadStats()])} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} settings={settings} onSaved={() => { loadSettings(); loadStats(); }} />
    </div>
  );
}

/* ------------------------------ small pieces ------------------------------ */

function NavPill({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <a
      href={href}
      className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
        active ? "bg-blush text-[#40152a]" : "text-mist hover:bg-panel2 hover:text-wine"
      }`}
    >
      {icon}
      {label}
    </a>
  );
}

function KpiCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-wine/10 bg-panel p-4">
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-widest text-mist">{label}</span>
      </div>
      <p className="font-display text-2xl tracking-tight text-wine">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-mist">{hint}</p>}
    </div>
  );
}

function GapBadge({ gapPct }: { gapPct: number }) {
  const g = gapPct;
  if (!isFinite(g)) return <span className="text-xs text-mist">—</span>;
  if (g > 2) return <Badge variant="outline" className="border-rosy/40 text-rosy">+{g.toFixed(1)}% overpriced</Badge>;
  if (g > 0.5) return <Badge variant="outline" className="border-blush/60 text-rose">+{g.toFixed(1)}%</Badge>;
  if (g > -0.5) return <Badge variant="outline" className="border-leaf/50 text-leaf-ink">competitive</Badge>;
  return <Badge variant="outline" className="border-leaf/50 bg-leaf/10 text-leaf-ink">{g.toFixed(1)}% leading</Badge>;
}

function ActionBadge({ action }: { action: string }) {
  if (action === "UNDERCUT") return <Badge className="bg-leaf/15 text-leaf-ink hover:bg-leaf/15">UNDERCUT</Badge>;
  if (action === "RAISE") return <Badge className="bg-blush/20 text-rose hover:bg-blush/20">RAISE</Badge>;
  return <Badge variant="secondary" className="bg-wine/10 text-mist hover:bg-wine/10">HOLD</Badge>;
}
