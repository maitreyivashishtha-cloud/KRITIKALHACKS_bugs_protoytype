"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export function AddProductDialog({
  open, onOpenChange, onAdded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdded: () => void;
}) {
  const [form, setForm] = useState({ name: "", sku: "", category: "General", myPrice: "", cost: "" });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.name.trim() || !form.sku.trim() || !form.myPrice || !form.cost) {
      toast({ title: "Missing fields", description: "Name, SKU, price and cost are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          sku: form.sku.trim().toLowerCase().replace(/\s+/g, "-"),
          category: form.category.trim() || "General",
          myPrice: parseFloat(form.myPrice),
          cost: parseFloat(form.cost),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add product");
      toast({ title: "Product added", description: `${form.name} is now tracked. Run a scan to fetch live competitor prices.` });
      setForm({ name: "", sku: "", category: "General", myPrice: "", cost: "" });
      onOpenChange(false);
      onAdded();
    } catch (e) {
      toast({ title: "Could not add product", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-wine/10 bg-panel text-wine sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-leaf" /> Track a new product
          </DialogTitle>
          <DialogDescription className="text-mist">
            The first scan will use TinySearch to discover competitor listings automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="p-name">Product name</Label>
            <Input id="p-name" placeholder="ShineBoost Detergent Powder 4 kg" value={form.name} onChange={set("name")} className="border-wine/15 bg-panel2" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="p-sku">SKU</Label>
              <Input id="p-sku" placeholder="shineboost-detergent-4kg" value={form.sku} onChange={set("sku")} className="border-wine/15 bg-panel2" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-cat">Category</Label>
              <Input id="p-cat" placeholder="Laundry" value={form.category} onChange={set("category")} className="border-wine/15 bg-panel2" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="p-price">My price (₹)</Label>
              <Input id="p-price" type="number" min="0.5" step="0.01" placeholder="499" value={form.myPrice} onChange={set("myPrice")} className="border-wine/15 bg-panel2" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-cost">Unit cost (₹)</Label>
              <Input id="p-cost" type="number" min="0" step="0.01" placeholder="352" value={form.cost} onChange={set("cost")} className="border-wine/15 bg-panel2" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-wine/15 bg-transparent text-mist hover:bg-panel2 hover:text-wine">
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving} className="rounded-full bg-leaf font-semibold text-[#0c2910] hover:bg-leaf/90">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
