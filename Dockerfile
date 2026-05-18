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

COPY package.json package-lock.json ./

RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY server.ts db.ts ./

EXPOSE 3000

CMD ["npm", "start"]