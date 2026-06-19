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
  predictions: Record<string, Prediction>;
  trivia: Record<string, TriviaAnswer>;
};

type DB = {
  currentEmail: string | null;
  players: Record<string, Player>;
};

const KEY = "copa-palpites-v1";

function load(): DB {
  if (typeof window === "undefined") return { currentEmail: null, players: {} };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { currentEmail: null, players: {} };
    return JSON.parse(raw) as DB;
  } catch {
    return { currentEmail: null, players: {} };
  }
}

function save(db: DB) {
  localStorage.setItem(KEY, JSON.stringify(db));
}

export const store = {
  get: load,
  save,
  login(name: string, email: string): Player {
    const db = load();
    const key = email.trim().toLowerCase();
    const existing = db.players[key];
    const player: Player =
      existing ?? { email: key, name: name.trim(), predictions: {}, trivia: {} };
    if (existing && name.trim() && existing.name !== name.trim()) {
      player.name = name.trim();
    }
    db.players[key] = player;
    db.currentEmail = key;
    save(db);
    return player;
  },
  logout() {
    const db = load();
    db.currentEmail = null;
    save(db);
  },
  currentPlayer(): Player | null {
    const db = load();
    if (!db.currentEmail) return null;
    return db.players[db.currentEmail] ?? null;
  },
  submitPrediction(matchId: string, home: number, away: number) {
    const db = load();
    if (!db.currentEmail) return;
    const p = db.players[db.currentEmail];
    if (p.predictions[matchId]) return; // locked
    p.predictions[matchId] = { matchId, home, away, createdAt: Date.now() };
    save(db);
  },
  submitTrivia(triviaId: string, optionIndex: number) {
    const db = load();
    if (!db.currentEmail) return;
    const p = db.players[db.currentEmail];
    if (p.trivia[triviaId]) return;
    p.trivia[triviaId] = { triviaId, optionIndex, createdAt: Date.now() };
    save(db);
  },
  allPlayers(): Player[] {
    return Object.values(load().players);
  },
};

export function scoreForMatch(pred: Prediction | undefined, match: Match): number {
  if (!pred || !match.result) return 0;
  const exact = pred.home === match.result.home && pred.away === match.result.away;
  if (exact) return 5;
  const predWinner =
    pred.home === pred.away ? "draw" : pred.home > pred.away ? "home" : "away";
  const realWinner =
    match.result.home === match.result.away
      ? "draw"
      : match.result.home > match.result.away
        ? "home"
        : "away";
  return predWinner === realWinner ? 2 : 0;
}

export function playerScore(player: Player): {
  total: number;
  matchPts: number;
  triviaPts: number;
} {
  let matchPts = 0;
  for (const m of MATCHES) {
    matchPts += scoreForMatch(player.predictions[m.id], m);
  }
  let triviaPts = 0;
  for (const t of TRIVIA) {
    const ans = player.trivia[t.id];
    if (ans && ans.optionIndex === t.answerIndex) triviaPts += 1;
  }
  return { total: matchPts + triviaPts, matchPts, triviaPts };
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
