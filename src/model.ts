/**
 * Fermenta domain model.
 *
 * The organising fact: readings arrive from two different worlds and must never
 * be drawn as if they were the same kind of data.
 *
 *   MACHINE  temperature, every ~60s, unattended, dense, arrives whether or not
 *            anyone is paying attention. Drawn as a continuous hairline.
 *   HUMAN    gravity and pH, requires a hydrometer and a decision to take one,
 *            sparse and irregular. Drawn as discrete marks, never interpolated
 *            into a smooth curve — a line between two gravity points is a lie
 *            about measurements nobody made.
 */

export type Stage = "pitched" | "primary" | "secondary" | "conditioning" | "packaged";

export const STAGES: Stage[] = ["pitched", "primary", "secondary", "conditioning", "packaged"];

/** Where a value came from. Drives how it is drawn, and whether it can go stale. */
export type Origin = "machine" | "human";

export interface TempSample {
  t: number; // epoch ms
  c: number; // celsius
}

export interface ManualReading {
  t: number;
  /** specific gravity, e.g. 1.048 */
  sg?: number;
  ph?: number;
  note?: string;
}

export interface Batch {
  id: string;
  name: string;
  /** short code, e.g. "0042" — what is written on the tape on the vessel */
  code: string;
  style: string;
  vessel: string;
  stage: Stage;
  pitchedAt: number;
  /** original gravity, taken at pitch */
  og?: number;
  /** MQTT topic this vessel's probe publishes to */
  topic: string;
  /** target fermentation band, celsius — an excursion is leaving this */
  targetC: [number, number];
  readings: ManualReading[];
  temps: TempSample[];
  recipe?: string;
  tasting?: string;
  archived?: boolean;
}

/** ABV from original and final/current gravity. Standard homebrew approximation. */
export function abv(og?: number, sg?: number): number | undefined {
  if (og === undefined || sg === undefined || og <= sg) return undefined;
  return (og - sg) * 131.25;
}

/** Apparent attenuation: how much of the sugar the yeast has actually taken. */
export function attenuation(og?: number, sg?: number): number | undefined {
  if (og === undefined || sg === undefined || og <= 1) return undefined;
  return ((og - sg) / (og - 1)) * 100;
}

export const latestReading = (b: Batch): ManualReading | undefined =>
  b.readings.length ? b.readings[b.readings.length - 1] : undefined;

export const latestSg = (b: Batch): number | undefined => {
  for (let i = b.readings.length - 1; i >= 0; i--) {
    if (b.readings[i].sg !== undefined) return b.readings[i].sg;
  }
  return b.og;
};

export const latestTemp = (b: Batch): TempSample | undefined =>
  b.temps.length ? b.temps[b.temps.length - 1] : undefined;

/**
 * How old the newest machine sample is. This is the number that decides whether
 * the trace is drawn solid, dashed, or half-height — the honesty mechanism.
 */
export function tempAgeMs(b: Batch, now = Date.now()): number | undefined {
  const last = latestTemp(b);
  return last ? now - last.t : undefined;
}

export type FeedState = "live" | "stale" | "dead" | "never";

/** Thresholds are generous: a 60s publish interval should not read as stale. */
export function feedState(b: Batch, now = Date.now()): FeedState {
  const age = tempAgeMs(b, now);
  if (age === undefined) return "never";
  if (age < 3 * 60_000) return "live";
  if (age < 30 * 60_000) return "stale";
  return "dead";
}

export interface Verdict {
  /** what the brewer needs to know in three words or fewer */
  label: string;
  /** the emission wavelength that carries it */
  band: 546 | 589 | 615 | 656 | 486;
  detail: string;
}

/**
 * The single judgement the whole app exists to make: is this batch behaving?
 *
 * Ordered by severity, and deliberately conservative — a false "drifting" that
 * sends the brewer to the fermenter is cheap; a missed excursion is a ruined
 * batch. Note that a dead feed is reported as unknown, never as fine: absence of
 * a reading is not evidence of a healthy fermentation.
 */
export function verdict(b: Batch, now = Date.now()): Verdict {
  if (b.stage === "packaged") return { label: "packaged", band: 486, detail: "no longer fermenting" };

  const fs = feedState(b, now);
  if (fs === "never") return { label: "no probe", band: 615, detail: "no sample has ever arrived on this topic" };
  if (fs === "dead") return { label: "feed lost", band: 656, detail: "no sample in over 30 minutes — the reading below is not current" };

  const last = latestTemp(b)!;
  const [lo, hi] = b.targetC;
  if (last.c > hi) return { label: "too warm", band: 656, detail: `${last.c.toFixed(1)}°C is above the ${hi}°C ceiling` };
  if (last.c < lo) return { label: "too cold", band: 615, detail: `${last.c.toFixed(1)}°C is below the ${lo}°C floor` };

  // Stall detection: gravity has not moved meaningfully in 72h during an active
  // primary. Only claimed when there ARE two readings far enough apart to judge.
  if (b.stage === "primary") {
    const withSg = b.readings.filter((r) => r.sg !== undefined);
    if (withSg.length >= 2) {
      const a = withSg[withSg.length - 2];
      const z = withSg[withSg.length - 1];
      const hours = (z.t - a.t) / 3_600_000;
      if (hours >= 48 && Math.abs((a.sg ?? 0) - (z.sg ?? 0)) < 0.002 && (z.sg ?? 1) > 1.02) {
        return { label: "possible stall", band: 589, detail: `gravity moved less than 0.002 in ${Math.round(hours)}h` };
      }
    }
  }
  if (fs === "stale") return { label: "feed quiet", band: 589, detail: "last sample is a few minutes old" };
  return { label: "in band", band: 546, detail: `${last.c.toFixed(1)}°C, inside ${lo}–${hi}°C` };
}

export const EMISSION: Record<number, string> = {
  405: "#8b5cf6",
  436: "#4f7dff",
  486: "#22d3ee",
  546: "#4ade80",
  589: "#fbbf24",
  615: "#fb7185",
  656: "#ef4444",
};

export const uid = (): string =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
