#!/usr/bin/env bash
#
# BurgerGo backup — run ON THE SERVER (from cron). Snapshots the SQLite DB via an
# online `.backup` (WAL-safe, consistent) plus the uploads, into dated folders on
# the host. This survives the failure modes that lose the Docker volume: an
# accidental `docker volume rm`, a bad migration, or fat-fingered data deletion.
#
# It keeps copies on the same host, so it does NOT protect against total host/disk
# loss — set BACKUP_REMOTE to an rsync target (another host or an rsync-capable
# bucket) for true off-box durability.
#
# Install (one-time, on the server):
#   crontab -l 2>/dev/null | { cat; echo "0 4 * * * /opt/webapp/scripts/backup.sh >> /var/log/burgergo-backup.log 2>&1"; } | crontab -
#
# Config via env:  KEEP=14  DEST=/opt/webapp/backups  BACKUP_REMOTE=user@host:/path

set -euo pipefail

KEEP="${KEEP:-14}"
DEST="${DEST:-/opt/webapp/backups}"
DB_VOL="${DB_VOL:-webapp_burgergo-db}"
UP_VOL="${UP_VOL:-webapp_burgergo-uploads}"

DB_DIR="$(docker volume inspect "$DB_VOL" -f '{{.Mountpoint}}')"
UP_DIR="$(docker volume inspect "$UP_VOL" -f '{{.Mountpoint}}')"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$DEST/$STAMP"
mkdir -p "$OUT"

# Online backup: .backup is atomic + consistent even while the app is writing
# (WAL). The busy timeout lets it wait out a brief lock instead of failing.
sqlite3 "$DB_DIR/burgergo.db" ".timeout 8000" ".backup '$OUT/burgergo.db'"
# Uploads (Google + personal photos, link thumbnails).
tar -czf "$OUT/uploads.tar.gz" -C "$UP_DIR" .

echo "$(date -Is) backup: wrote $OUT ($(du -sh "$OUT" | cut -f1))"

# Prune to the most recent $KEEP dated folders.
ls -1dt "$DEST"/*/ 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -rf

# Optional off-host copy.
if [ -n "${BACKUP_REMOTE:-}" ]; then
  rsync -az --delete "$DEST/" "$BACKUP_REMOTE/" && echo "$(date -Is) backup: synced to $BACKUP_REMOTE"
fi
