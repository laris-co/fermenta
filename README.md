# Fermenta

Fermentation tracking that reads temperature straight off MQTT.

A fermentation is slow and mostly invisible, and the failures that matter — a stall, a
temperature excursion, a runaway exotherm in the first 48 hours — are all visible in the
*shape of a curve* long before they are visible in the beer. Fermenta exists to answer one
question quickly: **is this batch behaving, or is it drifting?**

---

## The idea it is built on

Readings come from two different worlds, and the interface refuses to pretend otherwise.

| | origin | density | drawn as |
|---|---|---|---|
| **temperature** | ESPHome probe → MQTT | every ~60s, unattended | an unbroken hairline |
| **gravity, pH** | you and a hydrometer | sparse, irregular, deliberate | discrete marks, **never joined** |

A line drawn between two hydrometer readings asserts measurements nobody took. So gravity
is plotted as standalone ticks. Only the machine series gets a continuous line, because
only the machine series is continuous.

**Feed state is carried by line form, not colour.** The trace is 546nm green whether it is
live or dead; what changes is the stroke — solid when live, dashed when the feed goes quiet,
dotted and dimmed when it is lost. A dead sensor therefore *looks* dead at a glance, with no
legend to consult, and the app never reports a stale number as if it were current.

A dead feed is reported as **unknown**, never as fine. Absence of a reading is not evidence
of a healthy fermentation.

## What it does

- Batch lifecycle — pitched → primary → secondary → conditioning → packaged
- Live temperature trace per vessel, with a configurable target band
- Manual gravity and pH entry, with derived ABV and apparent attenuation
- Stall detection: flags gravity that has moved less than 0.002 in 48h during primary
- Recipe and tasting notes per batch; history kept after packaging
- Runs as a Home Assistant add-on with a sidebar entry, authenticated by your HA session

## Prerequisite that will bite you

**Mosquitto needs a websocket listener.** A browser cannot open a raw 1883 socket, and the
Home Assistant Mosquitto add-on exposes 1883 and 8883 only. Without an explicit websocket
listener, nothing will ever arrive and the app will sit at "mqtt connecting" forever.

Add one to the Mosquitto add-on's customize config, commonly on port 1884, then point
Fermenta at `ws://<host>:1884`.

Payload format is not assumed: a bare number (`19.4`), a JSON number, or JSON with a
`temperature` / `temp` / `value` / `state` key all parse. Readings outside −30…120 °C are
discarded as sensor faults rather than charted as spikes.

## Honest limitations

- **MQTT is the transport, not the database.** History is only as complete as the time this
  app was open. A browser closed overnight missed every sample published while it was gone,
  and no amount of retained messages brings a curve back.
- Samples are thinned as they age — full resolution for 24h, 15-minute for a week, hourly
  beyond. A long batch keeps its shape at lower resolution rather than losing its start.
- Data lives in browser storage. It is per-device, and clearing site data clears it.
- **No ESPHome fermentation probe is flashed yet**, so the default topic
  (`fermenta/fv1/temperature`) is a placeholder. The topic is configurable per vessel
  precisely because the real one is not known yet.

## Develop

```sh
bun install
bun run dev      # http://localhost:5173
bun run build    # -> dist/
```

## Install as a Home Assistant add-on

The `addon/` directory holds `config.yaml`, a Dockerfile that builds the bundle and serves
it with nginx, and the ingress config. Add this repository under
**Settings → Add-ons → Add-on Store → ⋮ → Repositories**, install Fermenta, and it appears
in the sidebar.

Ingress means there is no published port and no login of its own — Home Assistant's session
is the authentication.

## Design

The visual world is an **emission-line rail**: a banded charcoal continuum, bone legends,
one grotesque at one size ranked by tracking and ink, and colour permitted *only* as
needle-thin hairlines at real spectral wavelengths (405/436/486/546/589/615/656nm).
Everything hangs off one off-centre calibrated rail. See the direction contract at the top
of `index.html` and `DESIGN.md`.

Not a card-grid dashboard, where every vessel is an equal rounded box and the trace is a
thumbnail — the trace is the product.

---

MIT
