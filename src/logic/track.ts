// Client-side instrumentation (PRD 15): console plus an in-memory buffer, exportable for the case study.
export type TrackEvent = { at: number; name: string; data?: Record<string, unknown> };

const buffer: TrackEvent[] = [];

export function track(name: string, data?: Record<string, unknown>) {
  buffer.push({ at: Date.now(), name, data });
  if (typeof console !== "undefined") console.debug(`[orvo] ${name}`, data ?? "");
}

export const trackedEvents = () => [...buffer];
