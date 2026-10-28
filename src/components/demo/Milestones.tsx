import { Check, Circle } from "lucide-react";
import { useDemo } from "@/state/DemoStore";
import { milestones, nextTierRequirements, getTier } from "@/lib/demo-logic";
import { Bar, Chip, Panel, ron } from "./ui";

const fmt = (v: number, unit: string) => (unit === "RON" ? ron(v) : `${v} ${unit}`);

export function MilestoneList() {
  const { state } = useDemo();
  return (
    <Panel>
      <h2 className="mb-4 text-xl">Milestones</h2>
      <ul className="divide-y">
        {milestones(state).map((m) => (
          <li key={m.id} className="py-3">
            <div className="flex items-center gap-3">
              {m.passed ? <Check className="h-4 w-4 text-ok" aria-hidden /> : <Circle className="h-4 w-4 text-muted-foreground" aria-hidden />}
              <span className="flex-1 text-sm">{m.label}</span>
              <Chip tone={m.passed ? "ok" : "plain"}>{m.passed ? "Passed" : "Not passed"}</Chip>
            </div>
            {!m.passed && (
              <div className="mt-2 flex items-center gap-3 pl-7">
                <Bar value={m.current} max={m.target} />
                <span className="measured shrink-0 text-xs text-cool">{fmt(Math.min(m.current, m.target), m.unit)} / {fmt(m.target, m.unit)}</span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function NextTier() {
  const { state } = useDemo();
  const req = nextTierRequirements(state);
  if (!req) return <Panel><h2 className="text-xl">Top tier reached</h2><p className="mt-2 text-sm text-muted-foreground">You're at the highest demo tier.</p></Panel>;
  return (
    <Panel>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl">Next: {req.tier.name}</h2>
        <Chip tone="cool">Level {req.tier.level}</Chip>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{req.tier.summary}</p>
      <ul className="space-y-4">
        {req.items.map((i) => (
          <li key={i.label}>
            <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
              <span className={i.met ? "text-ok" : "text-ink-2"}>{i.met ? "✓ " : ""}{i.label}</span>
              <span className="measured text-xs text-cool">{fmt(Math.min(i.current, i.target), i.unit)} / {fmt(i.target, i.unit)}</span>
            </div>
            <Bar value={i.current} max={i.target} tone={i.met ? "ok" : "cool"} />
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
