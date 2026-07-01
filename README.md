# MThan VPS

Simple Go API with a React client.

## Structure

```text
.
├── client/       # React app
├── routes/       # HTTP route registration
│   ├── api/      # Public API routes
│   └── post/     # Root-only localhost/internal POST routes
├── scripts/      # Shell scripts
├── services/     # Business logic, router, and startup services
├── main.go       # Go entrypoint
└── go.mod
```

## Install service

```sh
curl -fsSL https://github.com/antoine-mai/mthan-tools-vps/raw/main/scripts/install.sh | sudo bash
```

The installer downloads `mthan-vps` and `mthanctl` from `https://github.com/antoine-mai/mthan-tools-vps/raw/main/bin`, installs them to `/usr/local/bin/mthan-vps` and `/usr/local/bin/mthanctl`, creates `mthan-vps@.service`, and starts the root service.
The installer must be run as `root`.

Installed service:

```text
mthan-vps@root.service  public root panel and root helper, APP_ADDR=:2215
```

User activation is managed from the root panel after install. Root-only `/post/*` routes reject cross-origin public calls: they accept requests from the same host as the root panel or from localhost.
