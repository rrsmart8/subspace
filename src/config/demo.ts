// Demo assumptions only. All tier thresholds and reward eligibility live here.
export const DEMO_CONFIG = {
  currency: "RON",
  tiers: [
    { id: "starter", level: 1, name: "Starter", minBalance: 0, minLessons: 0, investAllowance: 0, summary: "Build a savings habit. Investing is locked." },
    { id: "builder", level: 2, name: "Builder", minBalance: 1000, minLessons: 2, investAllowance: 250, summary: "Simulated investing up to RON 250 of holdings." },
    { id: "investor", level: 3, name: "Investor", minBalance: 5000, minLessons: 4, investAllowance: 2000, summary: "Simulated investing up to RON 2,000 of holdings." },
  ],
  rewards: [
    { id: "r-coffee", provider: "Bean & Ledger (sample)", title: "Free coffee", description: "One filter coffee at any sample café.", minTierLevel: 1, prefix: "BEAN" },
    { id: "r-books", provider: "Paperleaf Books (sample)", title: "10% off finance books", description: "Discount on personal finance titles.", minTierLevel: 2, prefix: "LEAF" },
    { id: "r-transit", provider: "Northline Transit (sample)", title: "Weekly transit pass", description: "Seven days of sample city transit.", minTierLevel: 2, prefix: "NRTH" },
    { id: "r-course", provider: "Atlas Academy (sample)", title: "Advanced investing course", description: "A free seat in a sample online course.", minTierLevel: 3, prefix: "ATLS" },
  ],
} as const;

export type Tier = (typeof DEMO_CONFIG.tiers)[number];
export type Reward = (typeof DEMO_CONFIG.rewards)[number];
