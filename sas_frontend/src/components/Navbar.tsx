import { NavLink } from "react-router-dom";

const links = [
  { to: "/billing", label: "Billing" },
  { to: "/inventory", label: "Inventory & Prices" },
  { to: "/stats", label: "Sales Stats" },
];

export default function Navbar() {
  return (
    <nav style={{ display: "flex", gap: "1.5rem", padding: "1rem 1.5rem", borderBottom: "1px solid #ddd" }}>
      <strong>SAS</strong>
      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          style={({ isActive }) => ({ fontWeight: isActive ? 700 : 400 })}
        >
          {l.label}
        </NavLink>
      ))}
    </nav>
  );
}