# Stage 1: Build frontend
FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: Build Go binary
FROM golang:1.25-alpine AS backend
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY internal/ internal/
COPY cmd/ cmd/
COPY --from=frontend /app/frontend/dist cmd/gosok/dist
RUN CGO_ENABLED=0 go build -o /gosok ./cmd/gosok/

# Stage 3: Final image
FROM alpine:3.21
RUN apk add --no-cache bash zsh git
COPY --from=backend /gosok /usr/local/bin/gosok
ENV GOSOK_HOST=0.0.0.0
ENV GOSOK_PORT=18435
ENV GOSOK_DB_PATH=/data/gosok.db
VOLUME /data
EXPOSE 18435
ENTRYPOINT ["gosok"]
