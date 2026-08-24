/**
 * The trace. Hand-drawn SVG, no chart library.
 *
 * A charting library would give every series the same treatment, and the whole
 * point of this surface is that the two series are not the same kind of thing:
 *
 *   TEMPERATURE  dense, machine, continuous  -> an unbroken hairline whose FORM
 *                carries feed state (solid live / dashed stale / dotted dead)
 *   GRAVITY      sparse, human, discrete     -> standalone marks, NEVER joined
 *                into a curve, because a line between two hydrometer readings
 *                asserts measurements nobody took
 *
 * The target band is drawn as two hairline edges rather than a filled zone: a
 * translucent fill would be the only large colour field on the surface and the
 * world allows colour only as lines.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { Batch, FeedState } from "./model";
import { EMISSION } from "./model";

interface Props {
  batch: Batch;
  feed: FeedState;
  /** hours of history to show */
  windowH: number;
  height?: number;
}

const PAD = { l: 34, r: 38, t: 14, b: 20 };

export default function Trace({ batch, feed, windowH, height = 260 }: Props) {
  const now = Date.now();
  const t0 = now - windowH * 3_600_000;

  const temps = useMemo(
    () => batch.temps.filter((s) => s.t >= t0).sort((a, b) => a.t - b.t),
    [batch.temps, t0],
  );
  const gravities = useMemo(
    () => batch.readings.filter((r) => r.sg !== undefined && r.t >= t0).sort((a, b) => a.t - b.t),
    [batch.readings, t0],
  );

  const [lo, hi] = batch.targetC;
  // Always include the target band in the y-range, so "in band" is visibly
  // in-band even when the trace is flat and far from the edges.
  // Range = the union of (target band, actual data), padded by 1°C. Padding by 2
  // beyond the band pushed a well-behaved trace into the bottom half of the box
  // and left the top third empty — the plot must use the height it is given.
  const cs = temps.map((s) => s.c);
  const yMin = Math.min(lo, ...(cs.length ? cs : [lo])) - 1;
  const yMax = Math.max(hi, ...(cs.length ? cs : [hi])) + 1;
  const span = Math.max(1, yMax - yMin);

  // Measure, do not assume. A fixed 1000-unit viewBox letterboxes badly once the
  // container is narrower than the viewBox: preserveAspectRatio="meet" scales the
  // content to fit the WIDTH and then centres it in the taller box, which on a
  // phone left ~85px of dead space above and below a 91px trace. Rendering at the
  // measured pixel size removes the scale factor entirely — strokes stay 1px and
  // text stays at its stated size at every width.
  const wrap = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState(0);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setMeasured(e.contentRect.width));
    ro.observe(el);
    setMeasured(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  const W = Math.max(320, Math.round(measured) || 720);
  const H = height;
  const px = (t: number) => PAD.l + ((t - t0) / (now - t0)) * (W - PAD.l - PAD.r);
  const py = (c: number) => PAD.t + (1 - (c - yMin) / span) * (H - PAD.t - PAD.b);

  const path = temps.length
    ? temps.map((s, i) => `${i === 0 ? "M" : "L"}${px(s.t).toFixed(1)},${py(s.c).toFixed(1)}`).join("")
    : "";

  // Feed state is carried by line FORM. Colour never encodes it alone — the
  // trace stays 546nm green whether live or dead, so the shape does the work.
  const formClass = feed === "live" ? "" : feed === "stale" ? "line-stale" : "line-pending";
  const traceOpacity = feed === "dead" ? 0.4 : feed === "stale" ? 0.7 : 1;

  const gMin = 1.0;
  const gMax = Math.max(1.09, batch.og ?? 1.06);
  const gy = (sg: number) => PAD.t + (1 - (sg - gMin) / (gMax - gMin)) * (H - PAD.t - PAD.b);

  const hourTicks = useMemo(() => {
    const step = windowH <= 12 ? 2 : windowH <= 48 ? 6 : windowH <= 168 ? 24 : 48;
    const out: number[] = [];
    for (let h = 0; h <= windowH; h += step) out.push(now - (windowH - h) * 3_600_000);
    return out;
  }, [windowH, now]);

  return (
    <figure className="m-0" ref={wrap}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        className="block"
        style={{ maxWidth: "100%" }}
        role="img"
        aria-label={
          temps.length
            ? `Temperature trace, ${temps.length} samples over ${windowH} hours, currently ${temps[temps.length - 1].c.toFixed(1)} degrees celsius, target band ${lo} to ${hi}.`
            : `No temperature samples in the last ${windowH} hours.`
        }
      >
        {/* hour ticks — hairline stubs off the baseline, never a full grid */}
        {hourTicks.map((t, i) => (
          <g key={i}>
            <line x1={px(t)} x2={px(t)} y1={H - PAD.b} y2={H - PAD.b + 4} stroke="#5d5b56" strokeWidth="1" />
            <text x={px(t)} y={H - 4} textAnchor="middle" className="tick-label" fill="#5d5b56" fontSize="9">
              {i === hourTicks.length - 1 ? "now" : `−${Math.round((now - t) / 3_600_000)}h`}
            </text>
          </g>
        ))}

        {/* target band: two hairline edges at 436nm, not a filled zone */}
        {[lo, hi].map((c) => (
          <g key={c}>
            <line
              x1={PAD.l} x2={W - PAD.r} y1={py(c)} y2={py(c)}
              stroke={EMISSION[436]} strokeWidth="1" strokeDasharray="2 6" opacity="0.65"
            />
            <text x={PAD.l - 6} y={py(c) + 3} textAnchor="end" fontSize="9"
                  className="font-num" fill={EMISSION[436]} opacity="0.8">
              {c}
            </text>
          </g>
        ))}

        {/* the dense machine trace — 546nm */}
        {path && (
          <path
            d={path} fill="none" stroke={EMISSION[546]} strokeWidth="1.25"
            strokeLinejoin="round" strokeLinecap="round"
            className={formClass} opacity={traceOpacity}
          />
        )}

        {/* current value: the doubled line at 589nm — what outranks its neighbours */}
        {temps.length > 0 && feed !== "dead" && (
          <g>
            <line
              x1={px(temps[temps.length - 1].t)} x2={W - PAD.r}
              y1={py(temps[temps.length - 1].c)} y2={py(temps[temps.length - 1].c)}
              stroke={EMISSION[589]} strokeWidth="1" opacity="0.9"
            />
            <line
              x1={px(temps[temps.length - 1].t)} x2={W - PAD.r}
              y1={py(temps[temps.length - 1].c) + 2} y2={py(temps[temps.length - 1].c) + 2}
              stroke={EMISSION[589]} strokeWidth="1" opacity="0.45"
            />
            <text
              x={W - PAD.r + 4} y={py(temps[temps.length - 1].c) + 3}
              fontSize="11" className="font-num" fill={EMISSION[589]}
            >
              {temps[temps.length - 1].c.toFixed(1)}
            </text>
          </g>
        )}

        {/* sparse human readings — discrete marks at 486nm, deliberately unjoined */}
        {gravities.map((r) => (
          <g key={r.t}>
            <line
              x1={px(r.t)} x2={px(r.t)} y1={gy(r.sg!) - 5} y2={gy(r.sg!) + 5}
              stroke={EMISSION[486]} strokeWidth="1.5"
            />
            <text x={px(r.t)} y={gy(r.sg!) - 9} textAnchor="middle" fontSize="9"
                  className="font-num" fill={EMISSION[486]}>
              {r.sg!.toFixed(3)}
            </text>
          </g>
        ))}

        {temps.length === 0 && (
          <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="11"
                className="tick-label" fill="#5d5b56">
            no samples in this window
          </text>
        )}
      </svg>

      <figcaption className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1 px-1 tick-label">
        <span className="flex items-center gap-1.5">
          <svg width="16" height="6" aria-hidden="true"><line x1="0" y1="3" x2="16" y2="3" stroke={EMISSION[546]} strokeWidth="1.25" /></svg>
          temperature · machine · {temps.length} samples
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="10" height="10" aria-hidden="true"><line x1="5" y1="0" x2="5" y2="10" stroke={EMISSION[486]} strokeWidth="1.5" /></svg>
          gravity · logged by hand · not interpolated
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="16" height="6" aria-hidden="true"><line x1="0" y1="3" x2="16" y2="3" stroke={EMISSION[436]} strokeWidth="1" strokeDasharray="2 4" /></svg>
          target {lo}–{hi}°C
        </span>
      </figcaption>
    </figure>
  );
}
