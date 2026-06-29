import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trophy, LogOut, Users, Calendar, Trash2, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { MATCHES, TRIVIA } from "@/lib/fixtures";
import { playerScore, scoreForMatch, type Player } from "@/lib/store";
import { fetchKnockoutMatches } from "@/lib/api";
import {
  adminLoginFn,
  adminLogoutFn,
  adminGetDataFn,
  adminDeletePlayerFn,
} from "@/lib/server-fns";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Me dá minha Copa!" }] }),
  component: AdminApp,
  ssr: false,
});

const ADMIN_SESSION_KEY = "copa-admin-session-v1";

function getAdminToken(): string | null {
  try { return JSON.parse(localStorage.getItem(ADMIN_SESSION_KEY) ?? "null"); }
  catch { return null; }
}
function setAdminToken(token: string) {
  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(token));
}
function clearAdminToken() {
  localStorage.removeItem(ADMIN_SESSION_KEY);
}

// ── Root ─────────────────────────────────────────────────────────────────────

function AdminApp() {
  const [token, setToken] = useState<string | null>(() => getAdminToken());
  const queryClient = useQueryClient();

  const handleLogin = (t: string) => { setAdminToken(t); setToken(t); };
  const handleLogout = () => {
    if (token) adminLogoutFn({ data: { adminToken: token } });
    clearAdminToken();
    setToken(null);
    queryClient.clear();
  };

  if (!token) return <AdminLogin onLogin={handleLogin} />;
  return <AdminDashboard token={token} onLogout={handleLogout} />;
}

// ── Login ─────────────────────────────────────────────────────────────────────

