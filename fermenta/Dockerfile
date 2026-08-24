# Supervisor warns build.yaml is deprecated and wants build params inline, so
# BUILD_FROM is defaulted here as well as mapped per-arch in build.yaml.
ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:3.21
FROM $BUILD_FROM

# NO BUILD STEP, AND NO GIT FETCH. Both earlier designs were wrong:
#
#   COPY ../src   — impossible. Supervisor builds with the ADD-ON DIRECTORY as
#                   the context; it never sees the repository root.
#   git fetch <pinned sha> — built, but pinned a commit written once at creation
#                   and never updated. Four commits of fixes were published and
#                   silently never reached the image, because every rebuild
#                   faithfully fetched the same stale ref. Reproducibility
#                   without a release step is just staleness.
#
# The bundle is committed to fermenta/dist/ by `npm run sync` and copied
# straight in. The image always matches the commit it was built from, installs
# are seconds rather than an on-device node build, and there is no ref to forget
# to bump. Cost: dist/ is build output in git, so `npm run sync` is mandatory
# before releasing — the README says so and the version bump is in the same step.
RUN apk add --no-cache nginx
COPY dist /var/www
COPY nginx.conf /etc/nginx/http.d/default.conf
COPY run.sh /run.sh
RUN chmod a+x /run.sh
CMD ["/run.sh"]
