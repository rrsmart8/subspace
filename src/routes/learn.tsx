import { QuarterlyMastery } from "@/components/demo/QuarterlyMastery";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Lock } from "lucide-react";
import { toast } from "sonner";
import { useDemo } from "@/state/DemoStore";
import * as api from "@/services/mockApi";
import { lessonStatus } from "@/lib/demo-logic";
import { DEMO_CONFIG } from "@/config/demo";
import { Btn, Chip, Label, Notice, PageHead, Panel, SidePanel } from "@/components/demo/ui";
import { MilestoneList, NextTier, TierCard } from "@/components/demo/Milestones";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/learn")({
  head: () => ({
    meta: [
      { title: "Learn — Stagewise demo" },
      { name: "description", content: "Short lessons with quick checks that count toward your next tier." },
      { property: "og:title", content: "Learn — Stagewise demo" },
      { property: "og:description", content: "Short lessons with quick checks that count toward your next tier." },
    ],
  }),
  component: Learn,
});

function Learn() {
  const { state, lessons } = useDemo();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <PageHead title="Learn" lede="Complete lessons to progress. Lessons never unlock real investing or partner funding." />
      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <TierCard />
          <NextTier />
          <Panel>
            <Label>Partner funding eligibility</Label>
            <div className="mt-2 flex items-center gap-2"><Chip tone="cool">Not requested</Chip><Chip>Simulated status</Chip></div>
            <p className="mt-2 text-sm text-muted-foreground">Decided separately by a provider. Not affected by lessons.</p>
          </Panel>
        </div>
        <MilestoneList />
      </div>
      <QuarterlyMastery />
      <h2 id="lessons" className="mb-4 scroll-mt-24 text-3xl">Lessons</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {lessons.map((l) => {
          const st = lessonStatus(state, l.id);
          return (
            <button key={l.id} onClick={() => setOpen(l.id)} className={cn("flex flex-col rounded-lg border bg-card p-5 text-left transition-colors hover:border-rule-2 focus-visible:outline-2 focus-visible:outline-ring", st === "locked" && "opacity-70")}>
              <div className="mb-3">
                {st === "completed" ? <Chip tone="ok"><CheckCircle2 className="h-3 w-3" />Completed</Chip> : st === "locked" ? <Chip><Lock className="h-3 w-3" />Locked</Chip> : <Chip tone="amber">Available</Chip>}
              </div>
              <h3 className="text-lg">{l.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{l.description}</p>
            </button>
          );
        })}
      </div>
      <LessonPanel id={open} onClose={() => setOpen(null)} />
    </>
  );
}

function LessonPanel({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { state, run, lessons } = useDemo();
  const [choice, setChoice] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<"right" | "wrong" | null>(null);
  const [busy, setBusy] = useState(false);
  const l = lessons.find((x) => x.id === id);
  const st = l ? lessonStatus(state, l.id) : "locked";
  const close = () => { if (busy) return; setChoice(null); setFeedback(null); onClose(); };

  const check = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!l || choice === null || busy) return;
    if (choice !== l.question.correct) return setFeedback("wrong");
    setBusy(true);
    const r = await run((s) => api.completeLesson(s, l.id, choice));
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    setFeedback("right");
    toast.success("Lesson completed");
  };

  return (
    <SidePanel open={!!l} onOpenChange={(o) => !o && close()} title={l?.title ?? ""} description={l?.description}>
      {l && st === "locked" ? (
        <Notice tone="amber"><Lock className="mr-1 inline h-4 w-4" />Unlocks at the {DEMO_CONFIG.tiers.find((t) => t.level === l.requiresLevel)?.name} tier.</Notice>
      ) : l && (
        <div className="space-y-6">
          <div className="space-y-3 text-ink-2">{l.body.map((p) => <p key={p}>{p}</p>)}</div>
          <form onSubmit={check} className="space-y-4 rounded-lg border bg-deep p-4">
            <fieldset>
              <legend className="mb-3 font-medium">{l.question.prompt}</legend>
              <div className="space-y-2">
                {l.question.options.map((o, i) => (
                  <label key={o} className={cn("flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm", choice === i && "border-amber bg-amber-soft")}>
                    <input type="radio" name="q" checked={choice === i} onChange={() => { setChoice(i); setFeedback(null); }} className="accent-amber" disabled={feedback === "right" || st === "completed"} />
                    {o}
                  </label>
                ))}
              </div>
            </fieldset>
            {feedback === "wrong" && <Notice tone="bad">Not quite. Read the lesson again and try another answer.</Notice>}
            {(feedback === "right" || st === "completed") && <Notice tone="ok">Correct. {l.question.explanation}</Notice>}
            {st !== "completed" && <Btn type="submit" variant="primary" busy={busy} disabled={choice === null} className="w-full">{feedback === "wrong" ? "Try again" : "Check answer"}</Btn>}
          </form>
          <Btn onClick={close} className="w-full">Close</Btn>
        </div>
      )}
    </SidePanel>
  );
}
