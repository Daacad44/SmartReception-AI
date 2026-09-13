# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY frontend/package.json ./frontend/
COPY packages/shared/package.json ./packages/shared/

RUN npm install --workspace=@smartreception/frontend

COPY frontend ./frontend
COPY packages/shared ./packages/shared

ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build -w @smartreception/frontend

# Production stage
FROM nginx:alpine

ENV BACKEND_UPSTREAM=http://backend:3001
ENV PUBLIC_API_URL=/api/v1

COPY frontend/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

RUN printf 'window.__SR_RUNTIME__={apiUrl:"/api/v1"};\n' > /usr/share/nginx/html/runtime-config.js \
  && printf '%s\n' \
    '#!/bin/sh' \
    'API_URL="${PUBLIC_API_URL:-/api/v1}"' \
    'printf "window.__SR_RUNTIME__={apiUrl:\"%s\"};\n" "$API_URL" > /usr/share/nginx/html/runtime-config.js' \
    > /docker-entrypoint.d/40-runtime-config.sh \
  && chmod +x /docker-entrypoint.d/40-runtime-config.sh

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
