FROM node:22-alpine AS deps
WORKDIR /app

COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8787
ENV SERVE_CLIENT=false

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY apps/api ./apps/api

EXPOSE 8787
CMD ["node", "apps/api/src/index.js"]
