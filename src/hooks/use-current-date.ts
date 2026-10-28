import { useContext, useEffect, useMemo, useState } from "react";
import { ClockContext } from "@/state/ClockContext";

export function useCurrentDate() {
  const serverNow = useContext(ClockContext);
  const anchor = useMemo(() => ({ receivedAt: Date.now(), serverTime: serverNow ? new Date(serverNow).getTime() : null }), [serverNow]);
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const update = () => setTick(Date.now());
    update();
    const timer = window.setInterval(update, 30_000);
    window.addEventListener("focus", update);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", update); };
  }, [serverNow]);
  return new Date(anchor.serverTime === null ? tick : anchor.serverTime + Math.max(0, tick - anchor.receivedAt));
}
