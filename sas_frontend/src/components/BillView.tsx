import type { Bill } from "../api/types";

export default function BillView({ bill, onNewSale }: { bill: Bill; onNewSale: () => void }) {
  return (
    <div>
      <div id="printable-bill" style={{ border: "1px solid #ccc", padding: "1.5rem", maxWidth: 700 }}>
        <h2 style={{ marginTop: 0 }}>Supermarket Bill</h2>
        <p>
          <strong>Serial No:</strong> {bill.serial_number}
          <br />
          <strong>Date:</strong> {new Date(bill.created_at).toLocaleString()}
          <br />
          <strong>Clerk:</strong> {bill.clerk_id}
        </p>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #999" }}>
              <th>Item</th>
              <th>Code</th>
              <th style={{ textAlign: "right" }}>Qty</th>
              <th style={{ textAlign: "right" }}>Unit Price</th>
              <th style={{ textAlign: "right" }}>Item Price</th>
            </tr>
          </thead>
          <tbody>
            {bill.line_items.map((li, i) => (
              <tr key={i}>
                <td>{li.item_name}</td>
                <td>{li.barcode}</td>
                <td style={{ textAlign: "right" }}>{Number(li.quantity)}</td>
                <td style={{ textAlign: "right" }}>{Number(li.unit_price).toFixed(2)}</td>
                <td style={{ textAlign: "right" }}>{Number(li.line_total).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "1px solid #999", fontWeight: 700 }}>
              <td colSpan={4} style={{ textAlign: "right" }}>Total Amount Payable</td>
              <td style={{ textAlign: "right" }}>{Number(bill.total_amount_payable).toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem" }}>
        <button onClick={() => window.print()}>Print Bill</button>
        <button onClick={onNewSale}>New Sale</button>
      </div>
    </div>
  );
}