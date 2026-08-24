/**
 * MQTT transport.
 *
 * The browser cannot open a raw 1883 socket, so this speaks MQTT over
 * WebSockets. Mosquitto does NOT enable a websocket listener by default — the
 * Home Assistant add-on exposes 1883 and 8883 only — so the add-on's Mosquitto
 * config needs an explicit listener. That is a deployment prerequisite and the
 * app says so out loud rather than failing with a bare "connection refused".
 *
 * Payloads in the wild are inconsistent. An ESPHome sensor publishes a bare
 * number as text; Home Assistant's MQTT discovery publishes JSON; some firmwares
 * nest the value. parsePayload handles all three rather than assuming one.
 */

import mqtt, { type MqttClient } from "mqtt";

export interface MqttConfig {
  /** e.g. ws://192.168.1.143:1884 — Mosquitto's websocket listener */
  url: string;
  username?: string;
  password?: string;
}

export type ConnState = "idle" | "connecting" | "connected" | "error" | "closed";

export interface Incoming {
  topic: string;
  celsius: number;
  at: number;
}

/**
 * Pull a temperature out of whatever the device felt like publishing.
 * Returns undefined rather than NaN so a malformed message is dropped, not
 * charted as a spike at zero.
 */
export function parsePayload(raw: string): number | undefined {
  const text = raw.trim();
  if (!text) return undefined;

  const bare = Number(text);
  if (Number.isFinite(bare)) return bare;

  try {
    const j: unknown = JSON.parse(text);
    if (typeof j === "number" && Number.isFinite(j)) return j;
    if (typeof j === "object" && j !== null) {
      const o = j as Record<string, unknown>;
      for (const k of ["temperature", "temp", "value", "state", "celsius", "c"]) {
        const v = o[k];
        if (typeof v === "number" && Number.isFinite(v)) return v;
        if (typeof v === "string") {
          const n = Number(v);
          if (Number.isFinite(n)) return n;
        }
      }
    }
  } catch {
    /* not JSON — fall through */
  }
  return undefined;
}

export interface Bus {
  state: ConnState;
  error?: string;
  disconnect(): void;
  setTopics(topics: string[]): void;
}

export function connect(
  cfg: MqttConfig,
  topics: string[],
  onSample: (s: Incoming) => void,
  onState: (s: ConnState, err?: string) => void,
): Bus {
  let client: MqttClient | undefined;
  let current = new Set(topics.filter(Boolean));
  let state: ConnState = "connecting";

  const set = (s: ConnState, e?: string) => {
    state = s;
    onState(s, e);
  };

  set("connecting");
  try {
    client = mqtt.connect(cfg.url, {
      username: cfg.username || undefined,
      password: cfg.password || undefined,
      reconnectPeriod: 5_000,
      connectTimeout: 10_000,
      clean: true,
      clientId: `fermenta-${Math.random().toString(16).slice(2, 10)}`,
    });
  } catch (e) {
    set("error", String(e));
    return { state, disconnect() {}, setTopics() {} };
  }

  client.on("connect", () => {
    set("connected");
    for (const t of current) client!.subscribe(t, { qos: 0 });
  });

  client.on("message", (topic: string, payload: Uint8Array) => {
    const c = parsePayload(new TextDecoder().decode(payload));
    if (c === undefined) return;
    // A probe reading -50 or 200 is a sensor fault, not a fermentation.
    if (c < -30 || c > 120) return;
    onSample({ topic, celsius: c, at: Date.now() });
  });

  client.on("error", (e: Error) => set("error", e.message));
  client.on("close", () => { if (state !== "error") set("closed"); });
  client.on("reconnect", () => set("connecting"));

  return {
    get state() { return state; },
    disconnect() {
      try { client?.end(true); } catch { /* already gone */ }
      set("idle");
    },
    setTopics(next: string[]) {
      const wanted = new Set(next.filter(Boolean));
      if (!client?.connected) { current = wanted; return; }
      for (const t of current) if (!wanted.has(t)) client.unsubscribe(t);
      for (const t of wanted) if (!current.has(t)) client.subscribe(t, { qos: 0 });
      current = wanted;
    },
  };
}
