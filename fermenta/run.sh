#!/usr/bin/with-contenv bashio
bashio::log.info "Fermenta starting on ingress port 8099"
# The browser talks to MQTT directly, so this add-on needs no broker credentials
# and holds no secrets. If nothing ever arrives, the broker is missing a
# WEBSOCKET listener — Mosquitto's add-on exposes 1883/8883 only by default.
exec nginx -g "daemon off;"
