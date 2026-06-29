import type { Match } from "./fixtures";
import { TEAM_FLAGS } from "./fixtures";

const OPENFOOTBALL_URL =
  "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";

const TEAM_NAMES_PT: Record<string, string> = {
  Mexico: "México", "South Africa": "África do Sul", "South Korea": "Coreia do Sul",
  "Czech Republic": "República Tcheca", Canada: "Canadá",
  "Bosnia & Herzegovina": "Bósnia e Herzegovina", Qatar: "Catar", Switzerland: "Suíça",
  Brazil: "Brasil", Morocco: "Marrocos", Haiti: "Haiti", Scotland: "Escócia",
  USA: "EUA", Paraguay: "Paraguai", Australia: "Austrália", Turkey: "Turquia",
  Germany: "Alemanha", "Curaçao": "Curaçao", "Ivory Coast": "Costa do Marfim",
  Ecuador: "Equador", Netherlands: "Holanda", Japan: "Japão", Sweden: "Suécia",
  Tunisia: "Tunísia", Belgium: "Bélgica", Egypt: "Egito", Iran: "Irã",
  "New Zealand": "Nova Zelândia", Spain: "Espanha", "Cape Verde": "Cabo Verde",
  "Saudi Arabia": "Arábia Saudita", Uruguay: "Uruguai", France: "França",
  Senegal: "Senegal", Iraq: "Iraque", Norway: "Noruega", Argentina: "Argentina",
  Algeria: "Argélia", Austria: "Áustria", Jordan: "Jordânia", Portugal: "Portugal",
  "DR Congo": "Congo", Uzbekistan: "Uzbequistão", Colombia: "Colômbia",
  England: "Inglaterra", Croatia: "Croácia", Ghana: "Gana", Panama: "Panamá",
};

type OpenFootballMatch = {
  num?: number;  // número sequencial do jogo (73-104 no knockout) — usado como ID estável
  round: string;
  date: string;
  time: string;
  team1: string;
  team2: string;
  score?: { ft: [number, number] };
  group?: string;
};

function toBrasilia(dateStr: string, timeStr: string): { date: string; time: string } {
  const [hourStr, minStr] = timeStr.split(" ")[0].split(":");
  const utcOffset = parseInt(timeStr.split(" ")[1].replace("UTC", ""), 10);
  const h = parseInt(hourStr, 10);
  const m = parseInt(minStr, 10);
  const [y, mo, d] = dateStr.split("-").map(Number);
  // local_time - utcOffset = UTC; UTC - 3 = BRT
  const brtDate = new Date(Date.UTC(y, mo - 1, d, h - utcOffset - 3, m));
  return {
    date: brtDate.toISOString().slice(0, 10),
    time: `${String(brtDate.getUTCHours()).padStart(2, "0")}:${String(brtDate.getUTCMinutes()).padStart(2, "0")}`,
  };
}

const ROUND_NAMES_PT: Record<string, string> = {
  "Round of 32":            "Rodada de 32",
  "Round of 16":            "Oitavas de Final",
  "Quarter-final":          "Quartas de Final",
  "Quarterfinals":          "Quartas de Final",
  "Semi-final":             "Semifinal",
  "Semifinals":             "Semifinal",
  "Match for third place":  "Disputa 3º Lugar",
  "Final":                  "Final",
};

function mapMatch(m: OpenFootballMatch, idx: number): Match {
  const { date, time } = toBrasilia(m.date, m.time);
  const name1 = TEAM_NAMES_PT[m.team1] ?? m.team1;
  const name2 = TEAM_NAMES_PT[m.team2] ?? m.team2;
  const flag1 = TEAM_FLAGS[m.team1] ?? "🏳";
  const flag2 = TEAM_FLAGS[m.team2] ?? "🏳";
  const roundSlug = m.round.toLowerCase().replace(/\s+/g, "-");
  const match: Match = {
    id: m.num ? `wc26-ko-${m.num}` : `wc26-ko-${roundSlug}-${idx + 1}`,
    date,
    time,
    group: ROUND_NAMES_PT[m.round] ?? m.round,
    home: { name: name1, flag: flag1 },
    away: { name: name2, flag: flag2 },
  };
  if (m.score?.ft) match.result = { home: m.score.ft[0], away: m.score.ft[1] };
  return match;
}

// Mapeamento inverso: nome em português → nome em inglês (para lookup na API)
export const PT_TO_EN: Record<string, string> = Object.fromEntries(
  Object.entries(TEAM_NAMES_PT).map(([en, pt]) => [pt, en])
);

// Tipo retornado para scores ao vivo (API-Football)
export type LiveScore = {
  key: string;      // "France|Iraq" (nomes em inglês, formato da API-Football)
  home: number;
  away: number;
  minute: number;   // minuto atual do jogo
  status: string;   // "1H" | "HT" | "2H" | "ET" | "P"
};

// Converte resposta da API-Football (/fixtures?live=all) para LiveScore[].
export function mapLiveScores(data: unknown): LiveScore[] {
  try {
    const items = (data as any)?.response ?? [];
    if (!Array.isArray(items)) return [];
    return items
      .filter((m: any) =>
        ["1H", "2H", "HT", "ET", "P"].includes(m.fixture?.status?.short ?? "")
      )
      .map((m: any) => ({
        key: `${m.teams?.home?.name ?? ""}|${m.teams?.away?.name ?? ""}`,
        home: m.goals?.home ?? 0,
        away: m.goals?.away ?? 0,
        minute: m.fixture?.status?.elapsed ?? 0,
        status: m.fixture?.status?.short ?? "",
      }));
  } catch {
    return [];
  }
}

// Busca resultados de TODOS os jogos (grupos + eliminatória) do OpenFootball.
// Retorna Record<"HomeEN|AwayEN", { home, away }> apenas para jogos encerrados.
export async function fetchMatchResults(): Promise<Record<string, { home: number; away: number }>> {
  try {
    const res = await fetch(OPENFOOTBALL_URL);
    if (!res.ok) return {};
    const data: { matches: OpenFootballMatch[] } = await res.json();
    const results: Record<string, { home: number; away: number }> = {};
    for (const m of data.matches) {
      const ft = m.score?.ft;
      if (!ft || ft[0] == null) continue;
      results[`${m.team1}|${m.team2}`] = { home: ft[0], away: ft[1] };
    }
    return results;
  } catch {
    return {};
  }
}

export async function fetchKnockoutMatches(): Promise<Match[]> {
  try {
    const res = await fetch(OPENFOOTBALL_URL);
    if (!res.ok) return [];
    const data: { matches: OpenFootballMatch[] } = await res.json();
    const knockout = data.matches.filter((m) => !m.group);
    return knockout.map((m, i) => mapMatch(m, i));
  } catch {
    return [];
  }
}
