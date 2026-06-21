.PHONY: dev build docker-up docker-pull setup hash-password lint test test-server test-web

setup:
	cp -n .env.example .env || true

dev:
	$(MAKE) -j2 dev-server dev-web

hash-password:
	cd server && go run ./cmd/hash-password --password "$(PASSWORD)"

dev-server:
	cd server && go run ./cmd/pairlink

dev-web:
	cd web && pnpm dev

build:
	cd web && pnpm build
	cd server && CGO_ENABLED=0 go build -o ../bin/pairlink ./cmd/pairlink

docker-up:
	docker compose up -d --build

docker-pull:
	docker compose pull && docker compose up -d

lint:
	cd server && golangci-lint run 2>/dev/null || true
	cd web && pnpm lint

test: test-server test-web

test-server:
	cd server && go test ./... -race -count=1

test-web:
	cd web && pnpm test run
