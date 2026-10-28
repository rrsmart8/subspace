const timeZone = 'Europe/Bucharest';
export function accountNow(state, enabled, realNow = new Date()) {
  return new Date(realNow.getTime() + (enabled ? state.demoClockOffsetMs ?? 0 : 0));
}
export function advanceCalendarMonth(now) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(now);
  const part = name => Number(parts.find(p => p.type === name)?.value);
  const next = new Date(Date.UTC(part('year'), part('month'), 1));
  const year = next.getUTCFullYear(), month = next.getUTCMonth();
  const day = Math.min(part('day'), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  // Noon avoids nonexistent/ambiguous local times during daylight-saving changes.
  const guess = Date.UTC(year, month, day, 12);
  const wall = new Intl.DateTimeFormat('en-GB', { timeZone, hour: 'numeric', hourCycle: 'h23' }).formatToParts(new Date(guess));
  const hour = Number(wall.find(p => p.type === 'hour')?.value);
  return new Date(guess - (hour - 12) * 3600000);
}
export function stampAccount(state, enabled) {
  return { ...state, serverNow: accountNow(state, enabled).toISOString(), demoTimelineEnabled: enabled };
}
