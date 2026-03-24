.PHONY: dev dev-backend dev-frontend build run clean

# Development: run backend and frontend concurrently
dev:
	@make -j2 dev-backend dev-frontend

dev-backend:
	go run ./cmd/gosok/

dev-frontend:
	cd frontend && npm run dev

# Production build: build frontend then embed in Go binary
build: build-frontend
	go build -o bin/gosok ./cmd/gosok/

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
