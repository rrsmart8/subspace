import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2 } from "lucide-react";

export const ron = (n: number) => new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON" }).format(n);
export const fmtDate = (iso: string) => new Date(iso).toISOString().slice(0, 16).replace("T", " ");

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("rounded-lg border bg-card p-5", className)}>{children}</section>;
}

export function PageHead({ title, lede }: { title: string; lede?: string }) {
  return (
    <header className="mb-8">
      <h1 className="text-4xl md:text-5xl">{title}</h1>
      {lede && <p className="mt-3 max-w-2xl text-ink-2">{lede}</p>}
    </header>
  );
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("text-sm font-medium text-muted-foreground", className)}>{children}</div>;
}

type ChipTone = "amber" | "cool" | "ok" | "bad" | "plain";
const chipTone: Record<ChipTone, string> = {
  amber: "bg-amber-soft text-amber border-amber/40",
  cool: "bg-cool-soft text-cool border-cool/40",
  ok: "bg-ok-soft text-ok border-ok/40",
  bad: "bg-bad-soft text-bad border-bad/40",
  plain: "bg-deep text-muted-foreground",
};
export function Chip({ tone = "plain", children }: { tone?: ChipTone; children: ReactNode }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-xs font-medium", chipTone[tone])}>{children}</span>;
}

export function Bar({ value, max, tone = "cool" }: { value: number; max: number; tone?: "cool" | "ok" | "amber" }) {
  const pct = Math.max(0, Math.min(100, max ? (value / max) * 100 : 0));
  const c = { cool: "bg-cool", ok: "bg-ok", amber: "bg-amber" }[tone];
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-deep" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full transition-[width] duration-300 ease-out", c)} style={{ width: `${pct}%` }} />
    </div>
  );
}

type BtnVariant = "primary" | "outline" | "ghost";
const btn: Record<BtnVariant, string> = {
  primary: "bg-primary text-primary-foreground border-primary hover:bg-primary/90",
  outline: "bg-card text-foreground border-rule-2 hover:bg-accent",
  ghost: "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent",
};
export function Btn({ variant = "outline", busy, className, children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; busy?: boolean }) {
  return (
    <button
      {...p}
      disabled={p.disabled || busy}
      className={cn("inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50", btn[variant], className)}
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Field({ id, label, error, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; error?: string | null }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink-2">{label}</label>
      <input
        id={id}
        {...p}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : undefined}
        className="measured w-full rounded-md border border-input bg-deep px-3 py-2 text-base text-foreground outline-none focus:border-ring"
      />
      {error && <p id={`${id}-err`} role="alert" className="text-sm text-bad">{error}</p>}
    </div>
  );
}

export function SidePanel({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string | undefined; children: ReactNode }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto border-border bg-card sm:max-w-md">
        <SheetHeader className="mb-6 text-left">
          <SheetTitle className="text-2xl font-medium tracking-tight">{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}

export function Notice({ tone, children }: { tone: "ok" | "bad" | "amber" | "cool"; children: ReactNode }) {
  const c = { ok: "bg-ok-soft text-ok", bad: "bg-bad-soft text-bad", amber: "bg-amber-soft text-amber", cool: "bg-cool-soft text-cool" }[tone];
  return <div role="status" className={cn("rounded-md border border-current/30 px-3 py-2 text-sm", c)}>{children}</div>;
}
