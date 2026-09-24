import { useState, type FormEvent } from "react";
import { scanItem, checkout } from "../api/sas";
import { getErrorMessage } from "../api/client";
import type { ScannedItem, Bill } from "../api/types";
import BillView from "../components/BillView";

interface CartLine {
  item: ScannedItem;
  quantity: number;
}

export default function Billing() {
  const [barcode, setBarcode] = useState("");
  const [clerkId, setClerkId] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [bill, setBill] = useState<Bill | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const total = cart.reduce((sum, l) => sum + l.quantity * l.item.current_price, 0);

  async function handleScan(e: FormEvent) {
    e.preventDefault();
    const code = barcode.trim();
    if (!code) return;
    setError("");
    try {
      const item = await scanItem(code);
      setCart((prev) => {
        const existing = prev.find((l) => l.item.barcode === item.barcode);
        // Regular items: scanning again adds 1. Weighted items: add a new
        // weighing to the same line starting at 1 (editable in the cart).
        if (existing) {
          return prev.map((l) =>
            l.item.barcode === item.barcode ? { ...l, quantity: l.quantity + 1 } : l
          );
        }
        return [...prev, { item, quantity: 1 }];
      });
      setBarcode("");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  function updateQuantity(barcode: string, value: number) {
    setCart((prev) =>
      prev.map((l) => (l.item.barcode === barcode ? { ...l, quantity: value } : l))
    );
  }

  function removeLine(barcode: string) {
    setCart((prev) => prev.filter((l) => l.item.barcode !== barcode));
  }

  async function handleCheckout() {
    setError("");
    if (!clerkId.trim()) return setError("Enter a clerk ID before checkout");
    if (cart.some((l) => !(l.quantity > 0))) return setError("All quantities must be greater than 0");

    setBusy(true);
    try {
      const result = await checkout({
        clerk_id: clerkId.trim(),
        items: cart.map((l) => ({ barcode: l.item.barcode, quantity: l.quantity })),
      });
      setBill(result);
      setCart([]);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (bill) {
    return <BillView bill={bill} onNewSale={() => setBill(null)} />;
  }

  return (
    <div>
      <h2>Billing Counter</h2>

      <div style={{ marginBottom: "1rem" }}>
        <label>
          Clerk ID:{" "}
          <input value={clerkId} onChange={(e) => setClerkId(e.target.value)} placeholder="e.g. clerk01" />
        </label>
      </div>

      <form onSubmit={handleScan} style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <input
          autoFocus
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          placeholder="Scan or type barcode, press Enter"
          style={{ flex: 1 }}
        />
        <button type="submit">Add Item</button>
      </form>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {cart.length === 0 ? (
        <p>No items scanned yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #999" }}>
              <th>Item</th>
              <th>Code</th>
              <th>Qty</th>
              <th style={{ textAlign: "right" }}>Unit Price</th>
              <th style={{ textAlign: "right" }}>Item Price</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {cart.map((l) => (
              <tr key={l.item.barcode}>
                <td>
                  {l.item.name} {l.item.is_weighted && <small>(weighed, kg)</small>}
                </td>
                <td>{l.item.barcode}</td>
                <td>
                  <input
                    type="number"
                    min={l.item.is_weighted ? 0.001 : 1}
                    step={l.item.is_weighted ? 0.001 : 1}
                    value={l.quantity}
                    onChange={(e) => updateQuantity(l.item.barcode, Number(e.target.value))}
                    style={{ width: 90 }}
                  />
                </td>
                <td style={{ textAlign: "right" }}>{l.item.current_price.toFixed(2)}</td>
                <td style={{ textAlign: "right" }}>{(l.quantity * l.item.current_price).toFixed(2)}</td>
                <td>
                  <button onClick={() => removeLine(l.item.barcode)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "1px solid #999", fontWeight: 700 }}>
              <td colSpan={4} style={{ textAlign: "right" }}>Total</td>
              <td style={{ textAlign: "right" }}>{total.toFixed(2)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      )}

      {cart.length > 0 && (
        <button onClick={handleCheckout} disabled={busy} style={{ marginTop: "1rem" }}>
          {busy ? "Processing..." : "Checkout & Generate Bill"}
        </button>
      )}
    </div>
  );
}