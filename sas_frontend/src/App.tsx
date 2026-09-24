import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import Navbar from "./components/Navbar";
import Billing from "./pages/Billing";
import Inventory from "./pages/Inventory";
import SalesStats from "./pages/SalesStats";
import { RoleProvider, useRole, type Role } from "./context/RoleContext";

function Guard({ allow, children }: { allow: Role[]; children: ReactNode }) {
  const { role } = useRole();
  if (!allow.includes(role)) {
    return <Navigate to={role === "employee" ? "/billing" : "/inventory"} replace />;
  }
  return <>{children}</>;
}

function Shell() {
  const { role } = useRole();
  return (
    <>
      <Navbar />
      <main id="main" className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <Routes>
          <Route path="/" element={<Navigate to={role === "employee" ? "/billing" : "/inventory"} replace />} />
          <Route path="/billing" element={<Guard allow={["employee"]}><Billing /></Guard>} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/stats" element={<Guard allow={["manager"]}><SalesStats /></Guard>} />
        </Routes>
      </main>
    </>
  );
}

export default function App() {
  return (
    <RoleProvider>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </RoleProvider>
  );
}