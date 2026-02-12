'use client';

import { useEffect, useState } from "react";
import Header from "@/components/Header";

type Summary = {
  totalEvents: number;
  byEvent: Record<string, number>;
  byPath: Record<string, number>;
  updatedAt: string | null;
};

function sortEntries(record: Record<string, number>): Array<[string, number]> {
  return Object.entries(record).sort((a, b) => b[1] - a[1]);
}

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch("/api/track", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Failed to load analytics (${response.status}).`);
        }
        const data = (await response.json()) as Summary;
        if (!cancelled) {
          setSummary(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load analytics.");
        }
      }
    };

    void load();
    const interval = window.setInterval(() => {
      void load();
    }, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const eventRows = sortEntries(summary?.byEvent ?? {});
  const pathRows = sortEntries(summary?.byPath ?? {});

  return (
    <div className="min-h-screen bg-gray-50 text-slate-800">
      <Header />
      <main className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-[#0f172a]">Analytics</h1>
          <p className="text-slate-600 mt-2">
            Anonymous counts only. No IP addresses are stored by this feature.
          </p>
          <p className="text-slate-600 mt-1">
            Total tracked events: <span className="font-bold text-slate-800">{summary?.totalEvents ?? 0}</span>
          </p>
          <p className="text-slate-500 text-sm mt-1">
            Last update: {summary?.updatedAt ? new Date(summary.updatedAt).toLocaleString() : "No events yet"}
          </p>
          <p className="text-slate-500 text-sm mt-1">
            Note: stored on disk (`.analytics/summary.json`) so totals persist on the same host.
          </p>
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-[#0f172a] mb-3">Top Click/Page Events</h2>
          {eventRows.length === 0 ? (
            <p className="text-slate-500">No events yet.</p>
          ) : (
            <ul className="space-y-2">
              {eventRows.map(([name, count]) => (
                <li
                  key={name}
                  className="flex items-center justify-between border border-slate-200 rounded-xl px-4 py-2 bg-slate-50"
                >
                  <span className="font-mono text-sm text-slate-700">{name}</span>
                  <span className="font-bold text-slate-900">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-[#0f172a] mb-3">Most Visited Paths</h2>
          {pathRows.length === 0 ? (
            <p className="text-slate-500">No page data yet.</p>
          ) : (
            <ul className="space-y-2">
              {pathRows.map(([name, count]) => (
                <li
                  key={name}
                  className="flex items-center justify-between border border-slate-200 rounded-xl px-4 py-2 bg-slate-50"
                >
                  <span className="font-mono text-sm text-slate-700">{name}</span>
                  <span className="font-bold text-slate-900">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
