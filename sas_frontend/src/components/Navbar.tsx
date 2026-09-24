import { NavLink } from "react-router-dom";
import { ReceiptIcon, PackageIcon, ChartBarIcon, ShoppingCartIcon } from "@phosphor-icons/react";
import { useRole, type Role } from "../context/RoleContext";

const links = {
  employee: [
    { to: "/billing", label: "Billing", Icon: ReceiptIcon },
    { to: "/inventory", label: "Restock", Icon: PackageIcon },
  ],
  manager: [
    { to: "/inventory", label: "Inventory & Prices", Icon: PackageIcon },
    { to: "/stats", label: "Sales Stats", Icon: ChartBarIcon },
  ],
};

export default function Navbar() {
  const { role, setRole } = useRole();

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