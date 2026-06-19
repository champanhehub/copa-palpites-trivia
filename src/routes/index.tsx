import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Trophy, LogOut, Calendar, Medal, ShieldQuestion, Lock, Check } from "lucide-react";
import { MATCHES, TRIVIA, type Match } from "@/lib/fixtures";
import {
  store,
  scoreForMatch,
  playerScore,
  todayStr,
  type Player,
} from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Copa Palpites — Bolão da Copa" },
      { name: "description", content: "Palpite nos jogos da Copa e responda a trivia do dia." },
    ],
  }),
  component: App,
  ssr: false,
});

type Tab = "hoje" | "ranking" | "historico";

function App() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<Tab>("hoje");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setPlayer(store.currentPlayer());
    setHydrated(true);
  }, []);

  const refresh = () => {
    setPlayer(store.currentPlayer());
    setTick((t) => t + 1);
  };

  if (!hydrated) return null;
  if (!player) return <Login onLogin={(p) => setPlayer(p)} />;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col pb-24">
      <Header player={player} onLogout={() => { store.logout(); setPlayer(null); }} />
      <main key={tick} className="flex-1 px-4 pt-4">
        {tab === "hoje" && <TodayView player={player} onChange={refresh} />}
        {tab === "ranking" && <RankingView />}
        {tab === "historico" && <HistoryView player={player} />}
      </main>
      <BottomNav tab={tab} setTab={setTab} />
    </div>
  );
}

/* -------------------- Login -------------------- */

function Login({ onLogin }: { onLogin: (p: Player) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setErr("Preencha nome e e-mail.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErr("E-mail inválido.");
      return;
    }
    onLogin(store.login(name, email));
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6">
      <div className="mb-8 text-center">
        <div className="mb-3 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-2xl">
          <Trophy className="h-10 w-10" />
        </div>
        <h1 className="font-display text-5xl text-primary">COPA PALPITES</h1>
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
          className="w-full rounded-xl bg-primary py-3.5 font-display text-2xl tracking-wide text-primary-foreground shadow-lg transition active:scale-[0.98]"
        >
          ENTRAR NO BOLÃO
        </button>
      </form>
    </div>
  );
}

/* -------------------- Header / Nav -------------------- */

