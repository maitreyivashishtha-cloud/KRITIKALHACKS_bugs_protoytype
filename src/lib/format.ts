/** Indian-market formatting + store identity used across the app. */

export const OUR_STORE = "GharKart";

const inrFmt = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format a number as ₹ with Indian digit grouping, e.g. 1299 -> "₹1,299.00". */
export function inr(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return inrFmt.format(v);
}
