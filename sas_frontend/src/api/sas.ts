import { api } from "./client";
import type {
  ScannedItem, CheckoutRequest, Bill, InventoryItem, SalesStat,
  PendingItem, CreateItemRequest, CreateItemResponse,
} from "./types";

export const scanItem = (barcode: string) =>
  api.get<ScannedItem>(`/api/v1/items/barcode/${encodeURIComponent(barcode)}`)
    .then((r) => r.data);

export const checkout = (payload: CheckoutRequest) =>
  api.post<Bill>("/api/v1/sales/checkout", payload).then((r) => r.data);

export const restock = (barcode: string, quantity_added: number) =>
  api.post("/api/v1/inventory/restock", { barcode, quantity_added })
    .then((r) => r.data);

export const updatePrice = (barcode: string, new_price: number) =>
  api.patch(`/api/v1/items/${encodeURIComponent(barcode)}/price`, { new_price })
    .then((r) => r.data);

export const getInventory = () =>
  api.get<InventoryItem[]>("/api/v1/inventory").then((r) =>
    [...r.data].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true })
    )
  );

export const getSalesStats = (startDate: string, endDate: string) =>
  api
    .get<SalesStat[]>("/api/v1/reports/sales-stats", {
      params: {
        start_date: `${startDate}T00:00:00`,
        end_date: `${endDate}T23:59:59.999`,
      },
    })
    .then((r) => r.data);

export const cancelBill = (billId: number) =>
  api
    .post<{ message: string; bill_id: number; status: string }>(`/api/v1/sales/${billId}/cancel`)
    .then((r) => r.data);

export const createItem = (payload: CreateItemRequest) =>
  api.post<CreateItemResponse>("/api/v1/items", payload).then((r) => r.data);

export const getPendingItems = () =>
  api.get<PendingItem[]>("/api/v1/manager/items/pending").then((r) => r.data);

export const approveItem = (barcode: string, selling_price: number) =>
  api
    .patch<{ message: string; barcode: string; selling_price: number; approval_status: string }>(
      `/api/v1/manager/items/${encodeURIComponent(barcode)}/approve`,
      { selling_price }
    )
    .then((r) => r.data);