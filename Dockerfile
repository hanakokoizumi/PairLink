# syntax=docker/dockerfile:1

# stage 1: web
FROM node:alpine AS web
WORKDIR /app/web
COPY web/package.json web/pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY web/ .
ARG NEXT_PUBLIC_API_URL=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm build

# stage 2: server
FROM golang:alpine AS server
WORKDIR /app
COPY server/go.mod server/go.sum ./
RUN go mod download
COPY server/ .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /pairlink ./cmd/pairlink

# stage 3: final
FROM alpine
RUN apk add --no-cache ca-certificates wget
WORKDIR /app
COPY --from=server /pairlink .
COPY --from=web /app/web/.next/standalone ./web/
COPY --from=web /app/web/.next/static ./web/.next/static
COPY --from=web /app/web/public ./web/public
EXPOSE 8080
ENV PAIRLINK_LOAD_DOTENV=false
ENTRYPOINT ["/app/pairlink"]
