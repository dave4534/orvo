// Best-effort limits kept in memory. A single request to the assistant can take several round trips (one per screen action), so the limit is generous. On a serverless host each instance counts for itself,
// so the spend limit on the API workspace is the hard cap and this only slows down abuse.
const hits = new Map<string, number[]>();
let day = "";
let dayCount = 0;

export function checkRateLimit(key: string, max = 150, windowMs = 10 * 60_000, dailyMax = 2500): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    dayCount = 0;
  }
  if (dayCount >= dailyMax) return { ok: false, retryAfterSeconds: 3600 };

  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) return { ok: false, retryAfterSeconds: Math.ceil((windowMs - (now - recent[0])) / 1000) };

  recent.push(now);
  hits.set(key, recent);
  dayCount += 1;
  if (hits.size > 2000) for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
  return { ok: true };
}
