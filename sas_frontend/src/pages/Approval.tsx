import { useCallback, useEffect, useState } from "react";
import { CheckCircle } from "@phosphor-icons/react";
import { getPendingItems, approveItem } from "../api/sas";
import { getErrorMessage } from "../api/client";
import type { PendingItem } from "../api/types";
import { Alert, Button, Card, EmptyState, PageHeader, money } from "../components/ui";

export default function Approvals() {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busyCode, setBusyCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await getPendingItems());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const suggested = (i: PendingItem) => (i.cost_price * 1.2).toFixed(2);
  const valueFor = (i: PendingItem) => prices[i.barcode] ?? suggested(i);

  async function approve(item: PendingItem) {
    setMessage("");
    setError("");
    const price = Number(valueFor(item));
    if (!(price > 0)) return setError("Enter a selling price greater than 0");
    if (price < item.cost_price) {
      return setError(`${item.name}: selling price can't be below the cost price (${money(item.cost_price)})`);
    }

    setBusyCode(item.barcode);
    try {
      await approveItem(item.barcode, price);
      setMessage(`${item.name} approved at ${money(price)} and is now available for billing`);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyCode(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Pending Approvals"
        subtitle="Set a selling price for each new item to make it available at the counter."
      />

      {message && <Alert kind="success">{message}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}

      <Card className="overflow-x-auto">
        {loading ? (
          <div className="space-y-3 p-6" aria-busy="true" aria-label="Loading pending items">
            {[0, 1, 2].map((n) => (
              <div key={n} className="h-8 animate-pulse rounded-ui bg-zinc-100" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState title="Nothing waiting for approval" hint="New items added by employees will appear here." />
        ) : (
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-600">
                <th scope="col" className="px-4 py-3 font-medium">Item</th>
                <th scope="col" className="px-4 py-3 font-medium">Code</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Stock</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Cost</th>
                <th scope="col" className="px-4 py-3 font-medium">Selling price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {items.map((i) => {
                const price = Number(valueFor(i));
                const below = price > 0 && price < i.cost_price;
                return (
                  <tr key={i.barcode}>
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      {i.name}
                      {i.is_weighted && <span className="ml-2 text-xs font-normal text-zinc-600">per kg</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-600">{i.barcode}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{i.stock_quantity}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(i.cost_price)}</td>
                    <td className="px-4 py-3">
                      <form
                        className="flex items-center gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          approve(i);
                        }}
                      >
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={valueFor(i)}
                          onChange={(e) => setPrices((p) => ({ ...p, [i.barcode]: e.target.value }))}
                          aria-label={`Selling price for ${i.name}`}
                          aria-invalid={below}
                          className={`min-h-9 w-28 rounded-ui border bg-white px-2.5 tabular-nums focus-visible:outline-2 focus-visible:outline-accent ${
                            below ? "border-red-400" : "border-zinc-300 focus-visible:border-accent"
                          }`}
                        />
                        <Button type="submit" disabled={busyCode === i.barcode || below}>
                          <CheckCircle size={16} aria-hidden="true" />
                          {busyCode === i.barcode ? "Approving" : "Approve"}
                        </Button>
                      </form>
                      {below ? (
                        <p className="mt-1 text-xs text-red-700">Below cost price</p>
                      ) : (
                        prices[i.barcode] === undefined && (
                          <p className="mt-1 text-xs text-zinc-600">Suggested: cost + 20%</p>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}