"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ExternalLink, Fish, Loader2, Settings2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { SettingsData } from "@/lib/types";

export function SettingsDialog({
  open, onOpenChange, settings, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  settings: SettingsData | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<SettingsData | null>(settings);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => setForm(settings), [settings]);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          // only send the key when the user typed one; blank = keep current
          apiKey: apiKeyInput.trim() ? apiKeyInput.trim() : undefined,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast({
        title: "Settings saved",
        description: apiKeyInput.trim()
          ? "TinyFish key stored — next scan runs in LIVE mode."
          : "Applied to the next intelligence scan.",
      });
      setApiKeyInput("");
      onOpenChange(false);
      onSaved();
    } catch {
      toast({ title: "Could not save settings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!form) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-wine/10 bg-panel text-wine sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-leaf" /> Repricing policy
          </DialogTitle>
          <DialogDescription className="text-mist">
            Business guardrails applied by the ML recommender on every scan.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Strategy</Label>
            <Select value={form.strategy} onValueChange={(v) => setForm({ ...form, strategy: v as SettingsData["strategy"] })}>
              <SelectTrigger className="border-wine/15 bg-panel2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-wine/10 bg-panel text-wine">
                <SelectItem value="UNDERCUT">Undercut lowest competitor</SelectItem>
                <SelectItem value="MATCH">Match market average</SelectItem>
                <SelectItem value="PREMIUM">Hold premium (avg +5%)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="s-undercut">Undercut %</Label>
              <Input id="s-undercut" type="number" step="0.5" min="0" max="20" value={form.undercutPct}
                onChange={(e) => setForm({ ...form, undercutPct: parseFloat(e.target.value) || 0 })}
                className="border-wine/15 bg-panel2" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="s-delta">Max step %</Label>
              <Input id="s-delta" type="number" step="0.5" min="0.5" max="30" value={form.maxDeltaPct}
                onChange={(e) => setForm({ ...form, maxDeltaPct: parseFloat(e.target.value) || 0 })}
                className="border-wine/15 bg-panel2" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="s-floor">Margin floor %</Label>
              <Input id="s-floor" type="number" step="1" min="0" max="100" value={form.floorMarginPct}
                onChange={(e) => setForm({ ...form, floorMarginPct: parseFloat(e.target.value) || 0 })}
                className="border-wine/15 bg-panel2" />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-wine/10 bg-panel2 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-wine">Auto-apply recommendations</p>
              <p className="text-xs text-mist">Reprice automatically after each scan (within guardrails)</p>
            </div>
            <Switch checked={form.autoApply} onCheckedChange={(v) => setForm({ ...form, autoApply: v })} />
          </div>

          {/* TinyFish API key */}
          <div className="rounded-xl border border-blush/40 bg-blush/15 px-3 py-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-medium text-wine">
                <Fish className="h-4 w-4 text-rose" /> TinyFish API key
              </p>
              {form.apiKeySet ? (
                <Badge variant="outline" className="border-leaf/40 text-leaf-ink">Saved · {form.apiKeyPreview}</Badge>
              ) : (
                <Badge variant="outline" className="border-blush/60 text-rose">Not set — demo mode</Badge>
              )}
            </div>
            <Input
              type="password"
              placeholder="Paste your TinyFish API key (tf_…)"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              className="border-wine/15 bg-panel2"
              autoComplete="off"
            />
            <p className="mt-2 text-[11px] leading-relaxed text-mist">
              Paste your key to switch from the offline simulator to live TinySearch + TinyFetch using your
              credits. Stored server-side, never returned raw. Leave blank to keep the current key.{" "}
              <a href="https://tinyfish.ai" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-medium text-rose hover:underline">
                Get credits <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-wine/15 bg-transparent text-mist hover:bg-panel2 hover:text-wine">
            Cancel
          </Button>
          <Button onClick={save} disabled={saving} className="rounded-full bg-leaf font-semibold text-[#0c2910] hover:bg-leaf/90">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save settings"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
