import { useEffect, useState } from "react";
import { getInventory, restock, updatePrice } from "../api/sas";
import { getErrorMessage } from "../api/client";
import type { InventoryItem } from "../api/types";
import { useRole } from "../context/RoleContext";
import { Alert, Button, Card, EmptyState, PageHeader, money } from "../components/ui";

export default function Inventory() {
  const { role } = useRole();
  const isManager = role === "manager";

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setItems(await getInventory());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Clear leftover input and messages when the role changes
  useEffect(() => {
    setInputs({});
    setMessage("");
    setError("");
  }, [role]);

  function setInput(barcode: string, value: string) {
    setInputs((prev) => ({ ...prev, [barcode]: value }));
  }

  async function handleSubmit(item: InventoryItem) {
    setMessage("");
    setError("");
    const value = Number(inputs[item.barcode]);
    if (!(value > 0)) {
      return setError(isManager ? "Enter a price greater than 0" : "Enter a quantity greater than 0");
    }
    try {
      if (isManager) {
        await updatePrice(item.barcode, value);
        setMessage(`${item.name}: price set to ${money(value)}`);
      } else {
        await restock(item.barcode, value);
        setMessage(`${item.name}: added ${value} to stock`);
      }
      setInput(item.barcode, "");
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  const actionLabel = isManager ? "New price" : "Quantity received";
  const actionButton = isManager ? "Set price" : "Add stock";

  return (
    <div>
      <PageHeader
        title={isManager ? "Inventory & Prices" : "Restock Inventory"}
        subtitle={
          isManager
            ? "Review stock levels and update today's selling prices."
            : "Record new supply as it arrives. Stock updates immediately."
        }
      />

      {message && <Alert kind="success">{message}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}

      <Card className="overflow-x-auto">
        {loading ? (
          <div className="space-y-3 p-6" aria-busy="true" aria-label="Loading inventory">
            {[0, 1, 2, 3, 4].map((n) => (
              <div key={n} className="h-8 animate-pulse rounded-ui bg-zinc-100" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState title="No items in inventory" hint="Run the seed script to add products." />
        ) : (
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-600">
                <th scope="col" className="px-4 py-3 font-medium">Item</th>
                <th scope="col" className="px-4 py-3 font-medium">Code</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Stock</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Price</th>
                {isManager && <th scope="col" className="px-4 py-3 text-right font-medium">Cost</th>}
                <th scope="col" className="px-4 py-3 font-medium">{actionLabel}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {items.map((i) => (
                <tr key={i.barcode}>
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    {i.name}
                    {i.is_weighted && <span className="ml-2 text-xs font-normal text-zinc-600">per kg</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-600">{i.barcode}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{i.stock_quantity}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{money(i.current_price)}</td>
                  {isManager && (
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-600">{money(i.cost_price)}</td>
                  )}
                  <td className="px-4 py-3">
                    <form
                      className="flex items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSubmit(i);
                      }}
                    >
                      <input
                        type="number"
                        min={0}
                        step={isManager ? 0.01 : i.is_weighted ? 0.01 : 1}
                        value={inputs[i.barcode] ?? ""}
                        onChange={(e) => setInput(i.barcode, e.target.value)}
                        aria-label={`${actionLabel} for ${i.name}`}
                        className="min-h-9 w-24 rounded-ui border border-zinc-300 bg-white px-2.5 tabular-nums focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent"
                      />
                      <Button type="submit" variant="ghost">{actionButton}</Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}