"use client";

import { useMemo } from "react";
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { HistoryData } from "@/lib/types";
import { OUR_STORE, inr } from "@/lib/format";

const LINE_COLORS = ["#B65877", "#6E1E3B", "#D48FB0", "#96687C", "#B8912A", "#2F8032"];

interface ChartPoint {
  date: string;
  [key: string]: number | string | null;
}

export function IntelligenceChart({ history }: { history: HistoryData }) {
  const { chartData, competitorNames } = useMemo(() => {
    const byDay = new Map<string, ChartPoint>();
    const names = new Set<string>();

    for (const pt of history.series) {
      const day = pt.date.slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, { date: day });
      const point = byDay.get(day)!;
      // keep the latest observation per competitor per day
      const key = pt.competitor;
      const existing = point[key];
      if (existing === undefined || typeof existing !== "number" || pt.date > String(point.date)) {
        point[key] = pt.price;
      }
      names.add(key);
    }

    const sorted = [...byDay.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));

    // append a forecast point (next day) for each numeric series using the trend slope
    if (history.forecast && sorted.length) {
      const last = sorted[sorted.length - 1];
      const nextDay = new Date(`${String(last.date)}T00:00:00Z`);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      const forecastPoint: ChartPoint = {
        date: nextDay.toISOString().slice(0, 10),
      };
      for (const n of names) {
        const lastVal = lastValueOf(sorted, n);
        if (typeof lastVal === "number") {
          forecastPoint[n] = Math.round(lastVal * 100) / 100;
        }
      }
      if (history.product) {
        forecastPoint[OUR_STORE] = history.forecast.nextPrice;
      }
      forecastPoint["Forecast (OLS)"] = history.forecast.nextPrice;
      names.add("Forecast (OLS)");
      sorted.push(forecastPoint);
    }

    return { chartData: sorted, competitorNames: [...names].filter((n) => n !== OUR_STORE && n !== "Forecast (OLS)") };
  }, [history]);

  const anomalyDays = new Set(history.anomalies.map((a) => a.date.slice(0, 10)));

  return (
    <div className="h-[340px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(110,30,59,0.10)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: "#96687C", fontSize: 11 }}
            tickFormatter={(d: string) => d.slice(5)}
            minTickGap={24}
            stroke="rgba(110,30,59,0.20)"
          />
          <YAxis
            tick={{ fill: "#96687C", fontSize: 11 }}
            domain={["auto", "auto"]}
            tickFormatter={(v: number) => (v >= 1000 ? `₹${(v / 1000).toFixed(1)}k` : `₹${v.toFixed(0)}`)}
            stroke="rgba(110,30,59,0.20)"
          />
          <Tooltip
            contentStyle={{
              background: "#FFFDF2", border: "1px solid rgba(182,88,119,0.35)", borderRadius: 12,
              color: "#6E1E3B", fontSize: 12,
            }}
            formatter={(value) => (typeof value === "number" ? inr(value) : String(value))}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "#96687C" }} />

          {/* competitor lines (anomalous days dimmed visually via stroke opacity is not per-point in recharts; anomalies listed below) */}
          {competitorNames.map((name, i) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={LINE_COLORS[i % LINE_COLORS.length]}
              strokeWidth={1.6}
              dot={anomalyDays.size ? false : false}
              connectNulls
              isAnimationActive={false}
            />
          ))}

          {/* our price */}
          <Line
            type="monotone"
            dataKey={OUR_STORE}
            stroke="#2F8032"
            strokeWidth={2.8}
            dot={{ r: 2.5, fill: "#2F8032" }}
            connectNulls
            isAnimationActive={false}
          />

          {/* forecast */}
          <Line
            type="linear"
            dataKey="Forecast (OLS)"
            stroke="#69D863"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={{ r: 4, fill: "#69D863", stroke: "#FFFDF2" }}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function lastValueOf(data: ChartPoint[], key: string): number | string | null {
  for (let i = data.length - 1; i >= 0; i--) {
    const v = data[i][key];
    if (typeof v === "number") return v;
  }
  return null;
}
