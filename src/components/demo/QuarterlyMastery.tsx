import { useState } from "react";
import { toast } from "sonner";
import { useDemo } from "@/state/DemoStore";
import { masteryProgress, getTier } from "@/lib/demo-logic";
import * as api from "@/services/mockApi";
import { useCurrentDate } from "@/hooks/use-current-date";
import { Btn, Chip, Notice, Panel, ron } from "./ui";

export function QuarterlyMastery() {
  const { state, run } = useDemo();
  const now = useCurrentDate();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  if (getTier(state).level !== 3) return null;
  const progress = masteryProgress(state, now);
  const submit = async (scenarioId: string) => {
    const answer = answers[scenarioId];
    if (busy || answer === undefined) return;
    setBusy(true);
    const result = await run(s => api.answerMastery(s, progress.id, scenarioId, answer));
    setBusy(false);
    if (result.ok) toast.success(result.message); else toast.error(result.error);
  };
  const register = async () => {
    if (busy) return;
    setBusy(true);
    const result = await run(s => api.registerMasteryReward(s, progress.id));
    setBusy(false);
    if (result.ok) toast.success(result.message); else toast.error(result.error);
  };
  return <Panel className="mb-8 space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-2xl">Quarterly mastery challenge</h2>
      <Chip tone={progress.challengeMet ? "ok" : "cool"}>{progress.id}</Chip>
    </div>
    <p className="text-sm text-muted-foreground">Build knowledge, keep saving and review your decisions. A new challenge opens each quarter. No profit target or trading quota.</p>
    <div className="grid gap-3 text-sm sm:grid-cols-3">
      <div><span className="text-muted-foreground">Challenge</span><div className="measured mt-1 text-cool">{progress.completed} of {progress.target} {progress.foundation ? "lessons" : "scenarios"}</div></div>
      <div><span className="text-muted-foreground">Saving targets this quarter</span><div className="measured mt-1 text-cool">{progress.qualifyingMonths} of 3 months</div></div>
      <div><span className="text-muted-foreground">Quarter ends</span><div className="measured mt-1 text-cool">{progress.deadlineLabel}</div></div>
    </div>
    {progress.foundation ? <p className="text-sm text-ink-2">Your first challenge: complete all five foundation lessons. Previous lesson completions count. <a href="#lessons" className="underline underline-offset-4 hover:text-amber">View lessons</a></p> : <div className="space-y-4">
      {progress.scenarios.map(scenario => {
        const completed = state.mastery?.answers[progress.id]?.includes(scenario.id) ?? false;
        return <div key={`${progress.id}-${scenario.id}`} className="rounded-md border bg-deep p-4">
          <h3 className="font-medium">{scenario.title}</h3>
          {completed ? <p className="mt-2 text-sm text-ok">Completed. {scenario.explanation}</p> : <fieldset className="mt-3 space-y-3" disabled={busy}>
            <legend className="text-sm text-ink-2">{scenario.prompt}</legend>
            {scenario.options.map((option, index) => <label key={option} className="flex items-start gap-3 text-sm text-muted-foreground"><input type="radio" className="mt-1 accent-amber" name={`${progress.id}-${scenario.id}`} checked={answers[scenario.id] === index} onChange={() => setAnswers(old => ({ ...old, [scenario.id]: index }))} />{option}</label>)}
            <Btn onClick={() => void submit(scenario.id)} disabled={answers[scenario.id] === undefined} busy={busy}>Check answer</Btn>
          </fieldset>}
        </div>;
      })}
    </div>}
    <div className="space-y-3 border-t pt-4">
      <div className="flex flex-wrap items-center gap-3"><span className="font-medium">{progress.claim ? "Registered quarterly bonus" : `Proposed quarterly bonus · ${progress.bonusIncomePercent}% of monthly income`}: <span className="measured text-cool">{ron(progress.bonusRON)}</span></span><Chip tone="amber">Pending sponsor funding</Chip></div>
      <p className="text-sm text-muted-foreground">Qualify by completing the challenge, meeting all three monthly saving targets and retaining your savings reserve. The bonus is not available for payment yet.</p>
      <p className="text-sm text-muted-foreground">Savings reserve: <span className={progress.reserveMet ? "text-ok" : "text-ink-2"}>{progress.reserveMet ? "Met" : "Not met"}</span></p>
      {progress.claim ? <Notice tone="cool">Reward registered for {progress.id}. Funding is pending; no cash has been credited.</Notice> : <Btn variant="primary" disabled={!progress.eligible} busy={busy} onClick={() => void register()}>Register reward eligibility</Btn>}
    </div>
  </Panel>;
}
