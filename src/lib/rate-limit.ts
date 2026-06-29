const windows = new Map<string, number[]>();
const WINDOW_MS = 60_000;

export function assertRateLimit(key: string, max: number): void {
  const now = Date.now();
  const hits = (windows.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= max) {
    throw new Error("Muitas tentativas. Aguarde um momento e tente novamente.");
  }
  hits.push(now);
  windows.set(key, hits);
}
