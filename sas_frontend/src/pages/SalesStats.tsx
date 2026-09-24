import { useCallback, useEffect, useMemo, useState } from "react";
import { Printer, CaretUp, CaretDown } from "@phosphor-icons/react";
import { getSalesStats } from "../api/sas";
import { getErrorMessage } from "../api/client";
import type { SalesStat } from "../api/types";
import { Alert, Button, Card, EmptyState, Field, PageHeader, money } from "../components/ui";

type SortKey = "item_name" | "quantity_sold" | "price_realized" | "profit" | "margin";

// Local date as YYYY-MM-DD (toISOString would shift the day for users ahead of UTC)
function toDateString(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateString(d);
}

const num = (s: string) => Number(s) || 0;

export default function SalesStats() {
  const today = toDateString(new Date());
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [rows, setRows] = useState<SalesStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("profit");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [reportRange, setReportRange] = useState({ start: today, end: today });

  const load = useCallback(async (s: string, e: string) => {
    setError("");
    if (s > e) {
      setLoading(false);
      return setError("Start date must be on or before the end date");
    }
    setLoading(true);
    try {
      setRows(await getSalesStats(s, e));
      setReportRange({ start: s, end: e });
    } catch (err) {
      setError(getErrorMessage(err));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(today, today);
  }, [load, today]);

  function applyRange(s: string, e: string) {
    setStart(s);
    setEnd(e);
    load(s, e);
  }

  const enriched = useMemo(
    () =>
      rows.map((r) => {
        const revenue = num(r.price_realized);
        const profit = num(r.profit);
        return {
          ...r,
          qty: num(r.quantity_sold),
          revenue,
          profitNum: profit,
          margin: revenue > 0 ? (profit / revenue) * 100 : 0,
        };
      }),
    [rows]
  );

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...enriched].sort((a, b) => {
      switch (sortKey) {
        case "item_name":
          return a.item_name.localeCompare(b.item_name) * dir;
        case "quantity_sold":
          return (a.qty - b.qty) * dir;
        case "price_realized":
          return (a.revenue - b.revenue) * dir;
        case "profit":
          return (a.profitNum - b.profitNum) * dir;
        case "margin":
          return (a.margin - b.margin) * dir;
      }
    });
  }, [enriched, sortKey, sortDir]);

  const totals = useMemo(
    () =>
      enriched.reduce(
        (t, r) => ({ qty: t.qty + r.qty, revenue: t.revenue + r.revenue, profit: t.profit + r.profitNum }),
        { qty: 0, revenue: 0, profit: 0 }
      ),
    [enriched]
  );

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "item_name" ? "asc" : "desc");
    }
  }

  function SortHeader({ label, k, align = "right" }: { label: string; k: SortKey; align?: "left" | "right" }) {
    const active = sortKey === k;
    return (
      <th
        scope="col"
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
        className={`px-4 py-3 font-medium ${align === "right" ? "text-right" : "text-left"}`}
      >
        <button
          type="button"
          onClick={() => toggleSort(k)}
          className={`inline-flex items-center gap-1 rounded-ui uppercase tracking-wide focus-visible:outline-2 focus-visible:outline-accent ${
            active ? "text-zinc-900" : "text-zinc-600 hover:text-zinc-900"
          }`}
        >
          {label}
          {active &&
            (sortDir === "asc" ? (
              <CaretUp size={12} weight="bold" aria-hidden="true" />
            ) : (
              <CaretDown size={12} weight="bold" aria-hidden="true" />
            ))}
        </button>
      </th>
    );
  }

  const rangeLabel =
    reportRange.start === reportRange.end
      ? reportRange.start
      : `${reportRange.start} to ${reportRange.end}`;

  const presets = [
    { label: "Today", s: today, e: today },
    { label: "Last 7 days", s: daysAgo(6), e: today },
    { label: "Last 30 days", s: daysAgo(29), e: today },
  ];

  return (
    <div>
      <div className="print:hidden">
        <PageHeader title="Sales Statistics" subtitle="Quantity sold, revenue and profit for any day or period." />

        <Card className="mb-6 p-4">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              load(start, end);
            }}
          >
            <Field
              id="start"
              label="From"
              type="date"
              value={start}
              max={today}
              onChange={(e) => setStart(e.target.value)}
              required
            />
            <Field
              id="end"
              label="To"
              type="date"
              value={end}
              max={today}
              onChange={(e) => setEnd(e.target.value)}
              required
            />
            <Button type="submit">Generate report</Button>
            <div className="flex flex-wrap gap-2 sm:ml-auto" role="group" aria-label="Quick ranges">
              {presets.map((p) => (
                <Button key={p.label} type="button" variant="ghost" onClick={() => applyRange(p.s, p.e)}>
                  {p.label}
                </Button>
              ))}
            </div>
          </form>
        </Card>

        {error && <Alert kind="error">{error}</Alert>}
      </div>

      <div id="printable-report">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Sales report</h2>
            <p className="text-sm text-zinc-600">{rangeLabel}</p>
          </div>
          <Button variant="ghost" onClick={() => window.print()} disabled={rows.length === 0} className="print:hidden">
            <Printer size={16} aria-hidden="true" /> Print report
          </Button>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Units sold", value: String(Math.round(totals.qty * 1000) / 1000) },
            { label: "Revenue", value: money(totals.revenue) },
            { label: "Profit", value: money(totals.profit) },
          ].map((c) => (
            <div key={c.label} className="rounded-ui border border-zinc-200 bg-white p-4">
              <p className="text-sm text-zinc-600">{c.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
                {loading ? <span className="inline-block h-7 w-24 animate-pulse rounded-ui bg-zinc-100 align-middle" /> : c.value}
              </p>
            </div>
          ))}
        </div>

        <Card className="overflow-x-auto">
          {loading ? (
            <div className="space-y-3 p-6" aria-busy="true" aria-label="Loading report">
              {[0, 1, 2, 3, 4].map((n) => (
                <div key={n} className="h-8 animate-pulse rounded-ui bg-zinc-100" />
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <EmptyState title="No sales in this period" hint="Pick a different date range, or make a sale from the Billing page." />
          ) : (
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs">
                  <SortHeader label="Item" k="item_name" align="left" />
                  <SortHeader label="Qty sold" k="quantity_sold" />
                  <SortHeader label="Price realized" k="price_realized" />
                  <SortHeader label="Profit" k="profit" />
                  <SortHeader label="Margin" k="margin" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {sorted.map((r) => (
                  <tr key={r.item_id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-900">{r.item_name}</div>
                      <div className="font-mono text-xs text-zinc-600">{r.barcode}</div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.qty}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(r.revenue)}</td>
                    <td className={`px-4 py-3 text-right font-medium tabular-nums ${r.profitNum < 0 ? "text-red-700" : ""}`}>
                      {money(r.profitNum)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-600">{r.margin.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-zinc-300 font-semibold">
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-right tabular-nums">{Math.round(totals.qty * 1000) / 1000}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{money(totals.revenue)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{money(totals.profit)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-600">
                    {totals.revenue > 0 ? ((totals.profit / totals.revenue) * 100).toFixed(1) : "0.0"}%
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}