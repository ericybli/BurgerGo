# Deploying BurgerGo

BurgerGo runs as a Docker container behind nginx, fronted by Cloudflare, at:

**https://eric.month2month.com/burgergo**

- **Cloudflare** terminates TLS (proxied DNS). The browser sees HTTPS — which keeps the PWA's secure-context requirement (service worker, install-to-home-screen) satisfied. Set the zone's **SSL/TLS mode to "Flexible"** (the origin serves plain HTTP on :80).
- **nginx** (host) reverse-proxies `location /burgergo` → the container on `127.0.0.1:3000`.
- The **container** is built with `NEXT_PUBLIC_BASE_PATH=/burgergo`, so it serves everything (pages, `_next` assets, `/api`, `sw.js`) under `/burgergo`.
- The container binds to **loopback only**, so the app is reachable only through nginx/Cloudflare, never directly on the public `IP:3000`.

Server: `root@172.235.40.132` · App dir: `/opt/webapp` · data in Docker volumes `burgergo-db` + `burgergo-uploads`.

---

## DNS / Cloudflare (already configured)

- `A  eric.month2month.com → 172.235.40.132`, **proxied** (orange cloud).
- SSL/TLS mode: **Flexible**.
- The browser Maps key (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) must allow the referrer
  `https://eric.month2month.com/*` in Google Cloud Console → Credentials. The
  server key (`GOOGLE_MAPS_SERVER_KEY`) should be IP-restricted to `172.235.40.132`.

## One-time setup

1. **Provision the server** (installs Docker + nginx):
   ```bash
   ssh root@172.235.40.132 'bash -s' < scripts/provision-server.sh
   ```

2. **Create `/opt/webapp/.env` on the server** (holds secrets + the build-time
   sub-path; never committed, never overwritten by deploys):
   ```bash
   ssh root@172.235.40.132 'cat > /opt/webapp/.env' <<'ENV'
   NEXT_PUBLIC_BASE_PATH=/burgergo
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<your browser key>
   GOOGLE_MAPS_SERVER_KEY=<your server key>
   DATABASE_PATH=/data/burgergo.db
   UPLOADS_DIR=/data/uploads
   DEFAULT_CURRENCY=USD
   DEFAULT_LANGUAGE=en
   TZ=UTC
   ENV
   ```
   `NEXT_PUBLIC_*` are read by `docker compose` as **build args** (inlined into the
   client bundle) and also passed at runtime.

## Deploy / update

From your workstation, any time:
```bash
./scripts/deploy.sh
```
It rsyncs the source, refreshes the nginx site, runs `docker compose build && up -d`
on the server (migrations run on container start), and health-checks the origin.
`SERVER=` and `APP_DIR=` env vars override the defaults.

## Operate

```bash
ssh root@172.235.40.132
cd /opt/webapp
docker compose ps
docker compose logs -f app
docker compose restart app
```

## Backups

Durable state is the `burgergo-db` and `burgergo-uploads` Docker volumes. Snapshot
the SQLite DB safely (handles WAL) + the uploads:
```bash
docker compose exec app sh -c 'sqlite3 /data/burgergo.db ".backup /data/backup-$(date +%F).db"'
docker compose cp app:/data/backup-$(date +%F).db ./
docker run --rm -v burgergo-uploads:/u -v "$PWD":/out busybox tar czf /out/uploads-$(date +%F).tgz -C /u .
```

## Troubleshooting

- **Docker build fails at `npm ci` with `Invalid Version:`** — npm sometimes writes
  version-less sharp musl optional-dep entries into `package-lock.json` that crash
  `npm ci` on linux. Fix: `node scripts/fix-lockfile.mjs` (commit the result), then redeploy.

> **Note:** the app has **no authentication** and is **public** at the URL above —
> anyone with the link can read/edit the trips. Add nginx HTTP Basic Auth or a
> Cloudflare Access policy on `/burgergo` if you want to lock it down later.
