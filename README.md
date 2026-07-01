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
sudo ./scripts/install.sh
```

The installer downloads the binary from `https://dist.mthan.net/vps/bin/vps`, installs it to `/usr/local/bin/vps`, creates `vps@.service`, and starts a root helper service.
The installer must be run as `root`.

Installed services use two runtimes:

```text
vps@root.service    public root panel and root helper, APP_ADDR=:2215
vps@<user>.service  public user service, APP_ADDR=:2205, POST_BASE_URL=http://127.0.0.1:2215
```

Both the root panel and user service can receive public traffic. Root-only `/post/*` routes still reject cross-origin public calls: they accept requests from the same host as the root panel or from localhost. Public user requests should hit `/api/*`; API routes call the root helper through `POST_BASE_URL` when they need privileged work.

By default, the public service user is the sudo user. If the installer is run directly as root, the service user defaults to `root`, so only the root helper is started. To choose a public user explicitly:

```sh
sudo SERVICE_USER=deploy ./scripts/install.sh
```

## Build and push dist

```sh
DIST_REPO_DIR=/path/to/dist-repo ./scripts/build.sh
```

The build script creates `bin/vps`, builds the React client, copies the binary to `bin/vps` in the dist repo, copies the React build to `dist/client`, commits, and pushes.

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
