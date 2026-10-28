import { useState } from "react";
import { CalendarClock, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useDemo } from "@/state/DemoStore";
import { useCurrentDate } from "@/hooks/use-current-date";
import { savingsCalendar } from "@/lib/demo-logic";
import * as api from "@/services/mockApi";
import { Btn } from "./ui";

export function DemoTimeline() {
  const { state, run } = useDemo();
  const now = useCurrentDate();
  const [busy, setBusy] = useState(false);
  if (!state.demoTimelineEnabled) return null;
  const advance = async () => {
    if (busy) return;
    setBusy(true);
    const result = await run(api.advanceMonth);
    setBusy(false);
    if (result.ok) toast.success(result.message); else toast.error(result.error);
  };
  return <aside aria-label="Demo timeline" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed bg-deep px-3 py-2">
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <CalendarClock className="h-3.5 w-3.5" aria-hidden />
      <span>Demo timeline</span><span aria-hidden>·</span>
      <span className="measured text-cool">{savingsCalendar(now).todayLabel}</span>
      <span className="hidden sm:inline">Presentation only</span>
    </div>
    <Btn variant="ghost" className="px-2 py-1 text-xs" busy={busy} onClick={() => void advance()} title="Advance this account's demo clock by one calendar month. Balances and transactions are preserved.">
      Advance 1 month<ChevronRight className="h-3.5 w-3.5" aria-hidden />
    </Btn>
  </aside>;
}
