# Mailbag dashboard: build-time API URL + build identity, static nginx serve.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Build identity, injected by .github/workflows/docker.yml from ./VERSION and
# the git commit. Vite bakes VITE_* into the bundle at build time.
ARG VITE_MAILBAG_URL=/api
ARG VITE_APP_VERSION=dev
ARG VITE_APP_COMMIT=none
ARG VITE_APP_BUILD_TIME=unknown
ENV VITE_MAILBAG_URL=$VITE_MAILBAG_URL \
    VITE_APP_VERSION=$VITE_APP_VERSION \
    VITE_APP_COMMIT=$VITE_APP_COMMIT \
    VITE_APP_BUILD_TIME=$VITE_APP_BUILD_TIME
# version.json is the shell-friendly equivalent of the API's GET /version.
RUN npm run build \
 && printf '{"version":"%s","commit":"%s","build_time":"%s"}\n' \
      "$VITE_APP_VERSION" "$VITE_APP_COMMIT" "$VITE_APP_BUILD_TIME" > dist/version.json

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
