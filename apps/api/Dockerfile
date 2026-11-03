FROM golang:1.23-alpine AS build
WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download 2>/dev/null || true
COPY . .
# Build identity, injected by .github/workflows/docker.yml from ./VERSION and
# the git commit. Defaults keep a bare `docker build` working.
ARG VERSION=dev
ARG COMMIT=none
ARG BUILD_TIME=unknown
RUN CGO_ENABLED=0 go build -trimpath \
    -ldflags="-s -w \
      -X mailbag/internal/version.Version=${VERSION} \
      -X mailbag/internal/version.Commit=${COMMIT} \
      -X mailbag/internal/version.BuildTime=${BUILD_TIME}" \
    -o /mailbag .

FROM gcr.io/distroless/static-debian12
COPY --from=build /mailbag /mailbag
ENV PORT=8080 DATA_DIR=/data
VOLUME /data
EXPOSE 8080
ENTRYPOINT ["/mailbag"]
