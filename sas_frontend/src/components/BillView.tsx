import { useState } from "react";
import { Printer, Plus, XCircle } from "@phosphor-icons/react";
import { cancelBill } from "../api/sas";
import { getErrorMessage } from "../api/client";
import type { Bill } from "../api/types";
import { Alert, Button, PageHeader, money } from "./ui";

export default function BillView({
  bill,
  onNewSale,
  onCancelled,
}: {
  bill: Bill;
  onNewSale: () => void;
  onCancelled: (b: Bill) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cancelled = bill.status === "CANCELLED";

  async function handleCancel() {
    setBusy(true);
    setError("");
    try {
      await cancelBill(bill.serial_number);
      onCancelled({ ...bill, status: "CANCELLED" });
      setConfirming(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={cancelled ? "Bill cancelled" : "Sale complete"}
        subtitle={
          cancelled
            ? "This bill has been voided and its stock returned to inventory."
            : "Print the bill for the customer, then start the next sale."
        }
      />

      {error && <Alert kind="error">{error}</Alert>}

      <div id="printable-bill" className="relative rounded-ui border border-zinc-200 bg-white p-6">
        {cancelled && (
          <p className="mb-4 rounded-ui border border-red-200 bg-red-50 px-3 py-2 text-center text-sm font-semibold uppercase tracking-wide text-red-800">
            Cancelled - void
          </p>
        )}

        <div className="flex items-start justify-between border-b border-dashed border-zinc-300 pb-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Supermarket Bill</h2>
            <p className="mt-1 text-sm text-zinc-600">{new Date(bill.created_at).toLocaleString()}</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-mono font-medium">No. {bill.serial_number}</p>
            <p className="text-zinc-600">Clerk {bill.clerk_id}</p>
          </div>
        </div>

        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-zinc-600">
              <th scope="col" className="pb-2 font-medium">Item</th>
              <th scope="col" className="pb-2 font-medium">Code</th>
              <th scope="col" className="pb-2 text-right font-medium">Qty</th>
              <th scope="col" className="pb-2 text-right font-medium">Unit price</th>
              <th scope="col" className="pb-2 text-right font-medium">Item price</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {bill.line_items.map((li, i) => (
              <tr key={i} className={cancelled ? "text-zinc-500 line-through" : ""}>
                <td className="py-2 font-medium">{li.item_name}</td>
                <td className="py-2 font-mono text-xs">{li.barcode}</td>
                <td className="py-2 text-right tabular-nums">{Number(li.quantity)}</td>
                <td className="py-2 text-right tabular-nums">{money(li.unit_price)}</td>
                <td className="py-2 text-right tabular-nums">{money(li.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex items-center justify-between border-t border-dashed border-zinc-300 pt-4">
          <span className="text-sm font-medium">Total amount payable</span>
          <span className={`text-2xl font-semibold tabular-nums ${cancelled ? "text-zinc-500 line-through" : ""}`}>
            {money(bill.total_amount_payable)}
          </span>
        </div>
      </div>

      {confirming && !cancelled && (
        <div role="alertdialog" aria-labelledby="cancel-title" className="mt-4 rounded-ui border border-red-200 bg-red-50 p-4">
          <p id="cancel-title" className="text-sm font-medium text-red-900">
            Cancel bill No. {bill.serial_number}?
          </p>
          <p className="mt-1 text-sm text-red-800">
            The stock will be restored and this can't be undone.
          </p>
          <div className="mt-3 flex gap-3">
            <Button variant="danger" onClick={handleCancel} disabled={busy}>
              {busy ? "Cancelling" : "Yes, cancel bill"}
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
              Keep bill
            </Button>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        {!cancelled && (
          <Button onClick={() => window.print()}>
            <Printer size={16} aria-hidden="true" /> Print bill
          </Button>
        )}
        <Button variant="ghost" onClick={onNewSale}>
          <Plus size={16} aria-hidden="true" /> New sale
        </Button>
        {!cancelled && !confirming && (
          <Button variant="danger" onClick={() => setConfirming(true)} className="sm:ml-auto">
            <XCircle size={16} aria-hidden="true" /> Cancel bill
          </Button>
        )}
      </div>
    </div>
  );
}