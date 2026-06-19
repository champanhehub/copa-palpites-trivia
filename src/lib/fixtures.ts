// World Cup group stage fixtures + trivia bank.
// Dates anchored around the current week so there's always "jogos de hoje".

export type Match = {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm local
  group: string;
  home: { name: string; flag: string };
  away: { name: string; flag: string };
  result?: { home: number; away: number }; // filled when match ends
};

export type TriviaQuestion = {
  id: string;
  date: string; // YYYY-MM-DD — one per day
  question: string;
  options: string[];
  answerIndex: number;
};

// Anchor: today (sandbox date 2026-06-19). Schedule covers ~10 days.
const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

export const MATCHES: Match[] = [
  // Day -2 (results in)
  { id: "m1", date: day(-2), time: "13:00", group: "A",
    home: { name: "Brasil", flag: "🇧🇷" }, away: { name: "Sérvia", flag: "🇷🇸" },
    result: { home: 2, away: 0 } },
  { id: "m2", date: day(-2), time: "16:00", group: "A",
    home: { name: "Suíça", flag: "🇨🇭" }, away: { name: "Camarões", flag: "🇨🇲" },
    result: { home: 1, away: 0 } },

  // Day -1
  { id: "m3", date: day(-1), time: "13:00", group: "B",
    home: { name: "Argentina", flag: "🇦🇷" }, away: { name: "México", flag: "🇲🇽" },
    result: { home: 2, away: 1 } },
  { id: "m4", date: day(-1), time: "16:00", group: "B",
    home: { name: "Polônia", flag: "🇵🇱" }, away: { name: "Arábia Saudita", flag: "🇸🇦" },
    result: { home: 2, away: 0 } },

  // Today
  { id: "m5", date: day(0), time: "13:00", group: "C",
    home: { name: "França", flag: "🇫🇷" }, away: { name: "Dinamarca", flag: "🇩🇰" } },
  { id: "m6", date: day(0), time: "16:00", group: "C",
    home: { name: "Tunísia", flag: "🇹🇳" }, away: { name: "Austrália", flag: "🇦🇺" } },
  { id: "m7", date: day(0), time: "19:00", group: "D",
    home: { name: "Espanha", flag: "🇪🇸" }, away: { name: "Alemanha", flag: "🇩🇪" } },

  // +1
  { id: "m8", date: day(1), time: "13:00", group: "D",
    home: { name: "Japão", flag: "🇯🇵" }, away: { name: "Costa Rica", flag: "🇨🇷" } },
  { id: "m9", date: day(1), time: "16:00", group: "E",
    home: { name: "Bélgica", flag: "🇧🇪" }, away: { name: "Marrocos", flag: "🇲🇦" } },

  // +2
  { id: "m10", date: day(2), time: "13:00", group: "E",
    home: { name: "Croácia", flag: "🇭🇷" }, away: { name: "Canadá", flag: "🇨🇦" } },
  { id: "m11", date: day(2), time: "16:00", group: "F",
    home: { name: "Inglaterra", flag: "🏴" }, away: { name: "EUA", flag: "🇺🇸" } },

  // +3
  { id: "m12", date: day(3), time: "13:00", group: "F",
    home: { name: "Holanda", flag: "🇳🇱" }, away: { name: "Equador", flag: "🇪🇨" } },
  { id: "m13", date: day(3), time: "16:00", group: "G",
    home: { name: "Portugal", flag: "🇵🇹" }, away: { name: "Gana", flag: "🇬🇭" } },

  // +4
  { id: "m14", date: day(4), time: "13:00", group: "G",
    home: { name: "Uruguai", flag: "🇺🇾" }, away: { name: "Coreia do Sul", flag: "🇰🇷" } },
  { id: "m15", date: day(4), time: "16:00", group: "H",
    home: { name: "Senegal", flag: "🇸🇳" }, away: { name: "Catar", flag: "🇶🇦" } },

  // +5
  { id: "m16", date: day(5), time: "13:00", group: "H",
    home: { name: "Brasil", flag: "🇧🇷" }, away: { name: "Suíça", flag: "🇨🇭" } },
  { id: "m17", date: day(5), time: "16:00", group: "A",
    home: { name: "Camarões", flag: "🇨🇲" }, away: { name: "Sérvia", flag: "🇷🇸" } },
];

export const TRIVIA: TriviaQuestion[] = [
  { id: "t-2", date: day(-2),
    question: "Quantas Copas do Mundo o Brasil já venceu?",
    options: ["3", "4", "5", "6"], answerIndex: 2 },
  { id: "t-1", date: day(-1),
    question: "Em que ano o Brasil conquistou seu primeiro título mundial?",
    options: ["1950", "1958", "1962", "1970"], answerIndex: 1 },
  { id: "t0", date: day(0),
    question: "Qual jogador é o maior artilheiro da história das Copas?",
    options: ["Pelé", "Ronaldo Fenômeno", "Miroslav Klose", "Messi"], answerIndex: 2 },
  { id: "t1", date: day(1),
    question: "Em que país foi disputada a Copa do Mundo de 2014?",
    options: ["África do Sul", "Brasil", "Rússia", "Catar"], answerIndex: 1 },
  { id: "t2", date: day(2),
    question: "Quem ganhou a Bola de Ouro da Copa de 2022?",
    options: ["Mbappé", "Messi", "Modrić", "Neymar"], answerIndex: 1 },
  { id: "t3", date: day(3),
    question: "Qual seleção venceu a primeira Copa do Mundo, em 1930?",
    options: ["Brasil", "Itália", "Uruguai", "Argentina"], answerIndex: 2 },
  { id: "t4", date: day(4),
    question: "Quantas seleções disputam a fase de grupos da Copa de 2026?",
    options: ["32", "40", "48", "24"], answerIndex: 2 },
  { id: "t5", date: day(5),
    question: "Quem é o maior artilheiro da Seleção Brasileira em Copas?",
    options: ["Pelé", "Ronaldo", "Neymar", "Rivaldo"], answerIndex: 2 },
];
