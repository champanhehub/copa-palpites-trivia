import { MATCHES, TRIVIA, type Match } from "./fixtures";

export type Prediction = {
  matchId: string;
  home: number;
  away: number;
  createdAt: number;
};

export type TriviaAnswer = {
  triviaId: string;
  optionIndex: number;
  createdAt: number;
};

export type Player = {
  email: string;
  name: string;
  avatarUrl?: string | null;
  predictions: Record<string, Prediction>;
  trivia: Record<string, TriviaAnswer>;
};

const SESSION_KEY = "copa-session-v2";

type SessionData = { email: string; token: string };

function readSession(): SessionData | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null");
  } catch {
    return null;
  }
}

export const session = {
  get(): SessionData | null {
    return readSession();
  },
  getEmail(): string | null {
    return readSession()?.email ?? null;
  },
  set(email: string, token: string) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ email, token }));
  },
  clear() {
    localStorage.removeItem(SESSION_KEY);
  },
};

export function scoreForMatch(pred: Prediction | undefined, match: Match): number {
  if (!pred || !match.result) return 0;
  const exact = pred.home === match.result.home && pred.away === match.result.away;
  if (exact) return 3;
  const predWinner =
    pred.home === pred.away ? "draw" : pred.home > pred.away ? "home" : "away";
  const realWinner =
    match.result.home === match.result.away
      ? "draw"
      : match.result.home > match.result.away
        ? "home"
        : "away";
  if (predWinner !== realWinner) return 0;
  return realWinner === "draw" ? 1 : 2;
}

export function playerScore(
  player: Player,
  matches: typeof MATCHES = MATCHES,
  triviaList: typeof TRIVIA = TRIVIA,
): {
  total: number;
  matchPts: number;
  triviaPts: number;
} {
  let matchPts = 0;
  for (const m of matches) {
    matchPts += scoreForMatch(player.predictions[m.id], m);
  }
  let triviaPts = 0;
  for (const t of triviaList) {
    const ans = player.trivia[t.id];
    if (ans && ans.optionIndex === t.answerIndex) triviaPts += 1;
  }
  return { total: matchPts + triviaPts, matchPts, triviaPts };
}

export function todayStr() {
  // Usa data em BRT (UTC-3) para coincidir com os horários dos jogos
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