function AdminLogin({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const login = useMutation({
    mutationFn: (args: { email: string; password: string }) =>
      adminLoginFn({ data: args }),
    onSuccess: ({ token }) => onLogin(token),
    onError: (e: Error) => setErr(e.message || "Credenciais inválidas."),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    login.mutate({ email: email.trim(), password });
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center px-6">
      <div className="mb-6 flex items-center gap-3">
        <ShieldCheck className="h-8 w-8 text-primary" />
        <h1 className="font-display text-3xl text-primary">ADMIN</h1>
      </div>
      <form onSubmit={submit} className="w-full space-y-4 rounded-2xl bg-card p-6 shadow-xl">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">E-mail</label>
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoCapitalize="off"
            className="w-full rounded-xl bg-input px-4 py-3 text-base outline-none ring-primary/60 focus:ring-2"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Senha</label>
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl bg-input px-4 py-3 text-base outline-none ring-primary/60 focus:ring-2"
          />
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <button
          type="submit" disabled={login.isPending}
          className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-60"
        >
          {login.isPending ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

type Tab = "jogadores" | "partidas";

function AdminDashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("jogadores");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-data", token],
    queryFn: () => adminGetDataFn({ data: { adminToken: token } }),
    retry: false,
  });

  if (error) {
    onLogout();
    return null;
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between bg-background/90 px-6 py-4 backdrop-blur-md shadow-sm">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span className="font-display text-xl text-primary">PAINEL ADMIN</span>
        </div>
        <button onClick={onLogout} className="flex items-center gap-1.5 rounded-xl bg-secondary px-3 py-2 text-sm font-semibold">
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 px-6 pt-4">
        {(["jogadores", "partidas"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold capitalize transition ${
              tab === t ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
            }`}
          >
            {t === "jogadores" ? <Users className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
            {t}
          </button>
        ))}
      </div>

      <main className="flex-1 px-6 py-4">
        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">Carregando…</div>
        ) : data && tab === "jogadores" ? (
          <PlayersTab players={data.players} token={token} onDeleted={refetch} />
        ) : data ? (
          <MatchesTab predictionsByMatch={data.predictionsByMatch} />
        ) : null}
      </main>
    </div>
  );
}

// ── Players Tab ───────────────────────────────────────────────────────────────

function PlayerAvatar({ player, className = "h-8 w-8" }: { player: Pick<Player, "name" | "avatarUrl">; className?: string }) {
  const initials = player.name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  return (
    <Avatar className={className}>
      {player.avatarUrl && <AvatarImage src={player.avatarUrl} alt={player.name} />}
      <AvatarFallback className="bg-primary/20 text-primary font-bold text-xs">{initials}</AvatarFallback>
    </Avatar>
  );
}

function PlayersTab({
  players,
  token,
  onDeleted,
}: {
  players: Player[];
  token: string;
  onDeleted: () => void;
}) {
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: knockoutMatches = [] } = useQuery({
    queryKey: ["knockout-matches-admin"],
    queryFn: fetchKnockoutMatches,
    staleTime: 1000 * 60 * 60,
  });
  const allMatches = useMemo(
    () => [...MATCHES, ...knockoutMatches],
    [knockoutMatches],
  );

  const deletePlayer = useMutation({
    mutationFn: (email: string) => adminDeletePlayerFn({ data: { adminToken: token, email } }),
    onSuccess: () => {
      setConfirmEmail(null);
      queryClient.invalidateQueries({ queryKey: ["admin-data"] });
      onDeleted();
    },
  });

  const sorted = [...players]
    .map((p) => ({ p, s: playerScore(p, allMatches) }))
    .sort((a, b) => b.s.total - a.s.total);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{players.length} jogador(es) cadastrado(s)</p>
      {sorted.map(({ p, s }, i) => (
        <div key={p.email} className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow ring-1 ring-border">
          <span className="w-5 shrink-0 text-center text-sm font-bold text-muted-foreground">{i + 1}</span>
          <PlayerAvatar player={p} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{p.name}</p>
            <p className="truncate text-xs text-muted-foreground">{p.email}</p>
            <p className="text-xs text-muted-foreground">
              {Object.keys(p.predictions).length} palpites · {s.matchPts} pts jogos · {s.triviaPts} pts trivia
            </p>
          </div>
          <div className="shrink-0 font-display text-2xl text-primary tabular-nums">{s.total}</div>
          <button
            onClick={() => setConfirmEmail(p.email)}
            className="shrink-0 grid h-8 w-8 place-items-center rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}

      <Dialog open={!!confirmEmail} onOpenChange={() => setConfirmEmail(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover jogador?</DialogTitle>
            <DialogDescription>
              Isso apaga <strong className="text-foreground">{confirmEmail}</strong> e todos os seus palpites permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2">
            <button onClick={() => setConfirmEmail(null)} className="flex-1 rounded-xl bg-secondary py-2.5 text-sm font-semibold">Cancelar</button>
            <button
              disabled={deletePlayer.isPending}
              onClick={() => confirmEmail && deletePlayer.mutate(confirmEmail)}
              className="flex-[2] rounded-xl bg-destructive py-2.5 text-sm font-bold text-destructive-foreground disabled:opacity-60"
            >
              {deletePlayer.isPending ? "Removendo…" : "Remover"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Matches Tab ───────────────────────────────────────────────────────────────

function MatchesTab({
  predictionsByMatch,
}: {
  predictionsByMatch: Record<string, Array<{ email: string; name: string; home: number; away: number }>>;
}) {
  const matchesWithPreds = MATCHES.filter((m) => predictionsByMatch[m.id]?.length);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {matchesWithPreds.length} partida(s) com palpites · {Object.values(predictionsByMatch).flat().length} palpite(s) no total
      </p>

      {MATCHES.map((m) => {
        const preds = predictionsByMatch[m.id] ?? [];
        if (!preds.length && !m.result) return null;
        return (
          <div key={m.id} className="rounded-2xl bg-card shadow ring-1 ring-border overflow-hidden">
            <div className="flex items-center justify-between bg-secondary/60 px-4 py-2 text-xs">
              <span className="font-bold text-primary">Grupo {m.group} · {new Date(m.date + "T12:00:00").toLocaleDateString("pt-BR")}</span>
              {m.result && (
                <span className="font-bold text-foreground">
                  {m.home.name} {m.result.home}×{m.result.away} {m.away.name}
                </span>
              )}
              {!m.result && (
                <span className="text-muted-foreground">{m.home.name} × {m.away.name}</span>
              )}
            </div>
            {preds.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">Sem palpites</p>
            ) : (
              <div className="divide-y divide-border">
                {preds.map((pred) => {
                  const pts = m.result
                    ? scoreForMatch({ matchId: m.id, home: pred.home, away: pred.away, createdAt: 0 }, m)
                    : null;
                  return (
                    <div key={pred.email} className="flex items-center justify-between px-4 py-2 text-sm">
                      <span className="font-medium">{pred.name}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {pred.home} × {pred.away}
                      </span>
                      {pts !== null && (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          pts >= 3 ? "bg-primary text-primary-foreground"
                            : pts > 0 ? "bg-accent text-accent-foreground"
                            : "bg-secondary text-secondary-foreground"
                        }`}>
                          +{pts} pts
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
