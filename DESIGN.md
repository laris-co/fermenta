# Design

Written at finish, from the built world.

## Direction

**Emission-line rail.** Dealt as a challenger against grounded candidate 4 (a brewer's
ledger) and won on both axes — audience identification and product clarity. Seed key
`9c2ceda8`, scope `direction`, mode `operate`.

It won on product clarity for a concrete reason: `PRODUCT.md` requires that stale data be
visibly stale, and this world encodes state as **line form** (solid / dashed / half-height /
struck) rather than hue. That requirement is satisfied natively instead of bolted on as a
badge. It won on audience identification because the user runs ESPHome and MQTT — a
spectrograph reads truer to him than a paper ledger, and the brief asked for "a precision
instrument, not a generic CRUD dashboard".

## Colour

Strategy: **restrained**, and unusually strict — the surface is a banded charcoal continuum
with bone text, and colour exists *only* as hairlines. No filled swatches, no tinted panels,
no coloured buttons. A translucent "target zone" fill was rejected for this reason and drawn
as two hairline edges instead.

Wavelengths are real, and each owns one meaning:

| nm | hex | carries |
|---|---|---|
| 405 | `#8b5cf6` | pH |
| 436 | `#4f7dff` | target band edges, elapsed |
| 486 | `#22d3ee` | gravity — the human series |
| 546 | `#4ade80` | temperature — the machine series, and "in band" |
| 589 | `#fbbf24` | **the doubled line** — current value, active control, "attention" |
| 615 | `#fb7185` | below-band, no probe |
| 656 | `#ef4444` | above-band, feed lost |

589 is the sodium pair: where it appears it is drawn as *two* lines, and it outranks its
neighbours. It marks the current reading and the primary action, nothing else.

Dark ground is not a default here — one sentence of scene forced it: a brewer checks a
fermenter in a dim room, at night, often one-handed on a phone.

## Type

One grotesque (Roboto Condensed) at essentially one size, ranked by **tracking and ink**
rather than scale. Labels are 10px uppercase at `0.18em`; values are Roboto Mono, which is
doing real work — figures must align in columns and a monospace tabular figure is a
functional choice, not a style one.

No display face. An Operate surface at 3am does not need a personality in its headings.

## Structure

Everything hangs off one off-centre rail pinned left (15rem), a drawer below `lg`. Each
vessel is a **tick** on that rail whose length and weight encode state; the open one blooms
into a full plate to its right. Nothing leaves the rail.

## Components

- **Actions** are hairline-ruled, never filled — a solid button would be a colour field, and
  the world forbids fields.
- **The trace** is hand-drawn SVG, no chart library. A library would give both series the
  same treatment, and their difference is the entire point.
- **Sizing is measured, not assumed.** The SVG renders at its container's true pixel width
  via ResizeObserver. A fixed 1000-unit viewBox letterboxed badly on a phone — `meet` scaled
  the content to the width, then centred a 91px trace inside a 260px box.

## Verified

- Direction contract survives the production build (grep `9c2ceda8` in `dist/index.html`).
- `tsc -b` clean; mechanical detector returns no findings — though it ran **degraded**
  (HTML parser modules unavailable), so that is an undercount, not a clean bill of health.
- Stale-state encoding confirmed live: seeded data aged past the 3-minute threshold during
  inspection and the trace switched to dashed with the 589nm verdict, unprompted.

## Not verified

- **No true desktop screenshot.** The inspection browser would not exceed ~700 CSS px;
  `setDeviceMetricsOverride` reported 1440 while the page saw 720. The rail's desktop
  behaviour is verified by measurement (`railX: -240` below `lg`, classes emitted, breakpoint
  1024px) rather than by eye. First round of inspection nearly "fixed" a working rail on the
  strength of that bad screenshot.
- No live MQTT broker has published to it yet — the sensor path is untested end to end
  because no probe is flashed.
