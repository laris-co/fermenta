# Supervisor warns that build.yaml is deprecated and wants build params in the
# Dockerfile. Defaulting BUILD_FROM here means this builds with or without it.
ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:3.21

# Supervisor builds an add-on with the ADD-ON DIRECTORY as the build context, not
# the repository root — so this cannot COPY ../src. It fetches a pinned commit of
# this same repo instead, which also makes every build reproducible and pins the
# exact source that produced the image.
FROM node:22-alpine AS build
ARG FERMENTA_REF=7b98c1af8b01ef5133618546cc44f78238cc807b
WORKDIR /src
RUN apk add --no-cache git \
 && git init -q . \
 && git remote add origin https://github.com/laris-co/fermenta.git \
 && git fetch --depth 1 origin "${FERMENTA_REF}" \
 && git checkout -q FETCH_HEAD
RUN npm install --no-audit --no-fund
RUN npx tsc -b && npx vite build

FROM $BUILD_FROM
RUN apk add --no-cache nginx
COPY --from=build /src/dist /var/www
COPY nginx.conf /etc/nginx/http.d/default.conf
COPY run.sh /run.sh
RUN chmod a+x /run.sh
CMD ["/run.sh"]
