# Cost controls (read this)

BurgerGo is deliberately **no-auth** and served at a public URL. The paid upstreams
— Google Maps Platform and OpenAI — are reached through server endpoints that
**anyone who learns the URL can trigger**. IP-restricting the Google *server* key
does **not** help: the call is made from your server with your key, so the bill is
yours. The only real backstop is a hard spend ceiling set in each provider's
console. These are 5-minute, one-time steps — do them.

## 1. Google Maps Platform — daily quota cap + budget alert

The highest-leverage control. Without a per-API daily quota, a loop against
`/api/google/autocomplete` or `/api/google/details?refresh=1` can run up thousands
of billed calls.

1. **Cloud Console → APIs & Services → Enabled APIs.** For each API the app uses
   (Places API / Place Details, Geocoding API, Directions API, Maps JavaScript
   API, Place Photos), open **Quotas** and set **Requests per day** to a sane
   personal cap (e.g. 1,000–2,000/day). Excess requests then fail instead of bill.
2. **Billing → Budgets & alerts → Create budget.** Set a small monthly amount
   (e.g. $10) with email alerts at 50/90/100%. (A budget *alerts*, it doesn't hard
   stop — the per-API daily quota in step 1 is what actually caps spend.)
3. Keep the **browser** Maps key restricted by HTTP referrer, and the **server**
   key restricted by IP — but remember that's anti-key-theft, not anti-abuse.

## 2. OpenAI — monthly usage limit

Powers AI place summaries + AI import (the most expensive per call: up to 8 images
through a vision model).

1. **platform.openai.com → Settings → Limits.** Set a **hard monthly budget**
   (e.g. $10) and a lower soft/alert threshold. Requests are refused once the hard
   cap is hit.

## 3. (Optional) coarse rate limiting at the edge

Caps abuse before it reaches the upstreams. Add to `deploy/nginx-burgergo.conf`:

```nginx
# in http{}:
limit_req_zone $binary_remote_addr zone=burgergo_api:10m rate=10r/s;
# in the location that proxies /burgergo/api/:
limit_req zone=burgergo_api burst=20 nodelay;
```

Generous for a single user; it just stops a script from hammering the API routes.
The AI/Google **Server Actions** post to page URLs (not `/api/`), so nginx path
rules don't cover them — the provider spend caps above are what protect those.

## 4. Backups

`scripts/backup.sh` snapshots the SQLite DB + uploads to dated folders on the host.
Install the daily cron (see the header of that script). For off-host durability set
`BACKUP_REMOTE`. The DB lives in a Docker named volume; nothing is backed up
automatically until you wire this cron.
