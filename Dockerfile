FROM node:22-bookworm-slim AS base

WORKDIR /app

COPY package.json package-lock.json ./

FROM base AS dev

ENV NODE_ENV=development

RUN npm ci

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]

FROM base AS build

ENV NODE_ENV=production

RUN npm ci

COPY . .

RUN npm run build

FROM node:22-bookworm-slim AS production

WORKDIR /app

ENV NODE_ENV=production
# Persistent datastore location, backed by a Docker volume in compose.yml.
ENV LANCEDB_PATH=/data/lancedb

COPY package.json package-lock.json ./

RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY server.ts db.ts docker-entrypoint.sh ./

# Create the data directory owned by the unprivileged "node" user. The
# container starts as root so the entrypoint can fix ownership of the mounted
# volume (which may pre-exist with foreign ownership), then drops to "node".
RUN mkdir -p /data/lancedb \
    && chown -R node:node /data /app \
    && chmod +x docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "start"]