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
COPY server.ts db.ts ./

# Create the data directory and run as the unprivileged "node" user so the
# mounted volume is writable without root.
RUN mkdir -p /data/lancedb && chown -R node:node /data /app
USER node

EXPOSE 3000

CMD ["npm", "start"]