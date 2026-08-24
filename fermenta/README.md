# Fermenta

Fermentation tracking that reads temperature straight off MQTT.

Machine readings (temperature) are dense and continuous and drawn as an unbroken hairline.
Human readings (gravity, pH) are sparse and drawn as discrete marks — never joined into a
curve, because a line between two hydrometer readings asserts measurements nobody took.

**Feed state is carried by line form, not colour.** Solid when live, dashed when the feed
goes quiet, dotted when it is lost. A dead sensor looks dead without a legend, and a stale
number is never presented as current.

## Before it can show you anything

Fermenta talks to Mosquitto over **WebSockets** — a browser cannot open a raw 1883 socket.

Verified against a real HA Mosquitto add-on: the websocket listener is on **1884** and it
works, but it **requires credentials** and authenticates against Home Assistant users. Open
the MQTT panel in the app and enter:

    url       ws://<your-ha-host>:1884
    username  <an HA username>
    password  <that user's password>

CONNACK return code 5 means the broker is up and the credentials are wrong.

Then set each vessel's topic to whatever its probe publishes to.

## Notes

- No login of its own — Home Assistant's session is the authentication (ingress).
- History is only as complete as the time the app was open; MQTT is the transport, not a
  database. Samples thin with age: full resolution 24h, 15-minute for a week, hourly beyond.
- Data lives in browser storage, per-device.

Source and full documentation: https://github.com/laris-co/fermenta
