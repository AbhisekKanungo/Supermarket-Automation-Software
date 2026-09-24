import { NavLink, useLocation  } from "react-router-dom";
import { ReceiptIcon, PackageIcon, ChartBarIcon, ShoppingCartIcon, SealCheckIcon } from "@phosphor-icons/react";
import { useRole, type Role } from "../context/RoleContext";
import { getPendingItems } from "../api/sas";
import { useEffect, useState } from "react";
const links = {
  employee: [
    { to: "/billing", label: "Billing", Icon: ReceiptIcon },
    { to: "/inventory", label: "Stock & New Items", Icon: PackageIcon },
  ],
  manager: [
    { to: "/inventory", label: "Inventory & Prices", Icon: PackageIcon },
    { to: "/approvals", label: "Approvals", Icon: SealCheckIcon },
    { to: "/stats", label: "Sales Stats", Icon: ChartBarIcon },
  ],
};

export default function Navbar() {
  const { role, setRole } = useRole();
  const [pending, setPending] = useState(0);
  const location = useLocation();
  useEffect(() => {
  if (role !== "manager") return setPending(0);
  getPendingItems()
    .then((p) => setPending(p.length))
    .catch(() => setPending(0));
}, [role, location.pathname]);
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white">
        <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:rounded-ui focus:bg-white focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2 font-semibold tracking-tight">
            <ShoppingCartIcon size={20} weight="bold" className="text-accent" aria-hidden="true" />
            SAS
          </div>
          <nav aria-label="Main" className="flex gap-1">
            {links[role].map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex min-h-9 items-center gap-2 rounded-ui px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                    isActive ? "bg-zinc-100 text-zinc-900" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                  }`
                }
              >
                <Icon size={16} weight="bold" aria-hidden="true" />
                <span className="hidden sm:inline">{label}</span>
                {to === "/approvals" && pending > 0 && (
                  <span
                    className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-semibold text-white"
                    aria-label={`${pending} pending`}
                  >
                    {pending}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="role" className="hidden text-sm text-zinc-600 sm:block">
            Role
          </label>
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="min-h-9 rounded-ui border border-zinc-300 bg-white px-2.5 text-sm focus-visible:outline-2 focus-visible:outline-accent"
          >
            <option value="employee">Employee</option>
            <option value="manager">Manager</option>
          </select>
        </div>
      </div>
    </header>
  );
}