export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface ScannedItem {
  item_id: number;
  barcode: string;
  name: string;
  is_weighted: boolean;
  current_price: number;
  stock_available: number;
  approval_status: ApprovalStatus;
}

export interface CartItemInput {
  barcode: string;
  quantity: number;
}

export interface CheckoutRequest {
  clerk_id: string;
  items: CartItemInput[];
}

// Decimal fields are serialized as strings by Pydantic
export interface BillLineItem {
  barcode: string;
  item_name: string;
  quantity: string;
  unit_price: string;
  line_total: string;
}

export interface Bill {
  serial_number: number;
  created_at: string;
  clerk_id: string;
  status: "COMPLETED" | "CANCELLED";
  line_items: BillLineItem[];
  total_amount_payable: string;
}

export interface InventoryItem {
  item_id: number;
  barcode: string;
  name: string;
  is_weighted: boolean;
  stock_quantity: number;
  cost_price: number;
  current_price: number | null; // null while pending approval
  approval_status: ApprovalStatus;
}

export interface SalesStat {
  item_id: number;
  barcode: string;
  item_name: string;
  quantity_sold: string;
  price_realized: string;
  total_cost: string;
  profit: string;
}

export interface PendingItem {
  item_id: number;
  barcode: string;
  name: string;
  is_weighted: boolean;
  cost_price: number;
  stock_quantity: number;
  approval_status: ApprovalStatus;
}

export interface CreateItemRequest {
  barcode: string;
  name: string;
  is_weighted: boolean;
  cost_price: number;
  stock_quantity: number;
}

export interface CreateItemResponse {
  message: string;
  barcode: string;
  stock_quantity: number;
  approval_status: ApprovalStatus;
}