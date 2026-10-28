// Demo assumptions only. All tier thresholds and reward eligibility live here.
export const DEMO_CONFIG = {
  currency: "RON",
  savingsQualification: { incomePercent: 10, consecutiveMonths: 3, timeZone: "Europe/Bucharest" },
  quarterlyMastery: { bonusIncomePercent: 10, fundingConfirmed: false, scenarioCount: 3 },
  investmentEvaluation: {
    fromTier: 2,
    toTier: 3,
    windowDays: 90,
    // Prototype assessment target, not an expected market return.
    profitTargetPercent: 0.5,
    requiresBalanceAndLessons: true,
    // Await price integration and a cash-flow-adjusted evaluation engine.
    enabled: false,
  },
  tiers: [
    { id: "starter", level: 1, name: "Starter", minBalance: 0, minLessons: 0, investPercent: 0, summary: "Build a savings habit. Investing is locked." },
    { id: "builder", level: 2, name: "Builder", minBalance: 0, minLessons: 2, investPercent: 10, summary: "Investing up to 10%" },
    { id: "investor", level: 3, name: "Investor", minBalance: 0, minLessons: 4, investPercent: 25, summary: "Simulated investing up to 25% of capital." },
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
