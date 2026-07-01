# VPS

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

## Go commands

```sh
make dev
make test
make build
./bin/vps
```

The service can run as root or non-root. It listens on `:8000` by default when run manually. Override it with `APP_ADDR`.

`make dev` is for local development only. It watches Go files and restarts `go run` when they change.

At startup, `main.go` selects `services/root.go` for root processes and `services/user.go` for non-root processes.

## Install service

```sh
curl -fsSL https://github.com/antoine-mai/mthan-tools-vps/raw/main/scripts/install.sh | sudo bash
```

The installer downloads `vps` and `mthanctl` from `https://github.com/antoine-mai/mthan-tools-vps/raw/main/bin`, installs them to `/usr/local/bin/vps` and `/usr/local/bin/mthanctl`, creates `vps@.service`, and starts the root service.
The installer must be run as `root`.

Installed service:

```text
vps@root.service  public root panel and root helper, APP_ADDR=:2215
```

User activation is managed from the root panel after install. Root-only `/post/*` routes reject cross-origin public calls: they accept requests from the same host as the root panel or from localhost.

## Build and push dist

```sh
DIST_REPO_DIR=/path/to/dist-repo ./scripts/build.sh
```

The build script creates `bin/vps` and `bin/mthanctl`, builds the React client, copies both binaries to `bin/` in the dist repo, copies the React build to `dist/client`, commits, and pushes.

For local build only:

```sh
./scripts/build.sh --no-push
```

## Client commands

```sh
cd client
npm install
npm start
```

The React client uses TypeScript, shadcn/ui, and Tailwind CSS. After adding or changing UI dependencies, run `npm install` inside `client/` before `npm run build`.
