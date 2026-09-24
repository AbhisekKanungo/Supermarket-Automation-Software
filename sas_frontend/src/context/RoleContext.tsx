import { createContext, useContext, useState, type ReactNode } from "react";

export type Role = "employee" | "manager";

interface RoleCtx {
  role: Role;
  setRole: (r: Role) => void;
}

const Ctx = createContext<RoleCtx | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(
    () => (localStorage.getItem("sas-role") as Role) || "employee"
  );

  function setRole(r: Role) {
    localStorage.setItem("sas-role", r);
    setRoleState(r);
  }

  return <Ctx.Provider value={{ role, setRole }}>{children}</Ctx.Provider>;
}

export function useRole() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useRole must be used inside RoleProvider");
  return c;
}