import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Billing from "./pages/Billing";
import Inventory from "./pages/Inventory";
import SalesStats from "./pages/SalesStats";

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <main style={{ padding: "1.5rem", maxWidth: 1000, margin: "0 auto" }}>
        <Routes>
          <Route path="/" element={<Navigate to="/billing" replace />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/stats" element={<SalesStats />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}