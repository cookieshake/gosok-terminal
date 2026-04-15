.PHONY: dev dev-backend dev-frontend build run clean

# Development: run backend and frontend concurrently
dev:
	@make -j2 dev-backend dev-frontend

dev-backend:
	go run ./cmd/gosok/

dev-frontend:
	cd frontend && npm run dev

# Production build: build frontend, embed in Go binary
build: build-frontend
	cp -r frontend/dist cmd/gosok/dist
	go build -o bin/gosok ./cmd/gosok/
	rm -rf cmd/gosok/dist

build-frontend:
	cd frontend && npm run build

run:
	go run ./cmd/gosok/

clean:
	rm -rf bin/ frontend/dist/

lint:
	go vet ./...
	cd frontend && npm run lint

test:
	go test ./...

test-integration:
	go test ./tests/integration/... -timeout 120s

test-e2e: build
	cd tests/e2e && npx playwright test

test-all: test test-integration test-e2e
