export type Direction = "in" | "out";
export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  direction: Direction;
  status: "completed" | "pending";
}
export interface Stock { symbol: string; name: string; price: number }
export interface Lesson {
  id: string;
  title: string;
  description: string;
  requiresLevel: number;
  body: string[];
  question: { prompt: string; options: string[]; correct: number; explanation: string };
}
export interface DemoState {
  accountId?: string;
  tierLevel?: number;
  profile: { name: string; email: string; accountNumber: string; memberSince: string };
  cash: number;
  holdings: Record<string, { qty: number; cost: number }>;
  transactions: Transaction[];
  redeemed: Record<string, string>;
  completedLessons: string[];
}

export const STOCKS: Stock[] = [
  { symbol: "AAPL", name: "Apple Inc.", price: 189.42 },
  { symbol: "MSFT", name: "Microsoft Corp.", price: 412.1 },
  { symbol: "GOOGL", name: "Alphabet Inc.", price: 151.73 },
  { symbol: "AMZN", name: "Amazon.com Inc.", price: 178.25 },
  { symbol: "NVDA", name: "NVIDIA Corp.", price: 118.6 },
  { symbol: "TSLA", name: "Tesla Inc.", price: 204.3 },
  { symbol: "META", name: "Meta Platforms Inc.", price: 497.8 },
  { symbol: "KO", name: "Coca-Cola Co.", price: 61.12 },
  { symbol: "PEP", name: "PepsiCo Inc.", price: 168.4 },
  { symbol: "NKE", name: "Nike Inc.", price: 94.55 },
  { symbol: "DIS", name: "Walt Disney Co.", price: 99.2 },
  { symbol: "V", name: "Visa Inc.", price: 274.9 },
  { symbol: "JNJ", name: "Johnson & Johnson", price: 152.35 },
  { symbol: "SAP", name: "SAP SE", price: 182.7 },
  { symbol: "ASML", name: "ASML Holding", price: 921.0 },
  { symbol: "F", name: "Ford Motor Co.", price: 12.18 },
];

export const LESSONS: Lesson[] = [
  {
    id: "l-budget", title: "Budgeting basics", description: "Split income into needs, wants and savings.", requiresLevel: 1,
    body: ["A simple budget splits income into three parts: needs (rent, food), wants (fun) and savings.", "A common starting point is 50/30/20. Adjust it to your life, but always pay savings first."],
    question: { prompt: "You earn RON 1,000 a month. Using 50/30/20, how much goes to savings?", options: ["RON 500", "RON 300", "RON 200", "RON 100"], correct: 2, explanation: "20% of RON 1,000 is RON 200." },
  },
  {
    id: "l-emergency", title: "Emergency fund", description: "Why cash comes before investing.", requiresLevel: 1,
    body: ["An emergency fund covers surprise costs without debt.", "Aim for three to six months of essential expenses, held as easy-to-reach cash."],
    question: { prompt: "Where should an emergency fund usually be kept?", options: ["In a single stock", "In easy-access savings", "Locked for 10 years", "In crypto"], correct: 1, explanation: "It must be available quickly and keep its value." },
  },
  {
    id: "l-compound", title: "Compound growth", description: "How returns earn returns over time.", requiresLevel: 1,
    body: ["Compounding means growth is added to your balance, and the next period's growth is calculated on the larger amount.", "Time matters more than timing: starting early helps most."],
    question: { prompt: "RON 100 grows 10% per year, compounded. Roughly how much after 2 years?", options: ["RON 110", "RON 120", "RON 121", "RON 200"], correct: 2, explanation: "RON 100 × 1.1 × 1.1 = RON 121." },
  },
  {
    id: "l-diversify", title: "Diversification", description: "Spreading risk across many holdings.", requiresLevel: 2,
    body: ["Owning many different companies reduces the damage any single one can do.", "Funds that track an index are a simple way to diversify."],
    question: { prompt: "Which portfolio is most diversified?", options: ["One tech stock", "Two airline stocks", "A fund of 500 companies", "Only cash"], correct: 2, explanation: "500 companies across sectors spreads risk widely." },
  },
  {
    id: "l-risk", title: "Risk and time horizon", description: "Matching investments to when you need money.", requiresLevel: 2,
    body: ["Money needed soon should not be exposed to big price swings.", "Long horizons can ride out drops; short ones cannot."],
    question: { prompt: "You need RON 2,000 for a deposit in 6 months. Best place?", options: ["Volatile stocks", "Savings account", "A single new IPO", "Options"], correct: 1, explanation: "A short horizon calls for stable, accessible cash." },
  },
];

export function initialState(): DemoState {
  return {
    profile: { name: "Alex Morgan", email: "alex.morgan@example.com", accountNumber: "DEMO-0042-7781-3306", memberSince: "2026-03-14" },
    cash: 620,
    holdings: {},
    transactions: [
      { id: "t3", date: "2026-10-12T09:30:00Z", description: "Monthly savings deposit", amount: 150, direction: "in", status: "completed" },
      { id: "t2", date: "2026-09-28T14:05:00Z", description: "Withdrawal to linked account", amount: 80, direction: "out", status: "completed" },
      { id: "t1", date: "2026-09-12T09:30:00Z", description: "Opening deposit", amount: 550, direction: "in", status: "completed" },
    ],
    redeemed: {},
    completedLessons: ["l-budget"],
  };
}
