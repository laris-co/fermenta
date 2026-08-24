ARG BUILD_FROM
# ── build the bundle ────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /src
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json vite.config.ts tailwind.config.js postcss.config.js index.html ./
COPY src ./src
RUN npx tsc -b && npx vite build

# ── serve it ────────────────────────────────────────────────────────────────
FROM $BUILD_FROM
RUN apk add --no-cache nginx
COPY --from=build /src/dist /var/www
COPY addon/nginx.conf /etc/nginx/http.d/default.conf
COPY addon/run.sh /run.sh
RUN chmod a+x /run.sh
CMD ["/run.sh"]
