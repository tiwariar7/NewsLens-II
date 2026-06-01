"use client";

import { useEffect, useState } from "react";
import { fetchAnalytics } from "@/lib/api";
import { AnalyticsResponse } from "@/types";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  BarChart, Bar,
} from "recharts";
import { BookOpen, Clock, TrendingUp, Heart } from "lucide-react";

const SENTIMENT_COLORS: Record<string, string> = {
  Positive: "#22c55e",
  Neutral:  "#a78bfa",
  Negative: "#f87171",
};

const CATEGORY_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6",
];

function StatCard({ icon: Icon, label, value, sub }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="rounded-xl bg-primary/10 p-3 text-primary">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

const EMPTY: AnalyticsResponse = {
  weekly_reading_time: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => ({ day: d, minutes: 0 })),
  top_categories: [],
  sentiment_bias: [
    { label: "Positive", value: 0 },
    { label: "Neutral",  value: 0 },
    { label: "Negative", value: 0 },
  ],
  total_articles_read: 0,
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsResponse>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = () => {
      fetchAnalytics()
        .then(setData)
        .catch(() => setError("Could not load analytics. Try reading a few articles first!"))
        .finally(() => setLoading(false));
    };

    // Initial load
    loadData();

    // Auto-refresh every 5 seconds for real-time dashboard feel
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const totalMinutes = data.weekly_reading_time.reduce((s, d) => s + d.minutes, 0);
  const topCategory = data.top_categories[0]?.name ?? "—";
  const dominantSentiment = [...data.sentiment_bias].sort((a, b) => b.value - a.value)[0]?.label ?? "—";

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">

      {/* Page header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold tracking-tight">Reading Analytics</h1>
        <p className="text-muted-foreground">Insights into your personal news consumption habits.</p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-xl border border-amber-400/40 bg-amber-50 dark:bg-amber-950/30 px-5 py-3 text-sm text-amber-700 dark:text-amber-300">
          ⚠️ {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={BookOpen}   label="Articles Read"     value={data.total_articles_read} />
        <StatCard icon={Clock}      label="Minutes This Week" value={totalMinutes.toFixed(0)} sub="last 7 days" />
        <StatCard icon={TrendingUp} label="Top Category"      value={topCategory} />
        <StatCard icon={Heart}      label="Sentiment Bias"    value={dominantSentiment} />
      </div>

      {/* Charts */}
      {loading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground animate-pulse">
          Loading your reading data…
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Weekly Reading Time — Line Chart */}
          <div className="rounded-2xl border bg-card p-5 shadow-sm col-span-1 md:col-span-2">
            <h2 className="font-semibold text-base mb-4">📈 Weekly Reading Time</h2>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data.weekly_reading_time}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis unit=" min" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: "10px", fontSize: "13px" }}
                  formatter={(v: number) => [`${v} min`, "Reading time"]}
                />
                <Line
                  type="monotone"
                  dataKey="minutes"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#6366f1" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Top Categories — Donut Chart */}
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="font-semibold text-base mb-4">🗂️ Top Categories</h2>
            {data.top_categories.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-muted-foreground text-sm text-center px-4">
                No category data yet.<br/>Read some articles to see your breakdown.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={data.top_categories}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    dataKey="value"
                    nameKey="name"
                    paddingAngle={3}
                  >
                    {data.top_categories.map((_, i) => (
                      <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: "12px" }} />
                  <Tooltip formatter={(v: number) => [`${v} articles`, "Read"]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Sentiment Bias — Bar Chart */}
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="font-semibold text-base mb-4">🧭 Sentiment Bias</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.sentiment_bias} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: "10px", fontSize: "13px" }}
                  formatter={(v: number, name: string) => [`${v} articles`, name]}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {data.sentiment_bias.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={SENTIMENT_COLORS[entry.label] ?? "#94a3b8"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

        </div>
      )}
    </div>
  );
}
