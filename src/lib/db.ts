import Database from "better-sqlite3";
import path from "node:path";
import type { Player, Prediction, TriviaAnswer } from "./store";

const DB_PATH = path.join(process.cwd(), "copa.db");

declare global {
  // eslint-disable-next-line no-var
  var __copa_db__: ReturnType<typeof Database> | undefined;
}

function getDb(): ReturnType<typeof Database> {
  if (!globalThis.__copa_db__) {
    const db = new Database(DB_PATH);
    db.exec(`
      CREATE TABLE IF NOT EXISTS players (
        email    TEXT PRIMARY KEY,
        name     TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS predictions (
        player_email TEXT NOT NULL,
        match_id     TEXT NOT NULL,
        home         INTEGER NOT NULL,
        away         INTEGER NOT NULL,
        created_at   INTEGER NOT NULL,
        PRIMARY KEY (player_email, match_id)
      );
      CREATE TABLE IF NOT EXISTS trivia_answers (
        player_email TEXT NOT NULL,
        trivia_id    TEXT NOT NULL,
        option_index INTEGER NOT NULL,
        created_at   INTEGER NOT NULL,
        PRIMARY KEY (player_email, trivia_id)
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        token      TEXT PRIMARY KEY,
        email      TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
    // Migração segura: adicionar avatar_url se ainda não existir
    const hasAvatarCol = db.prepare(
      "SELECT COUNT(*) as n FROM pragma_table_info('players') WHERE name='avatar_url'"
    ).get() as { n: number };
    if (!hasAvatarCol.n) db.exec("ALTER TABLE players ADD COLUMN avatar_url TEXT");
    globalThis.__copa_db__ = db;
  }
  return globalThis.__copa_db__!;
}

type PlayerRow   = { email: string; name: string; avatar_url: string | null };
type PredRow     = { match_id: string; home: number; away: number; created_at: number };
type TriviaRow   = { trivia_id: string; option_index: number; created_at: number };

function buildPlayer(email: string): Player {
  const db = getDb();
  const row = db.prepare<[string], PlayerRow>(
    "SELECT email, name, avatar_url FROM players WHERE email = ?"
  ).get(email);
  if (!row) throw new Error("Player not found");

  const preds = db.prepare<[string], PredRow>(
    "SELECT match_id, home, away, created_at FROM predictions WHERE player_email = ?"
  ).all(email);

  const trivias = db.prepare<[string], TriviaRow>(
    "SELECT trivia_id, option_index, created_at FROM trivia_answers WHERE player_email = ?"
  ).all(email);

  const predictions: Record<string, Prediction> = {};
  for (const r of preds) {
    predictions[r.match_id] = {
      matchId: r.match_id,
      home: r.home,
      away: r.away,
      createdAt: r.created_at,
    };
  }

  const trivia: Record<string, TriviaAnswer> = {};
  for (const r of trivias) {
    trivia[r.trivia_id] = {
      triviaId: r.trivia_id,
      optionIndex: r.option_index,
      createdAt: r.created_at,
    };
  }

  return { email: row.email, name: row.name, avatarUrl: row.avatar_url, predictions, trivia };
}

export function dbLogin(email: string, name: string): Player {
  const db = getDb();
  const key = email.trim().toLowerCase();
  db.prepare(
    "INSERT INTO players (email, name, created_at) VALUES (?, ?, ?) ON CONFLICT(email) DO UPDATE SET name = excluded.name"
  ).run(key, name.trim(), Date.now());
  return buildPlayer(key);
}

export function dbGetPlayer(email: string): Player | null {
  const db = getDb();
  const key = email.trim().toLowerCase();
  const row = db.prepare<[string], PlayerRow>(
    "SELECT email FROM players WHERE email = ?"
  ).get(key);
  if (!row) return null;
  return buildPlayer(key);
}

export function dbGetAllPlayers(): Player[] {
  const db = getDb();
  const rows = db.prepare<[], PlayerRow>("SELECT email FROM players").all();
  return rows.map((r) => buildPlayer(r.email));
}

export function dbSubmitPrediction(
  email: string,
  matchId: string,
  home: number,
  away: number
): void {
  const db = getDb();
  db.prepare(
    "INSERT OR IGNORE INTO predictions (player_email, match_id, home, away, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(email, matchId, home, away, Date.now());
}

export function dbCreateSession(email: string): string {
  const token = crypto.randomUUID();
  getDb()
    .prepare("INSERT INTO sessions (token, email, created_at) VALUES (?, ?, ?)")
    .run(token, email, Date.now());
  return token;
}

export function dbValidateSession(email: string, token: string): boolean {
  const row = getDb()
    .prepare("SELECT 1 FROM sessions WHERE token = ? AND email = ?")
    .get(token, email);
  return !!row;
}

export function dbDeleteSession(token: string): void {
  getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function dbSaveAvatar(email: string, dataUrl: string): Player {
  const db = getDb();
  db.prepare("UPDATE players SET avatar_url = ? WHERE email = ?").run(dataUrl, email);
  return buildPlayer(email);
}

export function dbDeletePlayer(email: string): void {
  const db = getDb();
  db.prepare("DELETE FROM predictions WHERE player_email = ?").run(email);
  db.prepare("DELETE FROM trivia_answers WHERE player_email = ?").run(email);
  db.prepare("DELETE FROM sessions WHERE email = ?").run(email);
  db.prepare("DELETE FROM players WHERE email = ?").run(email);
}

type PredictionRow = { player_email: string; match_id: string; home: number; away: number };

export function dbGetAllPredictions(): Record<string, Array<{ email: string; name: string; home: number; away: number }>> {
  const db = getDb();
  const rows = db.prepare<[], PredictionRow & { name: string }>(
    `SELECT p.player_email, p.match_id, p.home, p.away, pl.name
     FROM predictions p JOIN players pl ON pl.email = p.player_email`
  ).all();

  const result: Record<string, Array<{ email: string; name: string; home: number; away: number }>> = {};
  for (const r of rows) {
    if (!result[r.match_id]) result[r.match_id] = [];
    result[r.match_id].push({ email: r.player_email, name: r.name, home: r.home, away: r.away });
  }
  return result;
}

export function dbSubmitTrivia(
  email: string,
  triviaId: string,
  optionIndex: number
): void {
  const db = getDb();
  db.prepare(
    "INSERT OR IGNORE INTO trivia_answers (player_email, trivia_id, option_index, created_at) VALUES (?, ?, ?, ?)"
  ).run(email, triviaId, optionIndex, Date.now());
}
