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

ENV API_UPSTREAM=http://backend:3001
ENV NGINX_ENVSUBST_FILTER=API_UPSTREAM

COPY frontend/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
