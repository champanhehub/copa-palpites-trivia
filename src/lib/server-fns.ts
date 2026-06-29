"use server";

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertRateLimit } from "./rate-limit";
import { mapLiveScores, type LiveScore } from "./api";
import {
  dbLogin,
  dbGetPlayer,
  dbGetAllPlayers,
  dbSubmitPrediction,
  dbSubmitTrivia,
  dbSaveAvatar,
  dbCreateSession,
  dbValidateSession,
  dbDeleteSession,
  dbDeletePlayer,
  dbGetAllPredictions,
} from "./db";

const withSession = z.object({ email: z.string(), sessionToken: z.string() });

function assertSession(email: string, token: string) {
  if (!dbValidateSession(email, token)) {
    throw new Error("Sessão inválida ou expirada. Faça login novamente.");
  }
}

export const loginFn = createServerFn()
  .validator(z.object({ name: z.string().min(1), email: z.string().email() }))
  .handler(({ data }) => {
    const player = dbLogin(data.email, data.name);
    const sessionToken = dbCreateSession(player.email);
    return { player, sessionToken };
  });

export const logoutFn = createServerFn()
  .validator(z.object({ sessionToken: z.string() }))
  .handler(({ data }) => dbDeleteSession(data.sessionToken));

export const getPlayerFn = createServerFn()
  .validator(z.object({ email: z.string() }))
  .handler(({ data }) => dbGetPlayer(data.email));

export const getAllPlayersFn = createServerFn()
  .handler(() => dbGetAllPlayers());

export const submitPredictionFn = createServerFn()
  .validator(
    withSession.extend({
      matchId: z.string(),
      home: z.number().int().min(0).max(20),
      away: z.number().int().min(0).max(20),
    })
  )
  .handler(({ data }) => {
    assertSession(data.email, data.sessionToken);
    assertRateLimit(`${data.email}:prediction`, 15);
    return dbSubmitPrediction(data.email, data.matchId, data.home, data.away);
  });

export const submitTriviaFn = createServerFn()
  .validator(
    withSession.extend({
      triviaId: z.string(),
      optionIndex: z.number().int().min(0).max(3),
    })
  )
  .handler(({ data }) => {
    assertSession(data.email, data.sessionToken);
    assertRateLimit(`${data.email}:trivia`, 15);
    return dbSubmitTrivia(data.email, data.triviaId, data.optionIndex);
  });

// ── Admin ──────────────────────────────────────────────────────────────────

function assertAdminSession(token: string) {
  const adminEmail = process.env.ADMIN_EMAIL ?? "";
  if (!adminEmail || !dbValidateSession(adminEmail, token)) {
    throw new Error("Acesso negado.");
  }
}

export const adminLoginFn = createServerFn()
  .validator(z.object({ email: z.string(), password: z.string() }))
  .handler(({ data }) => {
    const adminEmail = process.env.ADMIN_EMAIL ?? "";
    const adminPass  = process.env.ADMIN_PASS  ?? "";
    if (
      data.email.trim().toLowerCase() !== adminEmail.toLowerCase() ||
      data.password !== adminPass
    ) {
      throw new Error("Credenciais inválidas.");
    }
    const token = dbCreateSession(adminEmail);
    return { token };
  });

export const adminLogoutFn = createServerFn()
  .validator(z.object({ adminToken: z.string() }))
  .handler(({ data }) => dbDeleteSession(data.adminToken));

export const adminGetDataFn = createServerFn()
  .validator(z.object({ adminToken: z.string() }))
  .handler(({ data }) => {
    assertAdminSession(data.adminToken);
    return {
      players: dbGetAllPlayers(),
      predictionsByMatch: dbGetAllPredictions(),
    };
  });

export const adminDeletePlayerFn = createServerFn()
  .validator(z.object({ adminToken: z.string(), email: z.string() }))
  .handler(({ data }) => {
    assertAdminSession(data.adminToken);
    dbDeletePlayer(data.email);
  });

// ── Live Scores ───────────────────────────────────────────────────────────────

// API-Football — retorna todos os jogos ao vivo em 1 request (100 req/dia grátis)
const LIVE_API_URL = "https://v3.football.api-sports.io/fixtures?live=all";

export const getLiveScoresFn = createServerFn()
  .handler(async (): Promise<LiveScore[]> => {
    const key = process.env.API_FOOTBALL_KEY ?? "";
    if (!key) return [];
    try {
      const res = await fetch(LIVE_API_URL, {
        headers: { "x-apisports-key": key },
      });
      if (!res.ok) return [];
      return mapLiveScores(await res.json());
    } catch {
      return [];
    }
  });

export const uploadAvatarFn = createServerFn()
  .validator(
    withSession.extend({
      avatarDataUrl: z.string().max(200_000),
    })
  )
  .handler(({ data }) => {
    assertSession(data.email, data.sessionToken);
    return dbSaveAvatar(data.email, data.avatarDataUrl);
  });
