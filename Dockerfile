# syntax=docker/dockerfile:1

# -----------------------------------------------------------------------------
# Web dependencies — rebuild only when lockfile changes
# -----------------------------------------------------------------------------
FROM node:20-alpine AS web-deps
WORKDIR /app/web
RUN corepack enable && corepack prepare pnpm@9 --activate
COPY web/package.json web/pnpm-lock.yaml ./
RUN --mount=type=cache,id=pairlink-pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Web production build — source layers ordered from stable to volatile
# -----------------------------------------------------------------------------
FROM node:20-alpine AS web-build
WORKDIR /app/web
RUN corepack enable && corepack prepare pnpm@9 --activate
COPY web/package.json web/pnpm-lock.yaml ./
COPY --from=web-deps /app/web/node_modules ./node_modules

COPY web/next.config.ts web/tsconfig.json web/postcss.config.mjs web/middleware.ts ./
COPY web/i18n ./i18n
COPY web/messages ./messages
COPY web/public ./public
COPY web/app ./app
COPY web/components ./components
COPY web/hooks ./hooks
COPY web/lib ./lib

ARG NEXT_PUBLIC_API_URL=
ARG INTERNAL_API_URL=http://127.0.0.1:8081
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    INTERNAL_API_URL=$INTERNAL_API_URL

RUN --mount=type=cache,id=pairlink-next-cache,target=/app/web/.next/cache \
    pnpm build

# -----------------------------------------------------------------------------
# Go binary — mod download cached separately from source compile
# -----------------------------------------------------------------------------
FROM golang:alpine AS server
WORKDIR /src
COPY server/go.mod server/go.sum ./
RUN --mount=type=cache,id=pairlink-gomod,target=/go/pkg/mod \
    go mod download
COPY server/ ./
RUN --mount=type=cache,id=pairlink-gomod,target=/go/pkg/mod \
    --mount=type=cache,id=pairlink-gobuild,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -ldflags="-s -w" -o /pairlink ./cmd/pairlink

# -----------------------------------------------------------------------------
# Runtime image
# -----------------------------------------------------------------------------
FROM node:20-alpine
RUN apk add --no-cache ca-certificates wget
WORKDIR /app

COPY --from=server /pairlink ./pairlink
COPY --from=web-build /app/web/.next/standalone ./web/
COPY --from=web-build /app/web/.next/static ./web/.next/static
COPY --from=web-build /app/web/public ./web/public
COPY deploy/docker-entrypoint.sh /docker-entrypoint.sh

RUN chmod +x /docker-entrypoint.sh /app/pairlink \
 && chown -R node:node /app

USER node
EXPOSE 8080
ENV PAIRLINK_LOAD_DOTENV=false \
    PAIRLINK_API_PORT=8081 \
    PAIRLINK_WEB_PORT=8080 \
    HOSTNAME=0.0.0.0

ENTRYPOINT ["/docker-entrypoint.sh"]
