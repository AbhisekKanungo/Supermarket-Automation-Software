import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { PlusIcon, TrashIcon, MinusIcon } from "@phosphor-icons/react";
import { getInventory, checkout } from "../api/sas";
import { getErrorMessage } from "../api/client";
import type { InventoryItem, Bill } from "../api/types";
import BillView from "../components/BillView";
import { Alert, Button, Card, EmptyState, Field, PageHeader, money } from "../components/ui";

interface CartLine {
  barcode: string;
  quantity: number;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

// Weighed items: stored in kg, shown and typed in grams, 10 g minimum step
const GRAM_STEP = 10;
const kgToG = (kg: number) => Math.round(kg * 1000);
const gToKg = (g: number) => round3(g / 1000);
const fmtQty = (item: InventoryItem, qty: number) =>
  item.is_weighted ? `${kgToG(qty)} g` : String(qty);

// Typable quantity box. Keeps what you type as text while editing and applies it
// on blur or Enter, then resyncs when +/- buttons change the quantity.
function QtyInput({
  item,
  quantity,
  onCommit,
}: {
  item: InventoryItem;
  quantity: number;
  onCommit: (raw: number) => void;
}) {
  const shown = item.is_weighted ? String(kgToG(quantity)) : String(quantity);
  const [text, setText] = useState(shown);

  useEffect(() => {
    setText(shown);
  }, [shown]);

  function commit() {
    const n = Number(text);
    if (text.trim() === "" || !Number.isFinite(n)) {
      setText(shown); // invalid input: revert
      return;
    }
    // Weighed items are typed in grams; convert to kg for storage
    onCommit(item.is_weighted ? n / 1000 : n);
    setText(shown); // resync in case the value was snapped or rejected
  }

 return (
  <div className="flex items-center">
    <input
      type="text"
      inputMode="numeric"
      value={text}
      onChange={(e) => setText(e.target.value.replace(/[^0-9.]/g, ""))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
      }}
      aria-label={`Quantity of ${item.name}${item.is_weighted ? " in grams" : ""}`}
      className="min-h-9 w-16 border-y border-zinc-300 bg-accent px-1 text-center font-medium tabular-nums text-emerald-900 focus-visible:relative focus-visible:z-10 focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent"
    />
  </div>
);
}

