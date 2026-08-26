FROM node:22.22.0-bookworm-slim AS base

WORKDIR /app

COPY --chown=node:node package.json package-lock.json ./

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

FROM node:22.22.0-bookworm-slim AS production

WORKDIR /app

ENV NODE_ENV=production
# Persistent datastore and media locations, backed by host directories in Compose.
ENV LANCEDB_PATH=/data/lancedb
ENV COMMUNITY_MEDIA_PATH=/data/media/community

COPY --chown=node:node package.json package-lock.json ./

RUN npm ci --omit=dev

COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node server ./server
COPY docker-entrypoint.sh ./

# Create the writable data directories for the unprivileged "node" user. The
# application tree only needs to be readable; recursively changing ownership of
# installed dependencies adds substantial image-build I/O without improving
# runtime isolation.
RUN mkdir -p /data/lancedb /data/media/community \
    && chown -R node:node /data \
    && find /app/dist -type d -exec chmod 755 {} + \
    && find /app/dist -type f -exec chmod 644 {} + \
    && chmod +x docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "start"]
