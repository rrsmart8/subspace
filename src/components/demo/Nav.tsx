import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, RotateCcw, X } from "lucide-react";
import { useDemo } from "@/state/DemoStore";
import { Btn, Chip } from "./ui";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const LINKS = [
  { to: "/", label: "Overview" },
  { to: "/account", label: "Account" },
  { to: "/investment", label: "Investment" },
  { to: "/learn", label: "Learn" },
] as const;

const linkCls = "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground";
const activeCls = "bg-accent text-foreground";

function ResetButton() {
  const { reset } = useDemo();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Btn variant="ghost" className="px-3"><RotateCcw className="h-4 w-4" />Reset demo</Btn>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-card">
        <AlertDialogHeader>
          <AlertDialogTitle>Reset the demo?</AlertDialogTitle>
          <AlertDialogDescription>Balance, transactions, holdings, rewards and lessons return to the starting mock data.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => void reset()}>Reset</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function Nav() {
  const [open, setOpen] = useState(false);
  const { state, accounts, switchAccount } = useDemo();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link to="/" className="flex items-center gap-2 font-medium tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground text-sm">S</span>
          Stagewise
        </Link>
        <Chip tone="amber">Simulated demo</Chip>
        <label className="min-w-0 text-xs">
          <span className="sr-only">Demo account</span>
          <select aria-label="Demo account" value={state.accountId} onChange={(e) => void switchAccount(e.target.value)} className="max-w-40 rounded-md border bg-card p-2 text-foreground">
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name} · Tier {a.tier}</option>)}
          </select>
        </label>
        <nav aria-label="Main" className="ml-auto hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} className={linkCls} activeProps={{ className: activeCls, "aria-current": "page" }} activeOptions={{ exact: true }}>{l.label}</Link>
          ))}
          <span className="mx-2 h-6 w-px bg-border" />
          <ResetButton />
        </nav>
        <button className="ml-auto rounded-md p-2 md:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <nav aria-label="Main mobile" className="border-t px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className={linkCls} activeProps={{ className: activeCls, "aria-current": "page" }} activeOptions={{ exact: true }}>{l.label}</Link>
            ))}
            <ResetButton />
          </div>
        </nav>
      )}
    </header>
  );
}
