/**
 * TinyFish API client — web infrastructure for AI agents.
 *
 * Docs: https://docs.tinyfish.ai
 *  - TinySearch  GET  https://api.search.tinyfish.ai/   (header: X-API-Key)
 *  - TinyFetch   POST https://api.fetch.tinyfish.ai/    (header: X-API-Key)
 *
 * TinySearch returns fresh, browser-rendered, structured search results
 * (never cached) — used to locate live competitor product pages.
 *
 * TinyFetch renders JavaScript-heavy pages and returns clean, LLM-ready
 * Markdown/JSON — used to extract prices that traditional scrapers miss
 * (bot walls, dynamic pricing widgets, etc.).
 *
 * If TINYFISH_API_KEY is absent the app runs in DEMO mode: a built-in
 * simulator produces realistic search results and page content so the
 * full pipeline can be demonstrated offline (e.g. during a hackathon demo).
 */

const SEARCH_BASE = process.env.TINYFISH_SEARCH_BASE || "https://api.search.tinyfish.ai";
const FETCH_BASE = process.env.TINYFISH_FETCH_BASE || "https://api.fetch.tinyfish.ai";

export function tinyfishApiKey(): string | undefined {
  return process.env.TINYFISH_API_KEY;
}

/**
 * Live mode is on when a key exists — from the environment (TINYFISH_API_KEY)
 * or from the in-app Settings override (Settings.apiKey, pasted in the UI).
 */
export function isLiveMode(key?: string): boolean {
  return Boolean(key ?? tinyfishApiKey());
}

/* ---------------------------------- types --------------------------------- */

export interface SearchResult {
  position: number;
  site_name: string;
  title: string;
  url: string;
  snippet: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  total_results: number;
  page: number;
}

export interface FetchResult {
  url: string;
  final_url: string | null;
  title: string | null;
  description: string | null;
  format: "markdown" | "html" | "json";
  text: string | Record<string, unknown> | null;
  latency_ms?: number | null;
}

export interface FetchError {
  url: string;
  error: string;
  status?: number;
}

export interface FetchResponse {
  results: FetchResult[];
  errors: FetchError[];
}

export interface TinySearchOptions {
  query: string;
  purpose?: string;
  recencyMinutes?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
  maxResults?: number;
  apiKey?: string; // in-app key override (falls back to env)
}

export class TinyFishError extends Error {
  code: string;
  constructor(message: string, code = "TINYFISH_ERROR") {
    super(message);
    this.code = code;
  }
}

/* -------------------------------- TinySearch ------------------------------- */

export async function tinySearch(opts: TinySearchOptions): Promise<SearchResponse> {
  const key = opts.apiKey ?? tinyfishApiKey();
  if (!key) throw new TinyFishError("TINYFISH_API_KEY is not configured", "MISSING_API_KEY");

  const params = new URLSearchParams();
  params.set("query", opts.query);
  if (opts.purpose) params.set("purpose", opts.purpose);
  if (opts.recencyMinutes) params.set("recency_minutes", String(opts.recencyMinutes));
  if (opts.includeDomains?.length) params.set("include_domains", opts.includeDomains.join(","));
  if (opts.excludeDomains?.length) params.set("exclude_domains", opts.excludeDomains.join(","));

  const res = await fetch(`${SEARCH_BASE}/?${params.toString()}`, {
    method: "GET",
    headers: { "X-API-Key": key, Accept: "application/json" },
  });

  if (!res.ok) {
    let code = String(res.status);
    try {
      const body = (await res.json()) as { error?: { code?: string; message?: string } };
      code = body?.error?.code || code;
      throw new TinyFishError(body?.error?.message || `TinySearch failed (${res.status})`, code);
    } catch (e) {
      if (e instanceof TinyFishError) throw e;
      throw new TinyFishError(`TinySearch failed with status ${res.status}`, code);
    }
  }

  const data = (await res.json()) as SearchResponse;
  if (opts.maxResults) data.results = data.results.slice(0, opts.maxResults);
  return data;
}

/* --------------------------------- TinyFetch ------------------------------- */

export interface TinyFetchOptions {
  urls: string[];
  purpose?: string;
  format?: "markdown" | "html" | "json";
  ttl?: number; // 0 => prefer a live fetch, never serve stale cache
  apiKey?: string; // in-app key override (falls back to env)
}

export async function tinyFetch(opts: TinyFetchOptions): Promise<FetchResponse> {
  const key = opts.apiKey ?? tinyfishApiKey();
  if (!key) throw new TinyFishError("TINYFISH_API_KEY is not configured", "MISSING_API_KEY");

  const body: Record<string, unknown> = {
    urls: opts.urls.slice(0, 10), // API accepts 1-10 URLs per call
    format: opts.format || "markdown",
    ttl: opts.ttl ?? 0, // pricing intelligence requires live data, not cache
  };
  if (opts.purpose) body.purpose = opts.purpose;

  const res = await fetch(`${FETCH_BASE}/`, {
    method: "POST",
    headers: {
      "X-API-Key": key,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let message = `TinyFetch failed with status ${res.status}`;
    let code = String(res.status);
    try {
      const err = (await res.json()) as { error?: { code?: string; message?: string } };
      if (err?.error?.message) message = err.error.message;
      if (err?.error?.code) code = err.error.code;
    } catch {
      /* keep default message */
    }
    throw new TinyFishError(message, code);
  }

  return (await res.json()) as FetchResponse;
}

/* ------------------------------- demo fallback ----------------------------- */

import { demoSearch, demoFetch } from "./demo";

export interface SearchAndFetchOutcome {
  mode: "live" | "demo";
  results: SearchResult[];
  pages: { url: string; title: string | null; content: string }[];
  fetchErrors: FetchError[];
}

/**
 * Unified pipeline primitive used by the scan engine:
 *  1. find live competitor product pages (TinySearch, or simulated)
 *  2. render + extract clean page content (TinyFetch, or simulated)
 *
 * Falls back to the demo simulator automatically when no API key is set,
 * so the product is always demo-able end to end.
 */
export async function searchAndFetch(opts: {
  searchQuery: string;
  purpose: string;
  productKey: string; // stable key used by the demo simulator
  maxResults?: number;
  apiKey?: string; // in-app key override (falls back to env)
}): Promise<SearchAndFetchOutcome> {
  const maxResults = opts.maxResults ?? 5;
  const key = opts.apiKey ?? tinyfishApiKey();

  if (!isLiveMode(key)) {
    const sim = demoSearch(opts.productKey, opts.searchQuery, maxResults);
    const fetched = demoFetch(opts.productKey, sim.results);
    return {
      mode: "demo",
      results: sim.results,
      pages: fetched,
      fetchErrors: [],
    };
  }

  const search = await tinySearch({
    query: opts.searchQuery,
    purpose: opts.purpose,
    recencyMinutes: 60 * 24, // freshest possible results
    maxResults,
    apiKey: key,
  });

  const urls = search.results.map((r) => r.url);
  const pages: { url: string; title: string | null; content: string }[] = [];
  const fetchErrors: FetchError[] = [];

  if (urls.length) {
    const fetched = await tinyFetch({ urls, purpose: opts.purpose, format: "markdown", ttl: 0, apiKey: key });
    for (const r of fetched.results) {
      pages.push({
        url: r.url,
        title: r.title,
        content: typeof r.text === "string" ? r.text : JSON.stringify(r.text ?? {}),
      });
    }
    fetchErrors.push(...fetched.errors);
  }

  return { mode: "live", results: search.results, pages, fetchErrors };
}