function Header({ player, onLogout }: { player: Player; onLogout: () => void }) {
  const score = playerScore(player);
  return (
    <header className="sticky top-0 z-10 bg-background/80 px-4 pt-5 pb-3 backdrop-blur-md">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs uppercase tracking-wider text-muted-foreground">
            Olá, {player.name}
          </p>
          <h1 className="font-display text-3xl leading-none text-primary">
            COPA PALPITES
          </h1>
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

function TodayView({ player, onChange }: { player: Player; onChange: () => void }) {
  const today = todayStr();
  const todays = useMemo(
    () => MATCHES.filter((m) => m.date === today).sort((a, b) => a.time.localeCompare(b.time)),
    [today],
  );
  const trivia = TRIVIA.find((t) => t.date === today);
  const allPredicted = todays.length > 0 && todays.every((m) => player.predictions[m.id]);

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
        {todays.map((m) => (
          <MatchCard key={m.id} match={m} player={player} onSaved={onChange} />
        ))}
      </div>

      {trivia && (
        <TriviaCard
          q={trivia}
          locked={!allPredicted && todays.length > 0}
          answered={!!player.trivia[trivia.id]}
          selected={player.trivia[trivia.id]?.optionIndex}
          onAnswer={(idx) => {
            store.submitTrivia(trivia.id, idx);
            onChange();
          }}
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

function MatchCard({
  match,
  player,
  onSaved,
}: {
  match: Match;
  player: Player;
  onSaved: () => void;
}) {
  const existing = player.predictions[match.id];
  const [home, setHome] = useState(existing?.home ?? 0);
  const [away, setAway] = useState(existing?.away ?? 0);
  const [confirming, setConfirming] = useState(false);
  const locked = !!existing;

  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-lg ring-1 ring-border">
      <div className="flex items-center justify-between bg-secondary/60 px-4 py-2 text-xs">
        <span className="font-bold text-primary">Grupo {match.group}</span>
        <span className="text-muted-foreground">{match.time}</span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-5">
        <TeamSide name={match.home.name} flag={match.home.flag} align="right" />
        <div className="flex items-center gap-2">
          <Stepper value={home} onChange={setHome} disabled={locked} />
          <span className="font-display text-2xl text-muted-foreground">x</span>
          <Stepper value={away} onChange={setAway} disabled={locked} />
        </div>
        <TeamSide name={match.away.name} flag={match.away.flag} align="left" />
      </div>

      <div className="border-t border-border px-4 py-3">
        {locked ? (
          <div className="flex items-center justify-center gap-2 text-sm font-semibold text-primary">
            <Lock className="h-4 w-4" />
            Palpite confirmado: {existing.home} x {existing.away}
          </div>
        ) : confirming ? (
          <div className="flex gap-2">
            <button
              onClick={() => setConfirming(false)}
              className="flex-1 rounded-xl bg-secondary py-2.5 text-sm font-semibold"
            >
              Voltar
            </button>
            <button
              onClick={() => {
                store.submitPrediction(match.id, home, away);
                setConfirming(false);
                onSaved();
              }}
              className="flex-[2] rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground"
            >
              Confirmar {home} x {away}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="w-full rounded-xl bg-primary/90 py-2.5 text-sm font-bold text-primary-foreground transition active:scale-[0.98]"
          >
            Confirmar palpite
          </button>
        )}
      </div>
    </div>
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
      <span className="text-3xl leading-none">{flag}</span>
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
  onAnswer,
}: {
  q: (typeof TRIVIA)[number];
  locked: boolean;
  answered: boolean;
  selected: number | undefined;
  onAnswer: (idx: number) => void;
}) {
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
                disabled={answered}
                onClick={() => onAnswer(i)}
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

function RankingView() {
  const players = store.allPlayers();
  const rows = players
    .map((p) => ({ p, s: playerScore(p) }))
    .sort((a, b) => b.s.total - a.s.total);

  return (
    <div className="space-y-4">
      <SectionTitle kicker="Classificação" title="Ranking geral" />
      {rows.length === 0 ? (
        <div className="rounded-2xl bg-card p-6 text-center text-muted-foreground">
          Sem jogadores ainda.
        </div>
      ) : (
        <ol className="space-y-2">
          {rows.map(({ p, s }, i) => (
            <li
              key={p.email}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow ring-1 ring-border"
            >
              <div
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl font-display text-lg ${
                  i === 0
                    ? "bg-primary text-primary-foreground"
                    : i === 1
                      ? "bg-secondary text-secondary-foreground"
                      : i === 2
                        ? "bg-accent text-accent-foreground"
                        : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}
              </div>
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
          ))}
        </ol>
      )}
      <p className="px-1 text-xs text-muted-foreground">
        Pontuação: placar exato = 5 · vencedor = 2 · trivia = 1.
      </p>
    </div>
  );
}

/* -------------------- Histórico -------------------- */

function HistoryView({ player }: { player: Player }) {
  const past = MATCHES.filter((m) => m.result).sort((a, b) =>
    (b.date + b.time).localeCompare(a.date + a.time),
  );

  return (
    <div className="space-y-4">
      <SectionTitle kicker="Seus jogos" title="Histórico de palpites" />
      {past.length === 0 && (
        <div className="rounded-2xl bg-card p-6 text-center text-muted-foreground">
          Ainda não há jogos encerrados.
        </div>
      )}
      <div className="space-y-2">
        {past.map((m) => {
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
                    pts >= 5
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
                  <span className="text-xl">{m.home.flag}</span>
                  <span className="truncate font-semibold">{m.home.name}</span>
                </div>
                <div className="shrink-0 font-display text-xl text-primary tabular-nums">
                  {m.result!.home} x {m.result!.away}
                </div>
                <div className="flex min-w-0 items-center justify-end gap-2">
                  <span className="truncate text-right font-semibold">{m.away.name}</span>
                  <span className="text-xl">{m.away.flag}</span>
                </div>
              </div>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                {pred ? `Seu palpite: ${pred.home} x ${pred.away}` : "Sem palpite"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
