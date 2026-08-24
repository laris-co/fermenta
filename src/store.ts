/**
 * Persistence.
 *
 * MQTT is the transport, not the database — a browser that was closed overnight
 * missed every sample published while it was gone, and no amount of retained
 * messages brings back a curve. So samples are appended to local storage as they
 * arrive, and the history is only ever as complete as the time this app was open.
 * That is a real limitation and the UI states it rather than implying a gapless
 * record.
 *
 * Sample volume is bounded: one probe at 60s is 1440/day, which localStorage
 * would choke on within weeks. Old samples are thinned rather than dropped, so a
 * long batch keeps its shape at lower resolution instead of losing its start.
 */

import type { Batch, TempSample } from "./model";
import { uid } from "./model";

const KEY = "fermenta.v1";
const CFG = "fermenta.mqtt.v1";

export interface Persisted {
  batches: Batch[];
}

export function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { batches: [] };
    const p = JSON.parse(raw) as Persisted;
    if (!Array.isArray(p.batches)) return { batches: [] };
    return p;
  } catch {
    return { batches: [] };
  }
}

export function save(p: Persisted): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* quota — the thinning below is what keeps this from happening */
  }
}

export function loadCfg(): { url: string; username: string; password: string } {
  try {
    const raw = localStorage.getItem(CFG);
    if (raw) return JSON.parse(raw) as { url: string; username: string; password: string };
  } catch { /* fall through */ }
  // Sensible default for the catlab guest. Port 1884 is the websocket listener
  // that has to be added to Mosquitto's config — 1883 will NOT work from a browser.
  return { url: "ws://192.168.1.143:1884", username: "", password: "" };
}

export function saveCfg(c: { url: string; username: string; password: string }): void {
  try { localStorage.setItem(CFG, JSON.stringify(c)); } catch { /* ignore */ }
}

/**
 * Keep full resolution for the last 24h, then progressively thin.
 * A stall is visible at 15-minute resolution; a temperature spike is not, which
 * is why the recent window stays dense.
 */
export function thin(samples: TempSample[], now = Date.now()): TempSample[] {
  const DAY = 86_400_000;
  const out: TempSample[] = [];
  let lastKept = 0;
  for (const s of samples) {
    const age = now - s.t;
    const minGap = age < DAY ? 0 : age < 7 * DAY ? 900_000 : 3_600_000;
    if (s.t - lastKept >= minGap) {
      out.push(s);
      lastKept = s.t;
    }
  }
  return out;
}

export function seedBatch(partial: Partial<Batch> = {}): Batch {
  return {
    id: uid(),
    name: "Untitled batch",
    code: String(Math.floor(Math.random() * 9000) + 1000),
    style: "",
    vessel: "FV1",
    stage: "pitched",
    pitchedAt: Date.now(),
    topic: "fermenta/fv1/temperature",
    targetC: [18, 21],
    readings: [],
    temps: [],
    ...partial,
  };
}
