import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trophy, LogOut, Calendar, Medal, ShieldQuestion, Lock, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { MATCHES, TRIVIA, GROUP_TRIVIA, KNOCKOUT_TRIVIA, type Match } from "@/lib/fixtures";
import { fetchKnockoutMatches, fetchMatchResults, PT_TO_EN, type LiveScore } from "@/lib/api";
import { session, scoreForMatch, playerScore, todayStr, type Player } from "@/lib/store";
import {
  loginFn,
  logoutFn,
  getPlayerFn,
  getAllPlayersFn,
  submitPredictionFn,
  submitTriviaFn,
  uploadAvatarFn,
  getLiveScoresFn,
} from "@/lib/server-fns";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Me dá minha Copa!" },
      { name: "description", content: "Palpite nos jogos da Copa e responda a trivia do dia." },
    ],
  }),
  component: App,
  ssr: false,
});

type Tab = "hoje" | "ranking" | "historico";

function App() {
  const [sessionData, setSessionData] = useState(() => session.get());
  const email = sessionData?.email ?? null;
  const [tab, setTab] = useState<Tab>("hoje");
  const queryClient = useQueryClient();

  const { data: knockoutMatches = [] } = useQuery({
    queryKey: ["knockout-matches"],
    queryFn: fetchKnockoutMatches,
    staleTime: 1000 * 60 * 60,
    refetchInterval: 1000 * 60 * 60,
  });

  const { data: matchResults = {} } = useQuery({
    queryKey: ["match-results"],
    queryFn: fetchMatchResults,
    refetchInterval: 30 * 60 * 1000,
    staleTime: 29 * 60 * 1000,
  });

  const allMatches = useMemo(() => {
    const base = [...MATCHES, ...knockoutMatches];
    return base.map((m) => {
      const enHome = PT_TO_EN[m.home.name] ?? m.home.name;
      const enAway = PT_TO_EN[m.away.name] ?? m.away.name;
      const apiResult = matchResults[`${enHome}|${enAway}`];
      return apiResult ? { ...m, result: apiResult } : m;
    });
  }, [knockoutMatches, matchResults]);

  const anyLive = allMatches.some((m) => hasMatchStarted(m) && !m.result);
  const { data: liveScores = [] } = useQuery({
    queryKey: ["live-scores"],
    queryFn: () => getLiveScoresFn(),
    refetchInterval: 10 * 60_000,   // 10 min = ~9 chamadas/jogo, bem abaixo das 100 req/dia grátis
    staleTime: 9 * 60_000,
    enabled: anyLive,
  });

  const { data: player, isLoading } = useQuery({
    queryKey: ["player", email],
    queryFn: () => getPlayerFn({ data: { email: email! } }),
    enabled: !!email,
    staleTime: 0,
  });

  const refreshPlayer = () =>
    queryClient.invalidateQueries({ queryKey: ["player", email] });

  const handleLogout = () => {
    if (sessionData?.token) logoutFn({ data: { sessionToken: sessionData.token } });
    session.clear();
    setSessionData(null);
    queryClient.removeQueries({ queryKey: ["player"] });
  };

  if (!sessionData) return (
    <Login onLogin={(e, token) => {
      session.set(e, token);
      setSessionData({ email: e, token });
    }} />
  );
  if (isLoading) return null;
  if (!player) {
    session.clear();
    setSessionData(null);
    return null;
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col pb-24">
      <Header player={player} email={email!} sessionToken={sessionData!.token} matches={allMatches} onLogout={handleLogout} onAvatarUpdate={refreshPlayer} />
      <main className="flex-1 px-4 pt-4">
        {tab === "hoje" && (
          <TodayView
            player={player}
            matches={allMatches}
            email={email!}
            sessionToken={sessionData!.token}
            liveScores={liveScores}
            onSaved={refreshPlayer}
          />
        )}
        {tab === "ranking" && <RankingView matches={allMatches} />}
        {tab === "historico" && <HistoryView player={player} matches={allMatches} />}
      </main>
      <BottomNav tab={tab} setTab={setTab} />
    </div>
  );
}

