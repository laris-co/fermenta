import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Trace from "./Trace";
import {
  EMISSION, STAGES, abv, attenuation, feedState, latestSg, latestTemp,
  tempAgeMs, verdict, type Batch, type Stage,
} from "./model";
import { connect, type Bus, type ConnState } from "./mqtt";
import { isConfigured, load, loadCfg, save, saveCfg, seedBatch, thin } from "./store";

/* ── small shared pieces ─────────────────────────────────────────────────── */

const Label = ({ children }: { children: React.ReactNode }) => (
  <div className="tick-label mb-1">{children}</div>
);

function Field(props: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; inputMode?: "decimal" | "text"; hint?: string;
}) {
  return (
    <label className="block">
      <Label>{props.label}</Label>
      <input
        type={props.type ?? "text"}
        inputMode={props.inputMode}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
        className="w-full border-0 border-b border-bone-faint/40 bg-transparent px-0 py-1.5
                   font-num text-[13px] text-bone placeholder:text-bone-faint/60
                   focus:border-em-589 focus:outline-none focus:ring-0"
      />
      {props.hint && <div className="tick-label mt-1 normal-case tracking-normal">{props.hint}</div>}
    </label>
  );
}

/** Actions are hairline-ruled, never filled — a solid button would be a colour field. */
function Action({
  children, onClick, tone = "bone", type = "button", disabled,
}: {
  children: React.ReactNode; onClick?: () => void;
  tone?: "bone" | "signal" | "danger"; type?: "button" | "submit"; disabled?: boolean;
}) {
  const c = tone === "signal" ? EMISSION[589] : tone === "danger" ? EMISSION[656] : "#e6e3dc";
  return (
    <button
      type={type} onClick={onClick} disabled={disabled}
      className="tick-label border px-3 py-2 transition-colors disabled:opacity-35
                 hover:bg-white/[0.04] active:bg-white/[0.07]"
      style={{ borderColor: `${c}66`, color: c }}
    >
      {children}
    </button>
  );
}

/* ── the rail ────────────────────────────────────────────────────────────── */