export default function Billing() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [clerkId, setClerkId] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [bill, setBill] = useState<Bill | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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

  const byBarcode = useMemo(() => new Map(items.map((i) => [i.barcode, i])), [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => i.name.toLowerCase().includes(q) || i.barcode.toLowerCase().includes(q)
    );
  }, [items, query]);

  const lines = cart.flatMap((l) => {
    const item = byBarcode.get(l.barcode);
    return item ? [{ item, quantity: l.quantity }] : [];
  });

  const total = lines.reduce((sum, l) => sum + l.quantity * l.item.current_price, 0);

  const inCartQty = (barcode: string) => cart.find((l) => l.barcode === barcode)?.quantity ?? 0;

  function addToCart(item: InventoryItem) {
    setError("");
    const remaining = round3(item.stock_quantity - inCartQty(item.barcode));
    // Regular items add 1 unit; weighed items add 100 g (or whatever is left)
    const step = item.is_weighted ? Math.min(0.1, remaining) : 1;
    if (remaining <= 0 || remaining < step) {
      return setError(`No more ${item.name} in stock`);
    }
    setCart((prev) =>
      prev.some((l) => l.barcode === item.barcode)
        ? prev.map((l) =>
            l.barcode === item.barcode ? { ...l, quantity: round3(l.quantity + step) } : l
          )
        : [...prev, { barcode: item.barcode, quantity: step }]
    );
  }

  // Step in the item's own unit: +/-1 for units, +/-10 g for weighed items
  function changeQuantity(item: InventoryItem, direction: 1 | -1) {
    const step = item.is_weighted ? gToKg(GRAM_STEP) : 1;
    const current = cart.find((l) => l.barcode === item.barcode)?.quantity ?? 0;
    setQuantity(item, round3(current + direction * step));
  }

  // Central place that validates a new quantity and applies it
  function setQuantity(item: InventoryItem, raw: number) {
    setError("");
    if (!Number.isFinite(raw)) return;

    // Snap to the smallest allowed step: 10 g for weighed items, whole units otherwise
    const next = item.is_weighted
      ? gToKg(Math.round(kgToG(raw) / GRAM_STEP) * GRAM_STEP)
      : Math.round(raw);

    if (next <= 0) {
      // Going to zero removes the line
      setCart((prev) => prev.filter((l) => l.barcode !== item.barcode));
      return;
    }

    if (next > item.stock_quantity) {
      setError(`Only ${fmtQty(item, item.stock_quantity)} of ${item.name} in stock`);
      return;
    }

    setCart((prev) =>
      prev.map((l) => (l.barcode === item.barcode ? { ...l, quantity: next } : l))
    );
  }

  function removeLine(barcode: string) {
    setCart((prev) => prev.filter((l) => l.barcode !== barcode));
  }

  // Enter on an exact barcode match adds the item (scanner behaviour)
  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    const match = byBarcode.get(query.trim());
    if (match) {
      addToCart(match);
      setQuery("");
    }
  }

  async function handleCheckout() {
    setError("");
    if (!clerkId.trim()) return setError("Enter a clerk ID before checkout");
    if (lines.some((l) => !(l.quantity > 0))) return setError("All quantities must be greater than 0");
    const over = lines.find((l) => l.quantity > l.item.stock_quantity);
    if (over) {
      return setError(`Only ${fmtQty(over.item, over.item.stock_quantity)} of ${over.item.name} in stock`);
    }

    setBusy(true);
    try {
      const result = await checkout({
        clerk_id: clerkId.trim(),
        items: lines.map((l) => ({ barcode: l.item.barcode, quantity: l.quantity })),
      });
      setBill(result);
      setCart([]);
      load(); // refresh stock levels after the sale
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (bill) return <BillView bill={bill} onNewSale={() => setBill(null)} />;

  return (
    <div>
      <PageHeader title="Billing Counter" subtitle="Add items to the bill, then check out." />

      {error && <Alert kind="error">{error}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Item catalogue */}
        <div>
          <form onSubmit={handleSearchSubmit} className="mb-4">
            <Field
              id="search"
              label="Search items"
              type="search"
              autoFocus
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name or code. Scan a barcode and press Enter to add."
              className="w-full"
            />
          </form>

          <p className="mb-3 text-sm text-zinc-600" aria-live="polite">
            {loading ? "Loading items" : `Showing ${filtered.length} of ${items.length} items`}
          </p>

          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2" aria-busy="true">
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <div key={n} className="h-32 animate-pulse rounded-ui bg-zinc-100" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <Card>
              <EmptyState title="No items in inventory" hint="Add products from the Restock page first." />
            </Card>
          ) : filtered.length === 0 ? (
            <Card>
              <EmptyState title="No items match your search" hint="Try a different name or code." />
            </Card>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {filtered.map((item) => {
                const inCart = inCartQty(item.barcode);
                const remaining = round3(item.stock_quantity - inCart);
                const out = item.stock_quantity <= 0;
                return (
                  <li
                    key={item.barcode}
                    className="flex flex-col justify-between rounded-ui border border-zinc-200 bg-white p-4"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-medium text-zinc-900">{item.name}</h3>
                        {inCart > 0 && (
                          <span className="whitespace-nowrap rounded-ui bg-accent-soft px-2 py-0.5 text-xs font-medium text-emerald-900">
                            {fmtQty(item, inCart)} on bill
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 font-mono text-xs text-zinc-600">{item.barcode}</p>
                    </div>

                    <div className="mt-4 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold tabular-nums">
                          {money(item.current_price)}
                          {item.is_weighted && (
                            <span className="text-xs font-normal text-zinc-600"> / kg</span>
                          )}
                        </p>
                        <p className={`text-xs ${out || remaining <= 0 ? "font-medium text-red-700" : "text-zinc-600"}`}>
                          {out
                            ? "Out of stock"
                            : remaining <= 0
                              ? "All stock on bill"
                              : `${fmtQty(item, remaining)} in stock`}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        onClick={() => addToCart(item)}
                        disabled={remaining <= 0}
                        aria-label={`Add ${item.name} to bill`}
                      >
                        <PlusIcon size={16} aria-hidden="true" /> Add
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Current bill */}
        <Card className="flex max-h-[calc(100dvh-6rem)] flex-col self-start lg:sticky lg:top-20">
          <div className="border-b border-zinc-200 p-4">
            <h2 className="text-sm font-medium text-zinc-600">Current bill</h2>
          </div>

          <div className="min-h-24 flex-1 overflow-y-auto">
            {lines.length === 0 ? (
              <EmptyState title="Bill is empty" hint="Add items from the list or scan a barcode." />
            ) : (
              <ul className="divide-y divide-zinc-100">
                {lines.map(({ item, quantity }) => (
                  <li key={item.barcode} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-zinc-900">{item.name}</p>
                        <p className="text-xs tabular-nums text-zinc-600">
                          {money(item.current_price)} {item.is_weighted ? "per kg" : "each"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLine(item.barcode)}
                        aria-label={`Remove ${item.name}`}
                        className="inline-flex size-9 shrink-0 items-center justify-center rounded-ui text-zinc-600 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-accent"
                      >
                        <TrashIcon size={16} aria-hidden="true" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center">
                       <button
                          type="button"
                          onClick={() => changeQuantity(item, -1)}
                          aria-label={`Decrease quantity of ${item.name}`}
                          className="inline-flex size-9 items-center justify-center rounded-l-ui border border-zinc-300 bg-white text-zinc-800 transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent-hover active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-accent"
                        >
                          <MinusIcon size={14} weight="bold" aria-hidden="true" />
                        </button>
                        <QtyInput
                          item={item}
                          quantity={quantity}
                          onCommit={(raw) => setQuantity(item, raw)}
                        />
                        <button
                          type="button"
                          onClick={() => changeQuantity(item, 1)}
                          disabled={quantity >= item.stock_quantity}
                          aria-label={`Increase quantity of ${item.name}`}
                          className="inline-flex size-9 items-center justify-center rounded-r-ui border border-zinc-300 bg-white text-zinc-800 transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent-hover active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-zinc-300 disabled:hover:bg-white disabled:hover:text-zinc-800"
                        >
                          <PlusIcon size={14} weight="bold" aria-hidden="true" />
                        </button>
                        {item.is_weighted && (
                          <span className="ml-1.5 text-xs text-zinc-600" aria-hidden="true">
                            10g
                          </span>
                        )}
                      </div>
                      <span className="font-medium tabular-nums">
                        {money(quantity * item.current_price)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-zinc-200 p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-zinc-600">Total</span>
              <span className="text-2xl font-semibold tabular-nums tracking-tight">{money(total)}</span>
            </div>
            <p className="mt-1 text-xs text-zinc-600">Final total is confirmed at checkout.</p>
            <div className="mt-4">
              <Field
                id="clerk"
                label="Clerk ID"
                value={clerkId}
                onChange={(e) => setClerkId(e.target.value)}
                placeholder="e.g. clerk01"
                className="w-full"
              />
            </div>
            <Button
              onClick={handleCheckout}
              disabled={busy || lines.length === 0}
              className="mt-4 w-full"
            >
              {busy ? "Processing" : "Check out"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}