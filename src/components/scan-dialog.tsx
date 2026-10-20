"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { inr } from "@/lib/format";
import { CheckCircle2, Loader2, Radar, Search, ScanText, TrendingUp, XCircle } from "lucide-react";
import type { ScanResponse } from "@/lib/types";

const STAGES = [
  { key: "search", label: "TinySearch — locating live product pages", icon: Search },
  { key: "fetch", label: "TinyFetch — rendering JS pages to clean Markdown", icon: Radar },
  { key: "extract", label: "Extracting structured prices", icon: ScanText },
  { key: "ml", label: "ML engine — forecast, anomalies, repricing", icon: TrendingUp },
];

export function ScanDialog({
  open, onOpenChange, response, running, scope,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  response: ScanResponse | null;
  running: boolean;
  scope: string;
}) {
  const [stage, setStage] = useState(0);

  // animate the pipeline while the real scan runs in the background.
  // setState only inside the interval callback (never synchronously in the effect body).
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 1600);
    return () => clearInterval(t);
  }, [running]);

  // derived: once finished, show every stage as done
  const visibleStage = running ? stage : response ? STAGES.length : stage;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-wine/10 bg-panel text-wine sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radar className="h-5 w-5 text-leaf" />
            {running ? "Running intelligence scan" : "Scan complete"}
          </DialogTitle>
          <DialogDescription className="text-mist">
            Pipeline scope: {scope} — data via {response?.summary.mode === "live" || running ? "TinyFish APIs" : "demo simulator"}.
          </DialogDescription>
        </DialogHeader>

        {/* pipeline stages */}
        <div className="space-y-2.5 py-1">
          {STAGES.map((s, i) => {
            const Icon = s.icon;
            const done = i < visibleStage;
            const active = running && i === visibleStage;
            return (
              <div key={s.key} className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors ${
                active ? "border-blush/50 bg-blush/10" : done ? "border-leaf/30 bg-leaf/5" : "border-wine/10 bg-panel2"
              }`}>
                {active ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blush" />
                ) : done ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-leaf" />
                ) : (
                  <Icon className="h-4 w-4 shrink-0 text-mist" />
                )}
                <span className={`text-sm ${done || active ? "text-wine" : "text-mist"}`}>{s.label}</span>
              </div>
            );
          })}
        </div>

        {running && <Progress value={((visibleStage + 1) / STAGES.length) * 100} className="h-1.5" />}

        {/* per-product results */}
        {response && !running && (
          <ScrollArea className="max-h-56 rounded-xl border border-wine/10">
            <div className="divide-y divide-wine/10">
              {response.outcomes.map((o) => (
                <div key={o.productId} className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-wine">{o.productName}</p>
                    <p className="text-xs text-mist">
                      {o.pagesFetched} pages · {o.pricesExtracted} prices · {o.mode}
                      {o.status !== "success" ? ` · ${o.status}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {o.recommendation && (
                      <Badge
                        variant="outline"
                        className={
                          o.recommendation.action === "UNDERCUT"
                            ? "border-leaf/40 text-leaf-ink"
                            : o.recommendation.action === "RAISE"
                              ? "border-blush/60 text-rose"
                              : "border-wine/20 text-mist"
                        }
                      >
                        {o.recommendation.action} → {inr(o.recommendation.recommendedPrice)}
                      </Badge>
                    )}
                    {o.status === "failed" ? (
                      <XCircle className="h-4 w-4 text-rosy" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-leaf" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {response && !running && (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-wine/10 bg-panel2 p-2">
              <p className="font-display text-lg font-bold text-leaf-ink">{response.summary.pagesFetched}</p>
              <p className="text-[11px] text-mist">pages fetched</p>
            </div>
            <div className="rounded-xl border border-wine/10 bg-panel2 p-2">
              <p className="font-display text-lg font-bold text-leaf-ink">{response.summary.pricesCaptured}</p>
              <p className="text-[11px] text-mist">prices captured</p>
            </div>
            <div className="rounded-xl border border-wine/10 bg-panel2 p-2">
              <p className="font-display text-lg font-bold text-leaf-ink">{response.summary.recommendationsCreated}</p>
              <p className="text-[11px] text-mist">recommendations</p>
            </div>
          </div>
        )}

        {!running && (
          <Button onClick={() => onOpenChange(false)} className="rounded-full bg-leaf font-semibold text-[#0c2910] hover:bg-leaf/90">
            Done
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