function Rail({
  batches, openId, onOpen, onNew, conn,
}: {
  batches: Batch[]; openId?: string; onOpen: (id: string) => void;
  onNew: () => void; conn: ConnState;
}) {
  const now = Date.now();
  // "not configured" is not a fault — it gets the neutral band, not the red one.
  const connBand =
    conn === "connected" ? EMISSION[546]
    : conn === "connecting" ? EMISSION[589]
    : conn === "unconfigured" ? EMISSION[436]
    : EMISSION[656];
  const connLabel =
    conn === "connected" ? "mqtt live"
    : conn === "connecting" ? "mqtt connecting"
    : conn === "unconfigured" ? "mqtt not set up"
    : `mqtt ${conn}`;

  return (
    <nav className="flex h-full flex-col" aria-label="Vessels">
      <div className="px-5 pt-5">
        <div className="flex items-baseline gap-3">
          <h1 className="font-grot text-[13px] uppercase tracking-rail text-bone">Fermenta</h1>
          <span className="tick-label">{batches.length} vessel{batches.length === 1 ? "" : "s"}</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <svg width="14" height="8" aria-hidden="true">
            <line x1="0" y1="4" x2="14" y2="4" stroke={connBand} strokeWidth="1.5"
                  strokeDasharray={conn === "connected" ? undefined : "3 3"} />
          </svg>
          <span className="tick-label" style={{ color: connBand }}>{connLabel}</span>
        </div>
      </div>

      {/* the rail itself — every vessel is a tick on one continuous line */}
      <div className="relative mt-5 flex-1 overflow-y-auto">
        <div className="absolute bottom-0 left-5 top-0 w-px bg-bone-faint/25" aria-hidden="true" />
        <ul className="space-y-0.5 pb-6">
          {batches.map((b) => {
            const v = verdict(b, now);
            const open = b.id === openId;
            const t = latestTemp(b);
            return (
              <li key={b.id}>
                <button
                  onClick={() => onOpen(b.id)}
                  aria-current={open ? "true" : undefined}
                  className={`group relative w-full py-2.5 pl-5 pr-4 text-left transition-colors
                             ${open ? "bg-white/[0.05]" : "hover:bg-white/[0.025]"}`}
                >
                  {/* the tick: length and weight encode state, colour names it */}
                  <span
                    className="absolute left-5 top-1/2 -translate-y-1/2"
                    style={{
                      width: open ? 18 : 10,
                      height: open ? 2 : 1,
                      background: EMISSION[v.band],
                      opacity: b.stage === "packaged" ? 0.4 : 1,
                    }}
                    aria-hidden="true"
                  />
                  <div className="ml-6">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={`font-grot text-[12px] tracking-plate ${open ? "text-bone" : "text-bone/85"}`}>
                        {b.name}
                      </span>
                      <span className="font-num text-[11px] text-bone-dim">
                        {t ? `${t.c.toFixed(1)}°` : "—"}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-baseline gap-2">
                      <span className="tick-label">{b.vessel} · {b.code}</span>
                      <span className="tick-label" style={{ color: EMISSION[v.band] }}>{v.label}</span>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="border-t border-bone-faint/15 p-4">
        <Action onClick={onNew} tone="signal">+ new batch</Action>
      </div>
    </nav>
  );
}

/* ── the plate ───────────────────────────────────────────────────────────── */

function Plate({
  batch, onPatch, onDelete,
}: {
  batch: Batch; onPatch: (p: Partial<Batch>) => void; onDelete: () => void;
}) {
  const [windowH, setWindowH] = useState(48);
  const [sg, setSg] = useState("");
  const [ph, setPh] = useState("");
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);

  const now = Date.now();
  const v = verdict(batch, now);
  const fs = feedState(batch, now);
  const age = tempAgeMs(batch, now);
  const cur = latestSg(batch);
  const a = abv(batch.og, cur);
  const att = attenuation(batch.og, cur);
  const hours = Math.max(0, Math.round((now - batch.pitchedAt) / 3_600_000));

  const logReading = () => {
    const s = Number(sg), p = Number(ph);
    const r = {
      t: Date.now(),
      sg: sg.trim() && Number.isFinite(s) ? s : undefined,
      ph: ph.trim() && Number.isFinite(p) ? p : undefined,
      note: note.trim() || undefined,
    };
    if (r.sg === undefined && r.ph === undefined && !r.note) return;
    onPatch({ readings: [...batch.readings, r] });
    setSg(""); setPh(""); setNote("");
  };

  return (
    <div className="mx-auto max-w-4xl px-5 py-6 sm:px-8">
      <header className="mb-6">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="font-grot text-[15px] tracking-plate text-bone">{batch.name}</h2>
          <span className="tick-label">{batch.vessel} · batch {batch.code}</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <svg width="22" height="8" aria-hidden="true">
            <line x1="0" y1="3" x2="22" y2="3" stroke={EMISSION[v.band]} strokeWidth="1.5" />
            <line x1="0" y1="5.5" x2="22" y2="5.5" stroke={EMISSION[v.band]} strokeWidth="1" opacity="0.5" />
          </svg>
          <span className="font-grot text-[12px] tracking-plate" style={{ color: EMISSION[v.band] }}>
            {v.label}
          </span>
          <span className="tick-label normal-case tracking-normal">— {v.detail}</span>
        </div>
      </header>

      {/* readings, ranked by ink not size */}
      <dl className="mb-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        {[
          { k: "temperature", val: latestTemp(batch) ? `${latestTemp(batch)!.c.toFixed(1)}°C` : "—",
            sub: age === undefined ? "never" : age < 90_000 ? "just now" : `${Math.round(age / 60_000)}m ago`,
            band: fs === "live" ? 546 : fs === "stale" ? 589 : 656 },
          { k: "gravity", val: cur !== undefined ? cur.toFixed(3) : "—",
            sub: batch.og !== undefined ? `og ${batch.og.toFixed(3)}` : "og not set", band: 486 },
          { k: "abv", val: a !== undefined ? `${a.toFixed(1)}%` : "—",
            sub: att !== undefined ? `${att.toFixed(0)}% attenuated` : "needs og + sg", band: 486 },
          { k: "elapsed", val: hours < 48 ? `${hours}h` : `${Math.floor(hours / 24)}d`,
            sub: new Date(batch.pitchedAt).toLocaleDateString(), band: 436 },
        ].map((m) => (
          <div key={m.k}>
            <dt className="tick-label">{m.k}</dt>
            <dd className="mt-1 font-num text-[19px] leading-none" style={{ color: EMISSION[m.band] }}>
              {m.val}
            </dd>
            <dd className="tick-label mt-1 normal-case tracking-normal">{m.sub}</dd>
          </div>
        ))}
      </dl>

      {/* the chart */}
      <section className="plate mb-6 border border-bone-faint/20 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <Label>trace</Label>
          <div className="flex gap-1">
            {[12, 48, 168, 720].map((h) => (
              <button
                key={h} onClick={() => setWindowH(h)}
                className={`tick-label border px-2 py-1 transition-colors
                  ${windowH === h ? "border-em-589/70 text-em-589" : "border-bone-faint/30 text-bone-dim hover:text-bone"}`}
              >
                {h < 168 ? `${h}h` : `${h / 24}d`}
              </button>
            ))}
          </div>
        </div>
        <Trace batch={batch} feed={fs} windowH={windowH} />
        {fs !== "live" && (
          <p className="tick-label mt-3 normal-case tracking-normal" style={{ color: EMISSION[fs === "stale" ? 589 : 656] }}>
            {fs === "never"
              ? `Nothing has ever arrived on ${batch.topic}. Check the topic and that Mosquitto has a websocket listener.`
              : `The trace is drawn ${fs === "stale" ? "dashed" : "dotted"} because the feed is ${fs}. The last value shown is real but not current.`}
          </p>
        )}
      </section>

      {/* ACTION: log a reading */}
      <section className="plate mb-6 border border-bone-faint/20 p-4">
        <Label>log a reading</Label>
        <p className="tick-label mb-4 normal-case tracking-normal">
          Temperature arrives on its own. Gravity and pH need you and a hydrometer.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="specific gravity" value={sg} onChange={setSg} placeholder="1.019" inputMode="decimal" />
          <Field label="pH" value={ph} onChange={setPh} placeholder="4.3" inputMode="decimal" />
          <Field label="note" value={note} onChange={setNote} placeholder="krausen dropped" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Action onClick={logReading} tone="signal" disabled={!sg.trim() && !ph.trim() && !note.trim()}>
            record reading
          </Action>
          {batch.og === undefined && sg.trim() && (
            <Action onClick={() => { const n = Number(sg); if (Number.isFinite(n)) onPatch({ og: n }); setSg(""); }}>
              set as original gravity
            </Action>
          )}
        </div>
      </section>

      {/* ACTION: advance the stage */}
      <section className="mb-6">
        <Label>stage</Label>
        <div className="flex flex-wrap gap-1.5">
          {STAGES.map((s) => {
            const active = batch.stage === s;
            const past = STAGES.indexOf(s) < STAGES.indexOf(batch.stage);
            return (
              <button
                key={s} onClick={() => onPatch({ stage: s as Stage })}
                aria-pressed={active}
                className={`tick-label border px-3 py-2 transition-colors
                  ${active ? "border-em-589 text-em-589"
                           : past ? "border-bone-faint/40 text-bone-dim"
                                  : "border-bone-faint/20 text-bone-faint hover:text-bone-dim"}`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </section>

      {/* history */}
      {batch.readings.length > 0 && (
        <section className="mb-6">
          <Label>reading history</Label>
          <ul className="divide-y divide-bone-faint/10 border-y border-bone-faint/15">
            {[...batch.readings].reverse().map((r) => (
              <li key={r.t} className="flex flex-wrap items-baseline gap-x-4 py-2">
                <span className="tick-label w-32 shrink-0">
                  {new Date(r.t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
                {r.sg !== undefined && <span className="font-num text-[12px]" style={{ color: EMISSION[486] }}>sg {r.sg.toFixed(3)}</span>}
                {r.ph !== undefined && <span className="font-num text-[12px]" style={{ color: EMISSION[405] }}>pH {r.ph.toFixed(1)}</span>}
                {r.note && <span className="text-[12px] text-bone-dim">{r.note}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ACTION: edit the batch */}
      <section>
        <button onClick={() => setEditing((e) => !e)} className="tick-label text-bone-dim hover:text-bone">
          {editing ? "− close settings" : "+ batch settings"}
        </button>
        {editing && (
          <div className="mt-4 grid grid-cols-1 gap-4 border-t border-bone-faint/15 pt-4 sm:grid-cols-2">
            <Field label="name" value={batch.name} onChange={(v) => onPatch({ name: v })} />
            <Field label="style" value={batch.style} onChange={(v) => onPatch({ style: v })} placeholder="saison" />
            <Field label="vessel" value={batch.vessel} onChange={(v) => onPatch({ vessel: v })} />
            <Field label="batch code" value={batch.code} onChange={(v) => onPatch({ code: v })} />
            <Field
              label="mqtt topic" value={batch.topic} onChange={(v) => onPatch({ topic: v })}
              hint="The topic this vessel's probe publishes temperature to. Wildcards are not resolved — give the exact topic."
            />
            <div className="grid grid-cols-2 gap-3">
              <Field label="target min °C" value={String(batch.targetC[0])} inputMode="decimal"
                     onChange={(v) => { const n = Number(v); if (Number.isFinite(n)) onPatch({ targetC: [n, batch.targetC[1]] }); }} />
              <Field label="target max °C" value={String(batch.targetC[1])} inputMode="decimal"
                     onChange={(v) => { const n = Number(v); if (Number.isFinite(n)) onPatch({ targetC: [batch.targetC[0], n] }); }} />
            </div>
            <label className="block sm:col-span-2">
              <Label>recipe</Label>
              <textarea
                value={batch.recipe ?? ""} onChange={(e) => onPatch({ recipe: e.target.value })}
                rows={3}
                className="w-full resize-y border border-bone-faint/30 bg-transparent p-2 font-num text-[12px]
                           text-bone placeholder:text-bone-faint/60 focus:border-em-589 focus:outline-none"
                placeholder="grain bill, hops, yeast, mash schedule"
              />
            </label>
            <label className="block sm:col-span-2">
              <Label>tasting notes</Label>
              <textarea
                value={batch.tasting ?? ""} onChange={(e) => onPatch({ tasting: e.target.value })}
                rows={2}
                className="w-full resize-y border border-bone-faint/30 bg-transparent p-2 font-num text-[12px]
                           text-bone placeholder:text-bone-faint/60 focus:border-em-589 focus:outline-none"
              />
            </label>
            <div className="sm:col-span-2">
              <Action onClick={onDelete} tone="danger">delete this batch</Action>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/* ── settings ────────────────────────────────────────────────────────────── */

function Settings({
  cfg, onSave, onClose, conn, err,
}: {
  cfg: { url: string; username: string; password: string };
  onSave: (c: { url: string; username: string; password: string }) => void;
  onClose: () => void; conn: ConnState; err?: string;
}) {
  const [url, setUrl] = useState(cfg.url);
  const [u, setU] = useState(cfg.username);
  const [p, setP] = useState(cfg.password);
  return (
    <div className="mx-auto max-w-2xl px-5 py-6 sm:px-8">
      <h2 className="mb-1 font-grot text-[13px] uppercase tracking-rail">MQTT</h2>
      <p className="tick-label mb-6 normal-case tracking-normal">
        A browser cannot open a raw 1883 socket. Mosquitto needs a <em>websocket</em> listener,
        which the Home Assistant add-on does not enable by default — add one to its config
        (commonly port 1884) or nothing will ever arrive here.
      </p>
      <div className="space-y-5">
        <Field label="broker url" value={url} onChange={setUrl} placeholder="ws://192.168.1.143:1884"
               hint="ws:// on the LAN, wss:// if you have TLS. Not mqtt://." />
        <div className="grid grid-cols-2 gap-4">
          <Field label="username" value={u} onChange={setU} />
          <Field label="password" value={p} onChange={setP} type="password" />
        </div>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <Action tone="signal" onClick={() => { onSave({ url, username: u, password: p }); onClose(); }}>
          save and reconnect
        </Action>
        <Action onClick={onClose}>cancel</Action>
        <span className="tick-label" style={{ color: conn === "connected" ? EMISSION[546] : EMISSION[656] }}>
          {conn}{err ? ` — ${err}` : ""}
        </span>
      </div>
    </div>
  );
}

/* ── app ─────────────────────────────────────────────────────────────────── */

export default function App() {
  const [batches, setBatches] = useState<Batch[]>(() => load().batches);
  const [openId, setOpenId] = useState<string | undefined>(() => load().batches[0]?.id);
  const [cfg, setCfg] = useState(loadCfg);
  const [conn, setConn] = useState<ConnState>("idle");
  const [err, setErr] = useState<string>();
  const [showSettings, setShowSettings] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const bus = useRef<Bus>();

  useEffect(() => { save({ batches }); }, [batches]);

  const topics = useMemo(
    () => Array.from(new Set(batches.filter((b) => b.stage !== "packaged").map((b) => b.topic).filter(Boolean))),
    [batches],
  );

  const onSample = useCallback((s: { topic: string; celsius: number; at: number }) => {
    setBatches((prev) =>
      prev.map((b) =>
        b.topic === s.topic
          ? { ...b, temps: thin([...b.temps, { t: s.at, c: s.celsius }]) }
          : b,
      ),
    );
  }, []);

  useEffect(() => {
    bus.current?.disconnect();
    // Attempting a connection with no credentials guarantees CONNACK rc=5 and
    // paints an error over a fresh install. Don't try; say it isn't set up.
    if (!isConfigured(cfg)) { setConn("unconfigured"); setErr(undefined); return; }
    bus.current = connect(cfg, topics, onSample, (s, e) => { setConn(s); setErr(e); });
    return () => bus.current?.disconnect();
    // topics deliberately excluded — resubscription is handled below without a reconnect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg, onSample]);

  useEffect(() => { bus.current?.setTopics(topics); }, [topics]);

  const open = batches.find((b) => b.id === openId);

  const patch = (p: Partial<Batch>) =>
    setBatches((prev) => prev.map((b) => (b.id === openId ? { ...b, ...p } : b)));

  const addBatch = () => {
    const b = seedBatch({ vessel: `FV${batches.length + 1}`, topic: `fermenta/fv${batches.length + 1}/temperature` });
    setBatches((prev) => [...prev, b]);
    setOpenId(b.id);
    setRailOpen(false);
  };

  const del = () => {
    if (!open) return;
    setBatches((prev) => prev.filter((b) => b.id !== open.id));
    setOpenId(batches.find((b) => b.id !== open.id)?.id);
  };

  return (
    <div className="flex h-full">
      {/* the rail — pinned on desktop, a drawer on a phone in a warm room */}
      {/* A rail with no ticks is 15rem of nothing beside a centred empty state.
          With zero vessels there is nothing to navigate, so it collapses and the
          empty state gets the whole surface. */}
      <aside
        className={`fixed inset-y-0 left-0 z-20 w-[15rem] border-r border-bone-faint/15 bg-ash-900/95
                    backdrop-blur transition-transform lg:bg-transparent
                    ${batches.length === 0 ? "lg:hidden" : "lg:static lg:translate-x-0"}
                    ${railOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <Rail
          batches={batches} openId={openId} conn={conn}
          onOpen={(id) => { setOpenId(id); setShowSettings(false); setRailOpen(false); }}
          onNew={addBatch}
        />
      </aside>
      {railOpen && (
        <button className="fixed inset-0 z-10 bg-black/60 lg:hidden" onClick={() => setRailOpen(false)}
                aria-label="Close vessel list" />
      )}

      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3
                        border-b border-bone-faint/15 bg-ash-900/90 px-5 py-2.5 backdrop-blur">
          {batches.length > 0 ? (
            <button className="tick-label text-bone-dim hover:text-bone lg:invisible"
                    onClick={() => setRailOpen(true)}>
              ≡ vessels
            </button>
          ) : <span />}
          <button className="tick-label text-bone-dim hover:text-bone"
                  onClick={() => setShowSettings((s) => !s)}>
            {showSettings ? "close" : "mqtt"}
          </button>
        </div>

        {showSettings ? (
          <Settings cfg={cfg} conn={conn} err={err} onClose={() => setShowSettings(false)}
                    onSave={(c) => { setCfg(c); saveCfg(c); }} />
        ) : open ? (
          <Plate batch={open} onPatch={patch} onDelete={del} />
        ) : (
          <div className="mx-auto max-w-md px-6 py-24 text-center">
            <div className="mx-auto mb-6 h-px w-24" style={{ background: EMISSION[589] }} />
            <h2 className="font-grot text-[13px] uppercase tracking-rail">Nothing fermenting</h2>
            <p className="tick-label mt-3 normal-case tracking-normal">
              Add a vessel and point it at the MQTT topic its probe publishes to. Temperature
              starts drawing itself; gravity is yours to log.
            </p>
            {conn === "unconfigured" && (
              <p className="tick-label mx-auto mt-4 max-w-sm normal-case tracking-normal"
                 style={{ color: EMISSION[436] }}>
                MQTT is not set up yet. The broker authenticates against Home Assistant users,
                so it needs a real HA username and password — there is no useful default.
              </p>
            )}
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Action tone="signal" onClick={addBatch}>+ new batch</Action>
              {conn === "unconfigured" && (
                <Action onClick={() => setShowSettings(true)}>set up mqtt</Action>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
