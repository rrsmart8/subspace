import { savingsCalendar } from "@/lib/demo-logic";

export function SavingsDates({ now, showNote = true }: { now: Date; showNote?: boolean }) {
  const calendar = savingsCalendar(now);
  return <div className="mt-3 space-y-1 border-t pt-3 text-sm text-muted-foreground">
    <div className="flex flex-wrap justify-between gap-x-3"><span>Today</span><time dateTime={calendar.today} className="measured text-cool">{calendar.todayLabel}</time></div>
    <div className="flex flex-wrap justify-between gap-x-3"><span>Deposit before</span><time dateTime={calendar.nextDeadline} className="measured text-cool">{calendar.nextDeadlineLabel}, 00:00</time></div>
    {showNote && <p className="pt-1 text-xs">Bucharest time. An unmet monthly target resets your streak at the deadline.</p>}
  </div>;
}
