# WARP Manager

Self-hosted web app to generate and auto-refresh Cloudflare WARP WireGuard configurations.

## Features

- **Generate WARP configs** — Teams Zero Trust or consumer WARP, with or without JWT
- **Auto-refresh** — background refresh every 6h, keeps configs valid
- **Download WG config** — ready-to-use `.conf` files
- **Password protection** — optional `PASSWORD` env var for access control
- **Docker deployable** — single container, SQLite persistence

## Quick Start

```bash
docker run -d --name warp-manager -p 8080:8080 -v warp-data:/data ghcr.io/bgwastu/warp-manager
```

Open http://localhost:8080

## Usage

1. **Add a client** — enter a device name. For Teams/Zero Trust, optionally paste a JWT token (click "How to get this?" for instructions)
2. **Download** — click a client card to view details, download the `.conf`, or refresh/delete
3. **Auto-refresh** — configs are periodically refreshed in the background

## Configuration

| Env Var | Default | Description |
|---|---|---|
| `PORT` | `8080` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address |
| `DB_PATH` | `/data/clients.db` | SQLite database path |
| `REFRESH_INTERVAL` | `6` | Hours between auto-refresh cycles |
| `PASSWORD` | (none) | Optional password to protect the web UI |

## Build from source

```bash
git clone https://github.com/bgwastu/warp-manager
cd warp-manager
docker build -t warp-manager .
docker run -d -p 8080:8080 -v warp-data:/data warp-manager
```

## How it works

Uses [rany2/warp.sh](https://github.com/rany2/warp.sh) under the hood to register devices with Cloudflare's WARP API and generate WireGuard configs. Refresh tokens are stored in SQLite so the background scheduler can periodically re-register devices before they expire.

## License

MIT
