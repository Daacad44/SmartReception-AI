#!/bin/sh
set -e

BACKEND_UPSTREAM="${BACKEND_UPSTREAM:-http://backend:3001}"
SR_API_URL="${SR_API_URL:-/api/v1}"

export BACKEND_UPSTREAM
envsubst '${BACKEND_UPSTREAM}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

printf "window.__SR_API_URL__='%s';\n" "$SR_API_URL" > /usr/share/nginx/html/runtime-config.js

exec nginx -g 'daemon off;'