/* -------------------- Login -------------------- */

function Login({ onLogin }: { onLogin: (email: string, token: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");

  const login = useMutation({
    mutationFn: (args: { name: string; email: string }) =>
      loginFn({ data: args }),
    onSuccess: ({ player, sessionToken }) =>
      onLogin(player.email, sessionToken),
    onError: () => setErr("Erro ao entrar. Tente novamente."),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) { setErr("Preencha nome e e-mail."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr("E-mail inválido."); return; }
    setErr("");
    login.mutate({ name: name.trim(), email: email.trim() });
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6">
      <div className="mb-8 text-center">
        <div className="mb-3 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-2xl">
          <Trophy className="h-10 w-10" />
        </div>
        <h1 className="font-display text-5xl text-primary">ME DÁ MINHA COPA!</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Bolão da Copa do Mundo + Trivia diária
        </p>
      </div>

      <form onSubmit={submit} className="w-full space-y-4 rounded-2xl bg-card p-6 shadow-xl">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Seu nome
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Ronaldinho"
            className="w-full rounded-xl bg-input px-4 py-3 text-base outline-none ring-primary/60 focus:ring-2"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            E-mail
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
            className="w-full rounded-xl bg-input px-4 py-3 text-base outline-none ring-primary/60 focus:ring-2"
            autoCapitalize="off"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Usado como identificador único. Se já existir, recupera seu progresso.
          </p>
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <button
          type="submit"
          disabled={login.isPending}
          className="w-full rounded-xl bg-primary py-3.5 font-display text-2xl tracking-wide text-primary-foreground shadow-lg transition active:scale-[0.98] disabled:opacity-60"
        >
          {login.isPending ? "Entrando…" : "ENTRAR NO BOLÃO"}
        </button>
      </form>
    </div>
  );
}

/* -------------------- Header / Nav -------------------- */

function resizeToDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const size = 100;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      const ratio = Math.min(size / img.width, size / img.height);
      const w = img.width * ratio;
      const h = img.height * ratio;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.src = URL.createObjectURL(file);
  });
}

