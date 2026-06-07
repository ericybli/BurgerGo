# BurgerGo MCP

An [MCP](https://modelcontextprotocol.io) server that lets an AI client query and edit your BurgerGo trips.

## Tools

| Tool | What it does |
|------|--------------|
| `list_trips` | List all trips (id, name, dates). |
| `get_trip` | A trip's overview: day-by-day places, saved (wishlist) places, and restaurants. |
| `add_saved_place` | Add a Saved place — `name`, `address` (geocoded), `about`, `notes`, `imageUrl`. |
| `add_restaurant` | Add a restaurant — `name`, `address` (geocoded), `about`, `notes`, `cuisine`, `status`, `imageUrl`. |

`about` → the place's editable "About" (AI-summary) field; for restaurants it's folded into notes.
`imageUrl` is downloaded by this MCP (on your machine) and uploaded as the photo — the server never fetches arbitrary URLs.

## Install

```bash
cd mcp
npm install
```

## Configure

Env vars:

- `BURGERGO_BASE_URL` — base URL including the sub-path. Default: `https://eric.month2month.com/burgergo`. For local dev use e.g. `http://localhost:3000`.
- `BURGERGO_API_KEY` — required for **writes** only when the server has `BURGERGO_API_KEY` set in its `.env` (recommended). Must match. Reads are always public.

### Claude Desktop

Add to `claude_desktop_config.json` (Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "burgergo": {
      "command": "node",
      "args": ["/Users/eric/own/BurgerGo/mcp/server.mjs"],
      "env": {
        "BURGERGO_BASE_URL": "https://eric.month2month.com/burgergo",
        "BURGERGO_API_KEY": "<the key you set on the server>"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add burgergo -- node /Users/eric/own/BurgerGo/mcp/server.mjs
# then set env in the generated config, or:
BURGERGO_API_KEY=… BURGERGO_BASE_URL=… claude mcp add burgergo -- node /Users/eric/own/BurgerGo/mcp/server.mjs
```

## Enabling writes on the server (recommended)

Writes (`add_*`) are open by default (matching the app's no-auth posture). To require a key:

1. Add `BURGERGO_API_KEY=<a long random secret>` to `/opt/webapp/.env` on the server and restart (`docker compose up -d`).
2. Put the same value in this MCP's `BURGERGO_API_KEY` env.

Once set, write requests without a matching `x-api-key` get `401`.
