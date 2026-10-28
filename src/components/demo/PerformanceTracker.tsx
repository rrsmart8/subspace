import { useEffect, useState } from "react";
import { investmentReadiness, milestones } from "@/lib/demo-logic";
import { useCurrentDate } from "@/hooks/use-current-date";
import { toast } from "sonner";
import { useDemo } from "@/state/DemoStore";
import * as api from "@/services/mockApi";
import type { PerformanceReport } from "@/lib/performance";
import { Bar, Btn, Notice, Panel, ron } from "./ui";
const date = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Bucharest", dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
export function PerformanceTracker() {
  const { state, run } = useDemo();
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = state.accountId;
  const now = useCurrentDate();
  const readiness = investmentReadiness(state, now);
  useEffect(() => {
    if (!id || (state.tierLevel ?? 1) < 2) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        const result = await api.getPerformance(id, { signal: controller.signal });
        if (!controller.signal.aborted) { setReport(result); setError(null);
          if (result.promotion === "promoted" && state.tierLevel === 2) await run(async current => ({ ok: true, state: current.accountId === id ? await api.loadState(id) : current, message: "Tier 3 unlocked" })); }
      } catch { if (!controller.signal.aborted) setError("Unable to refresh tracking. Your saved snapshots are preserved."); }
    };
    void load();
    const timer = window.setInterval(load, 60000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [id, state.transactions.length, state.performance?.id, state.demoClockOffsetMs, state.tierLevel, run]);
  const refresh = async () => {
    if (!id || busy) return;
    setBusy(true);
    try {
      const result = await api.getPerformance(id);
      setReport(result); setError(null);
      if (result.promotion === "promoted" && state.tierLevel === 2) await run(async current => ({ ok: true, state: current.accountId === id ? await api.loadState(id) : current, message: "Tier 3 unlocked" }));
    }
    catch { setError("Unable to refresh tracking. Your saved snapshots are preserved."); }
    finally { setBusy(false); }
  };
  const start = async () => {
    if (busy || !id) return;
    setBusy(true);
    try {
      const result = await run(api.startPerformance);
      if (!result.ok) { setError(result.error); return; }
      setReport(await api.getPerformance(id)); setError(null);
      toast.success(result.message);
    } catch { setError("Unable to load tracking. Refresh to check whether your period started."); }
    finally { setBusy(false); }
  };
  if ((state.tierLevel ?? 1) < 2) return null;
  const tracking = report?.run;
  const requirements = milestones(state, now);
  const met = requirements.filter(item => item.passed).length;
  return <Panel className="mb-6 space-y-4">
    <h2 className="text-xl">Tier 3 assessment</h2>
    {error && <Notice tone="bad">{error}</Notice>}
    {!report && !error && <p role="status" className="text-sm text-muted-foreground">Loading tracking…</p>}
    {report && !tracking && <>
      <p className="text-sm text-muted-foreground">Build a 90-day investing habit to unlock Tier 3.</p>
      {state.tierLevel === 2 ? <><Btn variant="primary" busy={busy} disabled={!Object.values(state.holdings).some(h => h.qty > 0)} onClick={() => void start()}>Start 90-day assessment</Btn>
      {!Object.values(state.holdings).some(h => h.qty > 0) && <p className="text-xs text-muted-foreground">Make your first investment to start tracking.</p>}</> : <p className="text-sm text-muted-foreground">No Tier 2 tracking period is recorded for this account.</p>}
    </>}
    {tracking && report && <>
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="measured text-cool">{readiness.days} / 90 days</span>
        <span>{readiness.days >= 90 ? "Discipline period complete" : `${90 - readiness.days} days left`}</span>
      </div>
      <Bar value={readiness.days} max={90} />
      {report.dataIssue && <Notice tone="amber">{report.dataIssue}</Notice>}
      <p className="text-xs text-muted-foreground"><span>{state.tierLevel === 3 ? "Tier 3 unlocked" : `${met} of ${requirements.length} requirements met`}</span>{tracking.mode === "demo" && <> · <span>Demo timeline</span></>}</p>
      {state.tierLevel === 2 && !readiness.planMet && <p className="text-sm text-amber">Meet the investment limits below to start your timer.</p>}
      {state.tierLevel === 2 && <details className="border-t pt-3 text-sm">
        <summary className="cursor-pointer font-medium">Requirements</summary>
        <ul className="mt-3 divide-y">
          {requirements.map(item => <li key={item.id} className="flex items-center justify-between gap-4 py-2">
            <span>{({
              "m-evaluation-window": "90 days following your plan",
              "m-assessment-saving": `Save ${ron(readiness.monthlyTarget)} monthly for 3 months`,
              "m-reserve": `Keep ${ron(readiness.requiredReserve)} in cash`,
              "m-lessons": "Complete 4 lessons",
              "m-investment-plan": `At least ${readiness.minPositions} stocks; max ${readiness.maxPositionPercent}% each`,
            } as Record<string, string>)[item.id] ?? item.label}</span>
            <span className={item.passed ? "shrink-0 text-ok" : "shrink-0 text-muted-foreground"}>{item.passed ? "Passed" : "To do"}</span>
          </li>)}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">The {readiness.maxPositionPercent}% limit uses invested cost. Total investments stay within your {readiness.investPercent}% allowance.</p>
        <p className="mt-2 text-xs text-muted-foreground">Only full, consecutive saving months count. Breaking investment limits restarts the timer; market losses do not.</p>
      </details>}
      <details className="border-t pt-4 text-sm">
        <summary className="cursor-pointer font-medium">Performance details</summary>
        <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
          {[
            ["Portfolio value", ron(tracking.latest.accountValue)],
            ["Gain / loss (excluding deposits and withdrawals)", ron(tracking.latest.netGain)],
            ["Opening portfolio", ron(tracking.openingValue)],
            ["Adjusted return (estimate)", tracking.latest.returnPercent === null ? "Unavailable" : `${tracking.latest.returnPercent.toFixed(2)}%`],
            ["Net deposits / withdrawals", ron(tracking.latest.netCashFlow)],
            ["Order fees", ron(tracking.latest.feesRON)],
            ["Tracking started", date(tracking.startedAt)],
            ["Performance window ends", date(tracking.endsAt)],
            ["Last valuation", date(tracking.latest.observedAt)],
          ].map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="measured mt-1 text-cool">{value}</dd></div>)}
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">Dates use Bucharest time. Performance is separate from your promotion requirements.</p>
        <details className="mt-4 border-t pt-3 text-xs text-muted-foreground">
          <summary className="cursor-pointer">How values are calculated</summary>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Portfolio value includes cash and all holdings. Gains exclude deposits and withdrawals.</li>
            <li>Adjusted return is a cash-flow-weighted estimate. Current orders have zero fees.</li>
            <li>Dividends and corporate actions are not yet included. Unusable prices pause valuation.</li>
            <li>Configured USD/RON rate: {tracking.fxRate}.</li>
            {tracking.mode === "demo" && <li>Advancing demo dates does not create a real 90-day market track record.</li>}
          </ul>
        </details>
      </details>
      <details className="border-t pt-4 text-sm">
        <summary className="cursor-pointer font-medium">Saved history</summary>
        <p className="mt-3 text-xs text-muted-foreground">Saved when values change, or hourly during a refresh.</p>
        <ul className="mt-2 divide-y">{report.snapshots.map((snapshot, index) => <li key={`${snapshot.observedAt}-${index}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <span className="text-xs text-muted-foreground">{date(snapshot.observedAt)}</span>
          <span className="measured text-cool">{ron(snapshot.accountValue)}<span className="ml-3 text-xs text-muted-foreground">Gain/loss {ron(snapshot.netGain)}</span></span>
        </li>)}</ul>
      </details>
      <div className="flex flex-wrap items-center gap-3"><Btn busy={busy} onClick={() => void refresh()}>Refresh</Btn></div>
    </>}
    {!report && error && <Btn busy={busy} onClick={() => void refresh()}>Retry</Btn>}
  </Panel>;
}
