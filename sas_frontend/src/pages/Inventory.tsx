import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowsClockwise } from "@phosphor-icons/react";
import { getInventory, restock, updatePrice, createItem } from "../api/sas";
import { getErrorMessage } from "../api/client";
import type { InventoryItem } from "../api/types";
import { useRole } from "../context/RoleContext";
import { Alert, Button, Card, EmptyState, Field, PageHeader, StatusBadge, money } from "../components/ui";

const generateBarcode = () =>
  "SAS" + Date.now().toString().slice(-7) + Math.floor(Math.random() * 90 + 10);

function NewItemForm({ existing, onDone }: { existing: InventoryItem[]; onDone: (msg: string) => void }) {
  const [barcode, setBarcode] = useState("");
  const [name, setName] = useState("");
  const [weighted, setWeighted] = useState(false);
  const [cost, setCost] = useState("");
  const [stock, setStock] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const code = barcode.trim();
  const clash = existing.find((i) => i.barcode === code);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!code) return setError("Enter or generate an item code");
    if (!name.trim()) return setError("Enter an item name");
    if (!(Number(cost) > 0)) return setError("Cost price must be greater than 0");
    if (stock !== "" && Number(stock) < 0) return setError("Opening stock can't be negative");

    setBusy(true);
    try {
      const res = await createItem({
        barcode: code,
        name: name.trim(),
        is_weighted: weighted,
        cost_price: Number(cost),
        stock_quantity: Number(stock || 0),
      });
      onDone(res.message);
      setBarcode("");
      setName("");
      setWeighted(false);
      setCost("");
      setStock("");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-6 p-5">
      <h2 className="text-base font-semibold tracking-tight">Add a new item</h2>
      <p className="mt-1 text-sm text-zinc-600">
        New items are sent to the manager for pricing. They can be billed once approved.
      </p>

      {error && (
        <div className="mt-4">
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      {clash && (
        <div className="mt-4 rounded-ui border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
          Code <span className="font-mono">{code}</span> already belongs to <strong>{clash.name}</strong>. Submitting will
          update that item, add this stock to it, and send it back to the manager for re-approval.
        </div>
      )}

      <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Field
              id="new-code"
              label="Item code"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Scan, type, or generate"
              autoComplete="off"
              className="w-full font-mono"
            />
          </div>
          <Button type="button" variant="ghost" onClick={() => setBarcode(generateBarcode())}>
            <ArrowsClockwise size={16} aria-hidden="true" /> Generate
          </Button>
        </div>

        <Field
          id="new-name"
          label="Item name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Basmati Rice"
          autoComplete="off"
          className="w-full"
        />

        <Field
          id="new-cost"
          label="Cost price"
          type="number"
          min={0}
          step={0.01}
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          placeholder="0.00"
          className="w-full"
        />

        <Field
          id="new-stock"
          label={weighted ? "Opening stock (kg)" : "Opening stock (units)"}
          type="number"
          min={0}
          step={weighted ? 0.001 : 1}
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          placeholder="0"
          className="w-full"
        />

        <label className="flex items-center gap-2 text-sm text-zinc-800 sm:col-span-2">
          <input
            type="checkbox"
            checked={weighted}
            onChange={(e) => setWeighted(e.target.checked)}
            className="size-4 accent-emerald-600"
          />
          Sold by weight (priced per kg)
        </label>

        <div className="sm:col-span-2">
          <Button type="submit" disabled={busy}>
            {busy ? "Submitting" : clash ? "Update & resubmit" : "Submit for approval"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export default function Inventory() {
  const { role } = useRole();
  const isManager = role === "manager";

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setItems(await getInventory());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
    if (isManager && value < item.cost_price) {
      return setError(`Price can't be below the cost price (${money(item.cost_price)})`);
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

  // Employees can only restock approved items; managers see everything
  const visible = isManager ? items : items.filter((i) => i.approval_status === "APPROVED");
  const pendingCount = items.filter((i) => i.approval_status === "PENDING").length;

  const actionLabel = isManager ? "New price" : "Quantity received";
  const actionButton = isManager ? "Set price" : "Add stock";

  return (
    <div>
      <PageHeader
        title={isManager ? "Inventory & Prices" : "Stock & New Items"}
        subtitle={
          isManager
            ? "Review stock levels and update selling prices."
            : "Register new items and record supply as it arrives."
        }
      />

      {message && <Alert kind="success">{message}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}

      {!isManager && (
        <NewItemForm
          existing={items}
          onDone={(msg) => {
            setError("");
            setMessage(msg);
            load();
          }}
        />
      )}

      {!isManager && pendingCount > 0 && (
        <p className="mb-3 text-sm text-zinc-600">
          {pendingCount} {pendingCount === 1 ? "item is" : "items are"} waiting for manager approval and can't be
          restocked or billed yet.
        </p>
      )}

      <Card className="overflow-x-auto">
        {loading ? (
          <div className="space-y-3 p-6" aria-busy="true" aria-label="Loading inventory">
            {[0, 1, 2, 3, 4].map((n) => (
              <div key={n} className="h-8 animate-pulse rounded-ui bg-zinc-100" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            title="No items to show"
            hint={isManager ? "Run the seed script or approve pending items." : "Add a new item above to get started."}
          />
        ) : (
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-600">
                <th scope="col" className="px-4 py-3 font-medium">Item</th>
                <th scope="col" className="px-4 py-3 font-medium">Code</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Stock</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Price</th>
                {isManager && <th scope="col" className="px-4 py-3 text-right font-medium">Cost</th>}
                {isManager && <th scope="col" className="px-4 py-3 font-medium">Status</th>}
                <th scope="col" className="px-4 py-3 font-medium">{actionLabel}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {visible.map((i) => {
                const editable = i.approval_status === "APPROVED";
                return (
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
                    {isManager && (
                      <td className="px-4 py-3">
                        <StatusBadge status={i.approval_status} />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      {editable ? (
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
                            step={isManager ? 0.01 : i.is_weighted ? 0.001 : 1}
                            value={inputs[i.barcode] ?? ""}
                            onChange={(e) => setInput(i.barcode, e.target.value)}
                            aria-label={`${actionLabel} for ${i.name}`}
                            className="min-h-9 w-24 rounded-ui border border-zinc-300 bg-white px-2.5 tabular-nums focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent"
                          />
                          <Button type="submit" variant="ghost">{actionButton}</Button>
                        </form>
                      ) : (
                        <span className="text-xs text-zinc-600">Set on the Approvals page</span>
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