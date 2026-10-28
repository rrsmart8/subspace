import { SavingsDates } from "./SavingsDates";
import { useCurrentDate } from "@/hooks/use-current-date";
import { useState } from "react";
import { Btn, Field, Label, PageHead, Panel, ron } from "./ui";
import { DEMO_CONFIG } from "@/config/demo";
import { parseAmount } from "@/lib/demo-logic";
import type { DemoAccount } from "@/services/mockApi";

export interface AccountDetails { name: string; email: string; monthlyIncome: string }
export function AccountSetup({ accounts, onCreate, onSelect, onCancel }: {
  accounts: DemoAccount[];
  onCreate: (details: AccountDetails) => Promise<void>;
  onSelect: (id: string) => Promise<void>;
  onCancel?: () => void;
}) {
  const [details, setDetails] = useState<AccountDetails>({ name: "", email: "", monthlyIncome: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const now = useCurrentDate();
  const income = parseAmount(details.monthlyIncome);
  const target = typeof income === "number" ? Math.ceil(Math.round(income * 100) * DEMO_CONFIG.savingsQualification.incomePercent / 100) / 100 : 0;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (typeof income !== "number") return setError(income);
    setBusy(true); setError(null);
    try { await onCreate(details); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to create your account."); }
    finally { setBusy(false); }
  };
  return <main className="mx-auto max-w-xl px-4 py-12">
    <PageHead title="Start your saving journey" lede="Tell us your monthly take-home income to set your saving target." />
    <Panel className="p-6">
      <form onSubmit={submit} className="space-y-5">
        <Field id="full-name" label="Full name" autoComplete="name" required minLength={2} maxLength={100} value={details.name} onChange={e => setDetails({ ...details, name: e.target.value })} />
        <Field id="email" label="Email address" type="email" autoComplete="email" required maxLength={254} value={details.email} onChange={e => setDetails({ ...details, email: e.target.value })} />
        <Field id="monthly-income" label="Monthly take-home income (RON)" inputMode="decimal" placeholder="e.g. 5000" required value={details.monthlyIncome} onChange={e => setDetails({ ...details, monthlyIncome: e.target.value })} />
        <div className="rounded-md border bg-deep p-4">
          <Label>Your monthly saving target · {DEMO_CONFIG.savingsQualification.incomePercent}%</Label>
          <div className="reading mt-3 text-4xl text-cool">{ron(target)}</div>
          <p className="mt-3 text-sm text-muted-foreground">Save 10% monthly for 3 consecutive months.<br />Meet your balance and lesson goals to unlock Tier 2.</p>
          <SavingsDates now={now} showNote={false} />
        </div>
        {error && <p role="alert" className="text-sm text-bad">{error}</p>}
        <Btn type="submit" variant="primary" busy={busy} className="w-full">{busy ? "Creating account…" : "Create account"}</Btn>
        {onCancel && <Btn type="button" onClick={onCancel} disabled={busy} className="w-full">Back to my account</Btn>}
      </form>
    </Panel>
    {accounts.length > 0 && <div className="mt-6 space-y-2">
      <label htmlFor="existing-account" className="text-sm text-muted-foreground">Or open an existing account</label>
      <select id="existing-account" defaultValue="" disabled={busy} onChange={e => void onSelect(e.target.value)} className="w-full rounded-md border border-rule-2 bg-deep p-3 text-sm text-ink-2 [color-scheme:dark]">
        <option value="" disabled>Choose account</option>
        {accounts.map(a => <option key={a.id} value={a.id}>{a.name} · Tier {a.tier}</option>)}
      </select>
    </div>}
  </main>;
}
