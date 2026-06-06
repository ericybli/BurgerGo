#!/bin/sh
# BurgerGo container entrypoint (spec §10.5).
# Applies pending Drizzle migrations against DATABASE_PATH (reading /app/drizzle) BEFORE
# the server accepts traffic. No "|| fallback": a failed migration exits non-zero and
# never serves a stale schema. Then exec the Next.js standalone server.
set -e

echo "burgergo: applying database migrations..."
node ./scripts/migrate.js

echo "burgergo: starting server..."
exec "$@"