function PlayerAvatar({
  player,
  className = "h-9 w-9",
}: {
  player: Pick<Player, "name" | "avatarUrl">;
  className?: string;
}) {
  const initials = player.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <Avatar className={className}>
      {player.avatarUrl && <AvatarImage src={player.avatarUrl} alt={player.name} />}
      <AvatarFallback className="bg-primary/20 text-primary font-bold text-xs">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

function Header({
  player,
  email,
  sessionToken,
  matches,
  onLogout,
  onAvatarUpdate,
}: {
  player: Player;
  email: string;
  sessionToken: string;
  matches: typeof import("@/lib/fixtures").MATCHES;
  onLogout: () => void;
  onAvatarUpdate: () => void;
}) {
  const score = playerScore(player, matches);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadAvatar = useMutation({
    mutationFn: (avatarDataUrl: string) =>
      uploadAvatarFn({ data: { email, sessionToken, avatarDataUrl } }),
    onSuccess: onAvatarUpdate,
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const dataUrl = await resizeToDataUrl(file);
    uploadAvatar.mutate(dataUrl);
  };

  return (
    <header className="sticky top-0 z-10 bg-background/80 px-4 pt-5 pb-3 backdrop-blur-md">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            onClick={() => fileRef.current?.click()}
            aria-label="Alterar foto de perfil"
            className="shrink-0 transition active:scale-95"
            title="Clique para alterar foto"
          >
            <PlayerAvatar player={player} />
          </button>
          <div className="min-w-0">
            <p className="truncate text-xs uppercase tracking-wider text-muted-foreground">
              Olá, {player.name}
            </p>
            <h1 className="font-display text-3xl leading-none text-primary">
              ME DÁ MINHA COPA!
            </h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-primary-foreground shadow">
            <Trophy className="h-4 w-4" />
            <span className="font-bold tabular-nums">{score.total}</span>
          </div>
          <button
            onClick={onLogout}
            aria-label="Sair"
            className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-secondary-foreground"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </header>
  );
}

function BottomNav({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const items: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "hoje", label: "Hoje", icon: <Calendar className="h-5 w-5" /> },
    { id: "ranking", label: "Ranking", icon: <Medal className="h-5 w-5" /> },
    { id: "historico", label: "Histórico", icon: <ShieldQuestion className="h-5 w-5" /> },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-md px-4 pb-4">
      <div className="grid grid-cols-3 rounded-2xl bg-card/95 p-1.5 shadow-2xl ring-1 ring-border backdrop-blur">
        {items.map((it) => {
          const active = tab === it.id;
          return (
            <button
              key={it.id}
              onClick={() => setTab(it.id)}
              className={`flex flex-col items-center gap-0.5 rounded-xl py-2.5 text-xs font-semibold transition ${
                active
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground"
              }`}
            >
              {it.icon}
              {it.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* -------------------- Today -------------------- */

function TodayView({
  player,
  matches,
  email,
  sessionToken,
  liveScores,
  onSaved,
}: {
  player: Player;
  matches: Match[];
  email: string;
  sessionToken: string;
  liveScores: LiveScore[];
  onSaved: () => void;
}) {
  const today = todayStr();
  const todays = useMemo(() => {
    const now = Date.now();
    const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
    const LOOKAHEAD_MS   = 4 * 60 * 60 * 1000;
    return matches
      .filter((m) => {
        const isToday = m.date === today;
        if (isToday) return true; // jogos do dia atual: sempre mostra

        const [h, min] = m.time.split(":").map(Number);
        const [y, mo, d] = m.date.split("-").map(Number);
        const matchUtcMs = Date.UTC(y, mo - 1, d, h + 3, min);

        // Jogo de ontem que cruzou meia-noite e ainda está em andamento (< 3h, sem resultado)
        if (!m.result && now >= matchUtcMs && now - matchUtcMs < THREE_HOURS_MS) return true;

        // Jogo de amanhã que começa em < 4h — janela para palpite em jogos de meia-noite
        if (!m.result && matchUtcMs > now && matchUtcMs - now < LOOKAHEAD_MS) return true;

        return false;
      })
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }, [matches, today]);
  const trivia = TRIVIA.find((t) => t.date === today);

  return (
    <div className="space-y-5">
      <SectionTitle
        kicker="Jogos de hoje"
        title={new Date().toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "2-digit",
          month: "long",
        })}
      />

      {todays.length === 0 && (
        <div className="rounded-2xl bg-card p-6 text-center text-muted-foreground">
          Nenhum jogo hoje. Volte amanhã!
        </div>
      )}

      <div className="space-y-3">
        {todays.map((m) => {
          const enHome = PT_TO_EN[m.home.name] ?? m.home.name;
          const enAway = PT_TO_EN[m.away.name] ?? m.away.name;
          const liveScore = liveScores.find((ls) => ls.key === `${enHome}|${enAway}`);
          return (
            <MatchCard key={m.id} match={m} player={player} email={email} sessionToken={sessionToken} liveScore={liveScore} onSaved={onSaved} />
          );
        })}
      </div>

      {trivia && (
        <TriviaCard
          q={trivia}
          locked={false}
          answered={!!player.trivia[trivia.id]}
          selected={player.trivia[trivia.id]?.optionIndex}
          email={email}
          sessionToken={sessionToken}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">{kicker}</p>
      <h2 className="font-display text-3xl capitalize text-foreground">{title}</h2>
    </div>
  );
}

function matchStartUtcMs(match: Match): number {
  const [h, min] = match.time.split(":").map(Number);
  const [y, mo, d] = match.date.split("-").map(Number);
  return Date.UTC(y, mo - 1, d, h + 3, min); // BRT → UTC
}

function hasMatchStarted(match: Match): boolean {
  return Date.now() >= matchStartUtcMs(match);
}

// Mais de 110 min desde o início → jogo provavelmente encerrado (90 + ~20 de prorrogação)
const MATCH_DURATION_MS = 110 * 60 * 1000;
function hasMatchProbablyEnded(match: Match): boolean {
  return Date.now() - matchStartUtcMs(match) > MATCH_DURATION_MS;
}

function MatchCard({
  match,
  player,
  email,
  sessionToken,
  liveScore,
  onSaved,
}: {
  match: Match;
  player: Player;
  email: string;
  sessionToken: string;
  liveScore?: LiveScore;
  onSaved: () => void;
}) {
  const existing = player.predictions[match.id];
  const [home, setHome] = useState(existing?.home ?? 0);
  const [away, setAway] = useState(existing?.away ?? 0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const predicted = !!existing;
  const started = hasMatchStarted(match);
  const locked = predicted || started;

  const submit = useMutation({
    mutationFn: () =>
      submitPredictionFn({ data: { email, sessionToken, matchId: match.id, home, away } }),
    onSuccess: () => { setDialogOpen(false); onSaved(); },
  });

  const pts = match.result && existing ? scoreForMatch(existing, match) : null;
  const probablyEnded = hasMatchProbablyEnded(match);

  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-lg ring-1 ring-border">
      <div className="flex items-center justify-between bg-secondary/60 px-4 py-2 text-xs">
        <span className="font-bold text-primary">
          {match.group.length === 1 ? `Grupo ${match.group}` : match.group}
        </span>
        {started && !match.result && !probablyEnded ? (
          <span className="flex animate-pulse items-center gap-1 font-bold text-red-500">
            🔴 AO VIVO{liveScore?.minute ? ` ${liveScore.minute}'` : ""}
            {liveScore?.status === "HT" ? " · Intervalo" : ""}
          </span>
        ) : started && !match.result && probablyEnded ? (
          <span className="text-muted-foreground">Aguardando resultado…</span>
        ) : (
          <span className="text-muted-foreground">{match.time}</span>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-5">
        <TeamSide name={match.home.name} flag={match.home.flag} align="right" />
        {match.result ? (
          <div className="flex items-center gap-3">
            <span className="font-display text-5xl text-primary tabular-nums">{match.result.home}</span>
            <span className="font-display text-2xl text-muted-foreground">×</span>
            <span className="font-display text-5xl text-primary tabular-nums">{match.result.away}</span>
          </div>
        ) : started && !probablyEnded ? (
          <div className="flex animate-pulse items-center gap-3">
            <span className="font-display text-5xl text-primary tabular-nums">
              {liveScore?.home ?? "—"}
            </span>
            <span className="font-display text-2xl text-muted-foreground">×</span>
            <span className="font-display text-5xl text-primary tabular-nums">
              {liveScore?.away ?? "—"}
            </span>
          </div>
        ) : started ? (
          <div className="flex items-center gap-3 opacity-40">
            <span className="font-display text-5xl tabular-nums">—</span>
            <span className="font-display text-2xl text-muted-foreground">×</span>
            <span className="font-display text-5xl tabular-nums">—</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Stepper value={home} onChange={setHome} disabled={locked} />
            <span className="font-display text-2xl text-muted-foreground">x</span>
            <Stepper value={away} onChange={setAway} disabled={locked} />
          </div>
        )}
        <TeamSide name={match.away.name} flag={match.away.flag} align="left" />
      </div>

      <div className="border-t border-border px-4 py-3">
        {match.result ? (
          existing ? (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <span>Apostei: <strong className="text-foreground">{existing.home} × {existing.away}</strong></span>
                <span>·</span>
                <span>Resultado: <strong className="text-foreground">{match.result.home} × {match.result.away}</strong></span>
              </div>
              {pts === 3 ? (
                <div className="rounded-xl bg-primary px-4 py-2 text-center text-sm font-bold text-primary-foreground">
                  🎉 Placar exato! +3 pts
                </div>
              ) : pts === 2 ? (
                <div className="rounded-xl bg-accent px-4 py-2 text-center text-sm font-bold text-accent-foreground">
                  ✅ Vencedor certo! +2 pts
                </div>
              ) : pts === 1 ? (
                <div className="rounded-xl bg-accent/50 px-4 py-2 text-center text-sm font-bold text-accent-foreground">
                  🤝 Empate certo! +1 pt
                </div>
              ) : (
                <div className="rounded-xl bg-secondary px-4 py-2 text-center text-sm font-semibold text-secondary-foreground">
                  ❌ Não acertou · +0 pts
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-sm text-muted-foreground">
              Você não apostou neste jogo
            </div>
          )
        ) : predicted ? (
          <div className="flex items-center justify-center gap-2 text-sm font-semibold text-primary">
            <Lock className="h-4 w-4" />
            Palpite confirmado: {existing!.home} × {existing!.away}
          </div>
        ) : started ? (
          <div className="flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground">
            <Lock className="h-4 w-4" />
            Jogo iniciado — prazo encerrado
          </div>
        ) : (
          <button
            onClick={() => setDialogOpen(true)}
            className="w-full rounded-xl bg-primary/90 py-2.5 text-sm font-bold text-primary-foreground transition active:scale-[0.98]"
          >
            Confirmar palpite
          </button>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar palpite?</DialogTitle>
            <DialogDescription>
              Você está prestes a confirmar{" "}
              <strong className="text-foreground">
                {match.home.name} {home} x {away} {match.away.name}
              </strong>
              . Não será possível alterar o palpite depois de confirmado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2">
            <button
              onClick={() => setDialogOpen(false)}
              className="flex-1 rounded-xl bg-secondary py-2.5 text-sm font-semibold"
            >
              Cancelar
            </button>
            <button
              disabled={submit.isPending}
              onClick={() => submit.mutate()}
              className="flex-[2] rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              {submit.isPending ? "Salvando…" : "Confirmar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FlagEmoji({ emoji, className }: { emoji: string; className?: string }) {
  const codepoints = [...emoji]
    .map((c) => c.codePointAt(0)!.toString(16))
    .join("-");
  return (
    <img
      src={`https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${codepoints}.svg`}
      alt={emoji}
      className={className}
      aria-hidden
    />
  );
}

function TeamSide({
  name,
  flag,
  align,
}: {
  name: string;
  flag: string;
  align: "left" | "right";
}) {
  return (
    <div
      className={`flex min-w-0 flex-col items-center gap-1 ${
        align === "right" ? "sm:items-end" : "sm:items-start"
      }`}
    >
      <FlagEmoji emoji={flag} className="h-8 w-8" />
      <span className="truncate text-center text-sm font-semibold">{name}</span>
    </div>
  );
}

function Stepper({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(Math.min(20, value + 1))}
        className="grid h-6 w-10 place-items-center rounded-md bg-secondary text-xs disabled:opacity-40"
      >
        ▲
      </button>
      <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary font-display text-3xl text-primary-foreground tabular-nums">
        {value}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(Math.max(0, value - 1))}
        className="grid h-6 w-10 place-items-center rounded-md bg-secondary text-xs disabled:opacity-40"
      >
        ▼
      </button>
    </div>
  );
}

/* -------------------- Trivia -------------------- */

function TriviaCard({
  q,
  locked,
  answered,
  selected,
  email,
  sessionToken,
  onSaved,
}: {
  q: (typeof TRIVIA)[number];
  locked: boolean;
  answered: boolean;
  selected: number | undefined;
  email: string;
  sessionToken: string;
  onSaved: () => void;
}) {
  const submit = useMutation({
    mutationFn: (optionIndex: number) =>
      submitTriviaFn({ data: { email, sessionToken, triviaId: q.id, optionIndex } }),
    onSuccess: onSaved,
  });

  return (
    <div className="rounded-2xl bg-card p-5 shadow-lg ring-1 ring-accent/40">
      <div className="mb-3 flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-foreground">
          <ShieldQuestion className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-accent-foreground/80">
            Trivia do dia · 1 ponto
          </p>
          <h3 className="font-display text-xl leading-tight">Pergunta da Copa</h3>
        </div>
      </div>
      <p className="mb-4 text-base font-medium">{q.question}</p>

      {locked ? (
        <p className="rounded-xl bg-secondary p-3 text-center text-sm text-muted-foreground">
          <Lock className="mr-1 inline h-3.5 w-3.5" /> Confirme todos os palpites do dia para
          liberar a trivia.
        </p>
      ) : (
        <div className="grid gap-2">
          {q.options.map((opt, i) => {
            const isSelected = selected === i;
            const correct = answered && i === q.answerIndex;
            const wrong = answered && isSelected && i !== q.answerIndex;
            return (
              <button
                key={i}
                disabled={answered || submit.isPending}
                onClick={() => submit.mutate(i)}
                className={`flex items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
                  correct
                    ? "bg-brazil-green text-white"
                    : wrong
                      ? "bg-destructive text-destructive-foreground"
                      : isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground active:scale-[0.99]"
                }`}
              >
                <span>{opt}</span>
                {correct && <Check className="h-4 w-4" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* -------------------- Ranking -------------------- */

const MEDALS = ["🥇", "🥈", "🥉"];
const MEDAL_RINGS = [
  "ring-2 ring-yellow-400/70 shadow-yellow-200/40",
  "ring-2 ring-slate-300 shadow-slate-200/40",
  "ring-2 ring-amber-600/50 shadow-amber-200/40",
];

function RankingView({ matches }: { matches: typeof import("@/lib/fixtures").MATCHES }) {
  const [page, setPage] = useState(0);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const groupStageEnded = todayStr() >= "2026-06-28";
  const [phase, setPhase] = useState<"grupos" | "eliminatoria">(
    groupStageEnded ? "eliminatoria" : "grupos"
  );
  const PER_PAGE = 10;

  const GROUP_LETTERS = ["A","B","C","D","E","F","G","H","I","J","K","L"];
  const groupMatchesWithApi = matches.filter(m => GROUP_LETTERS.includes(m.group));
  const knockoutOnly = matches.filter(m => !GROUP_LETTERS.includes(m.group));
  const knockoutStarted = knockoutOnly.length > 0;

  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => getAllPlayersFn(),
    refetchInterval: 30_000,
  });

  const rows = players
    .map((p) => ({
      p,
      s: phase === "grupos"
        ? playerScore(p, groupMatchesWithApi, GROUP_TRIVIA)
        : playerScore(p, knockoutOnly, KNOCKOUT_TRIVIA),
    }))
    .sort((a, b) => b.s.total - a.s.total);

  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);
  const totalPages = Math.ceil(rest.length / PER_PAGE);
  const pageItems = rest.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  return (
    <div className="space-y-4">
      <SectionTitle
        kicker="Classificação"
        title={phase === "grupos" ? "Fase de Grupos" : "Fase Eliminatória"}
      />

      {/* ── Toggle de fase ── */}
      {groupStageEnded && knockoutStarted && (
        <div className="flex gap-1 rounded-2xl bg-secondary p-1">
          <button
            onClick={() => { setPhase("grupos"); setPage(0); }}
            className={`flex-1 rounded-xl py-2 text-sm font-bold transition ${
              phase === "grupos"
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground"
            }`}
          >
            🏆 Grupos
          </button>
          <button
            onClick={() => { setPhase("eliminatoria"); setPage(0); }}
            className={`flex-1 rounded-xl py-2 text-sm font-bold transition ${
              phase === "eliminatoria"
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground"
            }`}
          >
            ⚡ Eliminatória
          </button>
        </div>
      )}

      {/* ── Banner de celebração ── */}
      {phase === "grupos" && groupStageEnded && (
        <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-center">
          <p className="font-display text-2xl text-primary">🏆 Fase de Grupos Encerrada!</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Ranking final — pontuação congelada</p>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-2xl bg-card p-6 text-center text-muted-foreground">
          Sem jogadores ainda.
        </div>
      ) : (
        <>
          {/* ── Top 3 ── */}
          <ol className="space-y-3">
            {top3.map(({ p, s }, i) => (
              <li
                key={p.email}
                onClick={() => setSelectedPlayer(p)}
                className={`cursor-pointer rounded-2xl bg-card shadow-lg active:opacity-80 ${MEDAL_RINGS[i]}`}
              >
                <div className={`flex items-center gap-4 px-5 ${i === 0 ? "py-4" : "py-3"}`}>
                  <span className={i === 0 ? "text-4xl" : "text-3xl"}>{MEDALS[i]}</span>
                  <PlayerAvatar player={p} className={i === 0 ? "h-14 w-14" : "h-11 w-11"} />
                  <div className="min-w-0 flex-1">
                    {i === 0 && phase === "grupos" && groupStageEnded && (
                      <span className="mb-0.5 inline-block rounded-full bg-yellow-400/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-yellow-600">
                        👑 Campeão da fase
                      </span>
                    )}
                    <p className={`truncate font-bold ${i === 0 ? "text-base" : "text-sm"}`}>
                      {p.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {s.matchPts} pts jogos · {s.triviaPts} pts trivia
                    </p>
                  </div>
                  <div className={`shrink-0 font-display text-primary tabular-nums ${i === 0 ? "text-4xl" : "text-2xl"}`}>
                    {s.total}
                  </div>
                </div>
              </li>
            ))}
          </ol>

          {/* ── Posições 4+ paginadas ── */}
          {rest.length > 0 && (
            <ol className="space-y-2">
              {pageItems.map(({ p, s }, i) => {
                const pos = page * PER_PAGE + i + 4;
                return (
                  <li
                    key={p.email}
                    onClick={() => setSelectedPlayer(p)}
                    className="grid cursor-pointer grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow ring-1 ring-border active:opacity-80"
                  >
                    <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-muted font-display text-sm text-muted-foreground">
                      {pos}
                    </div>
                    <PlayerAvatar player={p} className="h-9 w-9" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{p.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {s.matchPts} pts jogos · {s.triviaPts} pts trivia
                      </p>
                    </div>
                    <div className="shrink-0 font-display text-2xl text-primary tabular-nums">
                      {s.total}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {/* ── Paginação ── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 0}
                className="rounded-xl bg-secondary px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
              >
                ← Anterior
              </button>
              <span className="text-xs text-muted-foreground">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages - 1}
                className="rounded-xl bg-secondary px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
              >
                Próxima →
              </button>
            </div>
          )}
        </>
      )}

      <p className="px-1 text-xs text-muted-foreground">
        Pontuação: placar exato = 3 pts · vencedor = 2 pts · empate = 1 pt · trivia = 1 pt.
      </p>

      <PlayerDetailDrawer
        player={selectedPlayer}
        matches={matches}
        onClose={() => setSelectedPlayer(null)}
      />
    </div>
  );
}

/* -------------------- Player Detail Drawer -------------------- */

function PlayerDetailDrawer({
  player,
  matches,
  onClose,
}: {
  player: Player | null;
  matches: Match[];
  onClose: () => void;
}) {
  const past = matches
    .filter((m) => m.result && !!player?.predictions[m.id])
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));

  return (
    <Drawer open={!!player} onOpenChange={(v) => !v && onClose()}>
      <DrawerContent>
        {player && (
          <>
            <DrawerHeader className="flex items-center gap-3 border-b border-border pb-3">
              <PlayerAvatar player={player} className="h-12 w-12" />
              <div>
                <DrawerTitle className="font-display text-2xl text-primary">
                  {player.name}
                </DrawerTitle>
                <p className="text-xs text-muted-foreground">
                  {Object.keys(player.predictions).length} apostas feitas
                </p>
              </div>
            </DrawerHeader>

            <div className="space-y-2 overflow-y-auto px-4 pb-8 pt-3" style={{ maxHeight: "60vh" }}>
              {past.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nenhuma aposta encerrada ainda.
                </p>
              )}
              {past.map((m) => {
                const pred = player.predictions[m.id];
                const pts = scoreForMatch(pred, m);
                return (
                  <div key={m.id} className="rounded-2xl bg-card p-4 shadow ring-1 ring-border">
                    <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {new Date(m.date).toLocaleDateString("pt-BR")} · Grupo {m.group}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        pts >= 3 ? "bg-primary text-primary-foreground"
                          : pts > 0 ? "bg-accent text-accent-foreground"
                          : "bg-secondary text-secondary-foreground"
                      }`}>
                        +{pts} pts
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        <FlagEmoji emoji={m.home.flag} className="h-6 w-6" />
                        <span className="truncate font-semibold">{m.home.name}</span>
                      </div>
                      <div className="shrink-0 font-display text-xl text-primary tabular-nums">
                        {m.result!.home} x {m.result!.away}
                      </div>
                      <div className="flex min-w-0 items-center justify-end gap-2">
                        <span className="truncate text-right font-semibold">{m.away.name}</span>
                        <FlagEmoji emoji={m.away.flag} className="h-6 w-6" />
                      </div>
                    </div>
                    <p className="mt-2 text-center text-xs text-muted-foreground">
                      Apostou: {pred!.home} x {pred!.away}
                    </p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}

/* -------------------- Histórico -------------------- */

function HistoryView({ player, matches }: { player: Player; matches: Match[] }) {
  const [page, setPage] = useState(0);
  const PER_PAGE = 10;

  const past = matches.filter((m) => m.result).sort((a, b) =>
    (b.date + b.time).localeCompare(a.date + a.time),
  );
  const totalPages = Math.ceil(past.length / PER_PAGE);
  const pageItems = past.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  return (
    <div className="space-y-4">
      <SectionTitle kicker="Seus jogos" title="Histórico de palpites" />
      {past.length === 0 && (
        <div className="rounded-2xl bg-card p-6 text-center text-muted-foreground">
          Ainda não há jogos encerrados.
        </div>
      )}
      <div className="space-y-2">
        {pageItems.map((m) => {
          const pred = player.predictions[m.id];
          const pts = scoreForMatch(pred, m);
          return (
            <div
              key={m.id}
              className="rounded-2xl bg-card p-4 shadow ring-1 ring-border"
            >
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {new Date(m.date).toLocaleDateString("pt-BR")} · Grupo {m.group}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    pts >= 3
                      ? "bg-primary text-primary-foreground"
                      : pts > 0
                        ? "bg-accent text-accent-foreground"
                        : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  +{pts} pts
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <FlagEmoji emoji={m.home.flag} className="h-6 w-6" />
                  <span className="truncate font-semibold">{m.home.name}</span>
                </div>
                <div className="shrink-0 font-display text-xl text-primary tabular-nums">
                  {m.result!.home} x {m.result!.away}
                </div>
                <div className="flex min-w-0 items-center justify-end gap-2">
                  <span className="truncate text-right font-semibold">{m.away.name}</span>
                  <FlagEmoji emoji={m.away.flag} className="h-6 w-6" />
                </div>
              </div>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                {pred ? `Seu palpite: ${pred.home} x ${pred.away}` : "Sem palpite"}
              </p>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 0}
            className="rounded-xl bg-secondary px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="text-xs text-muted-foreground">{page + 1} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages - 1}
            className="rounded-xl bg-secondary px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
          >
            Próxima →
          </button>
        </div>
      )}
    </div>
  );
}
