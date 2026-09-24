import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const styles = {
    primary: "bg-accent text-white hover:bg-accent-hover",
    ghost: "bg-white text-zinc-800 border border-zinc-300 hover:bg-zinc-50",
    danger: "bg-white text-red-700 border border-red-300 hover:bg-red-50",
  }[variant];
  return (
    <button
      {...props}
      className={`inline-flex min-h-9 items-center justify-center gap-2 whitespace-nowrap rounded-ui px-3.5 text-sm font-medium transition-colors active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    />
  );
}

export function Field({
  label,
  id,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; id: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-zinc-700">
        {label}
      </label>
      <input
        id={id}
        {...props}
        className={`min-h-10 rounded-ui border border-zinc-300 bg-white px-3 text-zinc-900 placeholder:text-zinc-500 focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent ${className}`}
      />
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-ui border border-zinc-200 bg-white ${className}`}>
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-zinc-600">{subtitle}</p>}
    </div>
  );
}

export function Alert({ kind, children }: { kind: "error" | "success"; children: ReactNode }) {
  const styles =
    kind === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-emerald-200 bg-accent-soft text-emerald-900";
  return (
    <div role={kind === "error" ? "alert" : "status"} aria-live="polite" className={`mb-4 rounded-ui border px-4 py-3 text-sm ${styles}`}>
      {children}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="font-medium text-zinc-900">{title}</p>
      <p className="mt-1 text-sm text-zinc-600">{hint}</p>
    </div>
  );
}

export const money = (n: number | string) => Number(n).toFixed(2);