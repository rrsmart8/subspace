import { createContext } from "react";

// Server timestamp for the selected account; onboarding uses real time by default.
export const ClockContext = createContext<string | null>(null);
