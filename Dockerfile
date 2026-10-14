FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
COPY apps/api/prisma ./apps/api/prisma
RUN npm ci
RUN npm run prisma:generate
COPY apps/web ./apps/web
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8787
ENV SERVE_CLIENT=true

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY package*.json ./
COPY apps/api ./apps/api
COPY scripts ./scripts
RUN mkdir -p /app/apps/api/data/private-files /app/apps/api/logs && chown -R node:node /app/apps/api/data /app/apps/api/logs
USER node

EXPOSE 8787
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:8787/api/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/api/src/index.js"]
