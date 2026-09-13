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

RUN apk add --no-cache gettext

COPY frontend/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY frontend/docker-entrypoint.sh /docker-entrypoint-sr.sh
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

RUN chmod +x /docker-entrypoint-sr.sh

ENV BACKEND_UPSTREAM=http://backend:3001
ENV SR_API_URL=/api/v1

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint-sr.sh"]
