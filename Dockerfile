# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json vite.config.ts tailwind.config.js postcss.config.js index.html ./
COPY src ./src
COPY public ./public

RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

LABEL org.opencontainers.image.source="https://github.com/nymann/chinese"
LABEL org.opencontainers.image.title="Mockingbird"
LABEL org.opencontainers.image.description="Mandarin tone trainer (static SPA)"
LABEL org.opencontainers.image.licenses="MIT"
