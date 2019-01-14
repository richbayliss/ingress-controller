#!/bin/bash

APP_DIR=/usr/src/app
CERTS_DIR=/usr/src/app/certs
mkdir -p "$CERTS_DIR"

echo "$INGRESS_CONFIG" > "$APP_DIR/ingress-controller.yml"

exec supervisord -c /etc/supervisord.conf
