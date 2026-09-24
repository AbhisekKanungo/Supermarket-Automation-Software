import { PrinterIcon, PlusIcon } from "@phosphor-icons/react";
import type { Bill } from "../api/types";
import { Button, PageHeader, money } from "./ui";

export default function BillView({ bill, onNewSale }: { bill: Bill; onNewSale: () => void }) {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Sale complete" subtitle="Print the bill for the customer, then start the next sale." />

      <div id="printable-bill" className="rounded-ui border border-zinc-200 bg-white p-6">
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
              <tr key={i}>
                <td className="py-2 font-medium">{li.item_name}</td>
                <td className="py-2 font-mono text-xs text-zinc-600">{li.barcode}</td>
                <td className="py-2 text-right tabular-nums">{Number(li.quantity)}</td>
                <td className="py-2 text-right tabular-nums">{money(li.unit_price)}</td>
                <td className="py-2 text-right tabular-nums">{money(li.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex items-center justify-between border-t border-dashed border-zinc-300 pt-4">
          <span className="text-sm font-medium">Total amount payable</span>
          <span className="text-2xl font-semibold tabular-nums">{money(bill.total_amount_payable)}</span>
        </div>
      </div>

      <div className="mt-4 flex gap-3">
        <Button onClick={() => window.print()}>
          <PrinterIcon size={16} aria-hidden="true" /> Print bill
        </Button>
        <Button variant="ghost" onClick={onNewSale}>
          <PlusIcon size={16} aria-hidden="true" /> New sale
        </Button>
      </div>
    </div>
  );
}