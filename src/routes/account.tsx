import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Lock } from "lucide-react";
import { toast } from "sonner";
import { useDemo } from "@/state/DemoStore";
import * as api from "@/services/mockApi";
import { parseAmount, rewardLockReason } from "@/lib/demo-logic";
import { DEMO_CONFIG } from "@/config/demo";
import { Btn, Chip, Field, Label, PageHead, Panel, SidePanel, ron, fmtDate } from "@/components/demo/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Account — Stagewise demo" },
      { name: "description", content: "Balance, transaction history, deposits, withdrawals and rewards." },
      { property: "og:title", content: "Account — Stagewise demo" },
      { property: "og:description", content: "Simulated balance, transaction history, deposits, withdrawals and rewards." },
    ],
  }),
  component: Account,
});

function Account() {
  const { state } = useDemo();
  const [mode, setMode] = useState<"deposit" | "withdraw" | null>(null);
  return (
    <>
      <PageHead title="Account" />

      <Panel className="mb-6 p-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Label>Account number</Label>
            <div className="measured mt-1 text-ink-2">{state.profile.accountNumber}</div>
            <div className="mt-4 flex items-center gap-2"><Label>Available cash</Label></div>
            <div className="reading mt-2 text-5xl text-cool">{ron(state.cash)}</div>
          </div>
          <div className="flex gap-3">
            <Btn variant="primary" onClick={() => setMode("deposit")}><ArrowDownLeft className="h-4 w-4" />Deposit</Btn>
            <Btn onClick={() => setMode("withdraw")}><ArrowUpRight className="h-4 w-4" />Withdraw</Btn>
          </div>
        </div>
      </Panel>

      <Panel className="mb-10 p-0">
        <h2 className="p-5 text-xl">Transaction history</h2>
        {state.transactions.length === 0 ? (
          <p className="border-t p-5 text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y bg-deep text-left text-muted-foreground">
                <tr><th className="px-5 py-2 font-medium">Date</th><th className="px-5 py-2 font-medium">Description</th><th className="px-5 py-2 font-medium">Direction</th><th className="px-5 py-2 text-right font-medium">Amount</th><th className="px-5 py-2 font-medium">Status</th></tr>
              </thead>
              <tbody className="divide-y">
                {state.transactions.map((t) => (
                  <tr key={t.id}>
                    <td className="measured whitespace-nowrap px-5 py-3 text-cool">{fmtDate(t.date)}</td>
                    <td className="px-5 py-3">{t.description}</td>
                    <td className="px-5 py-3"><Chip tone={t.direction === "in" ? "ok" : "bad"}>{t.direction === "in" ? "In" : "Out"}</Chip></td>
                    <td className={cn("measured whitespace-nowrap px-5 py-3 text-right", t.direction === "in" ? "text-ok" : "text-bad")}>{t.direction === "in" ? "+" : "−"}{ron(t.amount)}</td>
                    <td className="px-5 py-3 capitalize text-muted-foreground">{t.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <h2 className="mb-2 text-3xl">Rewards</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {DEMO_CONFIG.rewards.map((r) => <RewardCard key={r.id} id={r.id} />)}
      </div>

      <MoneyPanel mode={mode} onClose={() => setMode(null)} />
    </>
  );
}

function MoneyPanel({ mode, onClose }: { mode: "deposit" | "withdraw" | null; onClose: () => void }) {
  const { state, run } = useDemo();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const close = () => { if (busy) return; setValue(""); setError(null); onClose(); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !mode) return;
    const a = parseAmount(value);
    if (typeof a === "string") return setError(a);
    if (mode === "withdraw" && a > state.cash) return setError(`Exceeds available cash of ${ron(state.cash)}.`);
    setBusy(true);
    const r = await run((s) => (mode === "deposit" ? api.deposit(s, value) : api.withdraw(s, value)));
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.success(`${r.message} (simulated)`);
    setValue(""); setError(null); onClose();
  };

  return (
    <SidePanel open={!!mode} onOpenChange={(o) => !o && close()} title={mode === "deposit" ? "Deposit" : "Withdraw"} description="Simulated transfer. No money moves.">
      <form onSubmit={submit} className="space-y-5">
        <div className="text-sm text-muted-foreground">Available cash <span className="measured text-cool">{ron(state.cash)}</span></div>
        <Field id="amount" label="Amount (RON)" inputMode="decimal" placeholder="0.00" autoComplete="off" value={value} error={error} onChange={(e) => { setValue(e.target.value); setError(null); }} />
        <div className="flex gap-3">
          <Btn type="submit" variant="primary" busy={busy} className="flex-1">{busy ? "Processing…" : `Confirm ${mode ?? ""}`}</Btn>
          <Btn type="button" onClick={close} disabled={busy}>Cancel</Btn>
        </div>
      </form>
    </SidePanel>
  );
}

function RewardCard({ id }: { id: string }) {
  const { state, run } = useDemo();
  const r = DEMO_CONFIG.rewards.find((x) => x.id === id)!;
  const [busy, setBusy] = useState(false);
  const code = state.redeemed[id];
  const lock = rewardLockReason(state, id);
  const redeem = async () => {
    if (busy) return;
    setBusy(true);
    const res = await run((s) => api.redeemReward(s, id));
    setBusy(false);
    if (!res.ok) toast.error(res.error); else toast.success("Sample coupon revealed");
  };
  return (
    <Panel className="flex flex-col">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-md border bg-deep text-lg font-medium text-ink-2" aria-hidden>{r.provider[0]}</div>
      <div className="text-xs text-muted-foreground">{r.provider}</div>
      <h3 className="mt-1 text-lg">{r.title}</h3>
      <p className="mt-1 flex-1 text-sm text-muted-foreground">{r.description}</p>
      <div className="mt-4">
        {code ? (
          <div className="space-y-2">
            <Chip tone="ok">Redeemed</Chip>
            <div className="measured rounded-md border border-dashed border-rule-2 bg-deep px-3 py-2 text-center text-cool">{code}</div>
          </div>
        ) : lock ? (
          <div className="space-y-2">
            <Btn disabled className="w-full"><Lock className="h-4 w-4" />Locked</Btn>
            <p className="text-xs text-muted-foreground">{lock}</p>
          </div>
        ) : (
          <Btn variant="primary" busy={busy} onClick={redeem} className="w-full">{busy ? "Redeeming…" : "Redeem"}</Btn>
        )}
      </div>
    </Panel>
  );
}

