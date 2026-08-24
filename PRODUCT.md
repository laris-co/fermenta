# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + Tailwind CSS, built as a static bundle and shipped inside a Home Assistant OS
add-on. No server of its own: the add-on serves the static files, and the browser talks
straight to MQTT.

## Users

One homebrewer — Nat — running 3–5 fermenting vessels at a time in a home/maker-space
setting. Not a commercial floor, not a team. The same person owns the hardware, the recipe,
the readings, and the outcome, and will be looking at this on a phone in a room that is
often warm and dim, sometimes with one hand free.

## Product Purpose

Track a fermentation from pitch to packaging and answer one question fast: **is this batch
behaving, or is it drifting?**

Fermentation is slow and mostly invisible. The failure modes that matter — a stall, a
temperature excursion, a runaway exotherm in the first 48 hours — are all visible in the
shape of a curve well before they are visible in the beer. Success is noticing early
enough to act, and having the history to know what "normal" looked like last time.

## Positioning

It reads the same MQTT stream the sensors already publish to, so temperature is live and
continuous rather than a value someone remembered to write down. A generic brewing log
cannot claim that: its curve is only as dense as the brewer's discipline. Here, the
manual readings (gravity, pH) are the sparse ones and the machine reading is the dense
one — the inverse of a paper logbook, and the reason a stall shows up as a shape rather
than a gap.

## Operating Context

- **Sensor path**: ESPHome temperature probe → publishes to Mosquitto (MQTT broker running
  as a HAOS add-on on the `catlab` guest, 192.168.1.143) → the browser subscribes directly.
- **Browser MQTT is over WebSockets, not raw 1883.** Verified against the live broker: the
  HA Mosquitto add-on's websocket listener is present on **1884**, negotiates the `mqtt`
  subprotocol, and returns a valid CONNACK. It requires credentials — anonymous connects are
  refused rc=5 — and authenticates against Home Assistant users, so an HA login works.
  (An earlier assumption that the listener had to be added by hand was wrong; it was reasoned
  from documented ports instead of tested.)
- **Deployment**: a Home Assistant add-on with `ingress: true` plus `panel_icon`/`panel_title`
  (there is no `ingress_panel` key in config.yaml — it is Supervisor runtime state), so it appears in catlab's left sidebar next to ESPHome and Node-RED. HA's own
  session is the authentication — the app never implements login.
- **Reachable** on the LAN at `catlab.local`, and remotely at `ha.laris.co` behind
  Cloudflare Access.
- **Readings split by origin**: temperature arrives continuously and unattended; gravity and
  pH require a hydrometer and a human, so they are sparse, deliberate, and timestamped by
  hand. The interface must not pretend these are the same kind of data.

## Capabilities and Constraints

**Confirmed**

- Batch lifecycle: pitch → primary → secondary/conditioning → packaged, with dates.
- Live temperature curve per vessel from MQTT, retained across sessions.
- Manual entry of gravity (OG/SG/FG) and pH, with derived ABV and attenuation.
- Recipe and tasting notes attached to a batch; full history kept after packaging.
- 3–5 concurrent vessels; depth-per-batch matters more than fleet overview.

**Constraints**

- Static bundle only — no backend to persist to. Data lives in the browser and/or the
  add-on's own `/data` volume; MQTT is the transport, not the database.
- Must remain readable when the MQTT connection is down: a stale curve clearly marked stale
  beats a blank screen or a silent lie.
- Phone-first in practice, even though it will also be opened on a desktop.

**Open / undecided**

- No ESPHome fermentation probe is flashed yet — the MQTT topic structure is therefore an
  assumption until real hardware publishes. Topic layout must be configurable, not baked in.
- Whether history persists in browser storage or the add-on's `/data` volume.
- Alerting (stall detection, temperature excursion) is desirable but not confirmed for v1.
