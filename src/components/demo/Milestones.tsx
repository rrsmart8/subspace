import { Link } from "@tanstack/react-router";
import { SavingsDates } from "./SavingsDates";
import { useCurrentDate } from "@/hooks/use-current-date";
import { Check, Circle } from "lucide-react";
import { useDemo } from "@/state/DemoStore";
import { milestones, nextTierRequirements, getTier, savingsProgress } from "@/lib/demo-logic";
import { Bar, Chip, Panel, ron } from "./ui";

const progressText = (current: number, target: number, unit: string) => {
  const value = Math.min(current, target);
  if (unit === "RON") return `${ron(value)} / ${ron(target)}`;
  if (unit === "%") return `${value}% / ${target}%`;
  return `${value} of ${target} ${unit}`;
};

export function MilestoneList({ showNextTier = false }: { showNextTier?: boolean }) {
  const { state } = useDemo();
  const now = useCurrentDate();
  const next = showNextTier ? nextTierRequirements(state, now) : null;
  const saving = savingsProgress(state, now);
  return (
    <Panel>
      <h2 className="mb-4 text-xl">Milestones</h2>
      {next && <p className="mb-4 text-sm text-muted-foreground">Next: <span className="text-ink-2">{next.tier.name}</span> · Tier {next.tier.level}</p>}
      {next?.tier.level === 2 && <div className="mb-4 rounded-md border bg-deep p-3 text-sm text-muted-foreground">
        This month: <span className="measured text-cool">{ron(saving.currentSaved)} / {ron(saving.monthlyTarget)}</span> saved.
        <SavingsDates now={now} showNote={false} />
      </div>}
      {getTier(state).level === 3 && <p className="mb-3 text-sm text-muted-foreground">Ongoing goals for your current tier.</p>}
      <ul className="divide-y">
        {milestones(state, now).map((m) => (
          <li key={m.id} className="py-3">
            <div className="flex items-center gap-3">
              {m.passed ? <Check className="h-4 w-4 text-ok" aria-hidden /> : <Circle className="h-4 w-4 text-muted-foreground" aria-hidden />}
              <span className="flex-1 text-sm">{m.label}</span>
              <Chip tone={m.passed ? "ok" : "plain"}>{m.current === null ? "Pending" : m.passed ? "Passed" : "Not passed"}</Chip>
            </div>
            {m.current === null ? <p className="mt-2 pl-7 text-xs text-muted-foreground">Assessment not started.</p> : !m.passed && (
              <div className="mt-2 flex items-center gap-3 pl-7">
                <Bar value={m.current} max={m.target} />
                <span className="measured shrink-0 text-xs text-cool">{progressText(m.current, m.target, m.unit)}</span>
              </div>
            )}
            {m.id === "m-mastery" && <Link to="/learn" className="mt-2 inline-block pl-7 text-xs underline underline-offset-4 hover:text-amber">Open quarterly challenge →</Link>}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function NextTier({ showDeadlineNote = true }: { showDeadlineNote?: boolean }) {
  const { state } = useDemo();
  const now = useCurrentDate();
  const req = nextTierRequirements(state, now);
  const saving = savingsProgress(state, now);
  if (!req) return <Panel><h2 className="text-xl">Top tier reached</h2><p className="mt-2 text-sm text-muted-foreground">You're at the highest available tier.</p></Panel>;
  return (
    <Panel>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl">Next: {req.tier.name}</h2>
        <Chip tone="cool">Level {req.tier.level}</Chip>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{req.tier.summary}</p>
      {req.tier.level === 2 && <div className="mb-4 rounded-md border bg-deep p-3 text-sm text-muted-foreground">
        Monthly income: <span className="measured text-cool">{ron(state.profile.monthlyIncome ?? 0)}</span><br />
        This month: <span className="measured text-cool">{ron(saving.currentSaved)} / {ron(saving.monthlyTarget)}</span> saved (10%).<br />
        {saving.currentMet ? "Monthly target reached." : `${ron(saving.remaining)} left this month.`}
        <SavingsDates now={now} showNote={showDeadlineNote} />
      </div>}
      <ul className="space-y-4">
        {req.items.map((i) => (
          <li key={i.label}>
            <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
              <span className={i.met ? "text-ok" : "text-ink-2"}>{i.met ? "✓ " : ""}{i.label}</span>
              <span className="measured text-xs text-cool">{i.current === null ? "Pending" : progressText(i.current, i.target, i.unit)}</span>
            </div>
            {i.current !== null && <Bar value={i.current} max={i.target} tone={i.met ? "ok" : "cool"} />}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function TierCard() {
  const { state } = useDemo();
  const t = getTier(state);
  return (
    <Panel>
      <Label>Current tier</Label>
      <div className="mt-2 flex items-baseline gap-3">
        <span className="text-4xl tracking-tight">{t.name}</span>
        <Chip tone="amber">Level {t.level}</Chip>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{t.summary}</p>
    </Panel>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-sm font-medium text-muted-foreground">{children}</div>;
}
