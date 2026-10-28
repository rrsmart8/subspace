import { DemoTimeline } from "@/components/demo/DemoTimeline";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useDemo } from "@/state/DemoStore";
import { holdingsValue } from "@/lib/demo-logic";
import { Label, PageHead, ron } from "@/components/demo/ui";
import { MilestoneList, TierCard } from "@/components/demo/Milestones";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Stagewise — Save. Learn. Invest." },
      { name: "description", content: "Your simulated balance, tier and milestones at a glance." },
      { property: "og:title", content: "Stagewise — Save. Learn. Invest." },
      { property: "og:description", content: "Your simulated balance, tier and milestones at a glance." },
    ],
  }),
  component: Overview,
});

function Overview() {
  const { state } = useDemo();
  const inv = holdingsValue(state);
  return (
    <>
      <PageHead title={`Hello, ${state.profile.name.split(" ")[0]}`} />
      <DemoTimeline />
      <div className="panels mb-6 md:grid-cols-[2fr_1fr]">
        <div className="p-6">
          <div className="flex items-center gap-2"><Label>Cash balance</Label></div>
          <div className="reading mt-3 text-5xl text-cool md:text-6xl">{ron(state.cash)}</div>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
            <span>Holdings <span className="measured text-cool">{ron(inv)}</span></span>
            <span>Total <span className="measured text-cool">{ron(state.cash + inv)}</span></span>
          </div>
          <Link to="/account" className="mt-5 inline-block text-sm underline decoration-rule-2 underline-offset-4 hover:text-amber">Deposit or withdraw →</Link>
        </div>
        <div className="space-y-3 p-6 text-sm">
          <Label>Account holder</Label>
          <div className="text-lg">{state.profile.name}</div>
          <div className="text-muted-foreground">{state.profile.email}</div>
          <div><span className="text-muted-foreground">Account </span><span className="measured">{state.profile.accountNumber}</span></div>
          <div><span className="text-muted-foreground">Member since </span><span className="measured">{state.profile.memberSince}</span></div>
        </div>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <TierCard />
        <MilestoneList showNextTier />
      </div>
    </>
  );
}
