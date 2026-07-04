# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY frontend/package.json ./frontend/
COPY packages/shared/package.json ./packages/shared/

RUN npm install --workspace=@smartreception/frontend

COPY frontend ./frontend
COPY packages/shared ./packages/shared

ARG VITE_API_URL=http://localhost:3001/api/v1
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build -w @smartreception/frontend

# Production stage
FROM nginx:alpine

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
