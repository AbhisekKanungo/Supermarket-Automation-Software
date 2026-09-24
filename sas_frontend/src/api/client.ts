import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000",
});

// Pull FastAPI's { detail: "..." } out of errors so the UI can show it
export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    // 422 validation errors come back as an array
    if (Array.isArray(detail)) return detail.map((d) => d.msg).join(", ");
    return err.message;
  }
  return "Something went wrong";
}