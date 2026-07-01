APP_NAME := vps
CTL_NAME := mthanctl
GO_BUILD_FLAGS := -buildvcs=false
GO_PACKAGES := . ./routes/... ./services/...

.PHONY: run dev build build-app build-ctl test fmt tidy clean

run:
	go run $(GO_BUILD_FLAGS) .

dev:
	./scripts/dev.sh

build: build-app build-ctl

build-app:
	mkdir -p bin
	go build $(GO_BUILD_FLAGS) -o bin/$(APP_NAME) .

build-ctl:
	mkdir -p bin
	go build $(GO_BUILD_FLAGS) -tags ctl -o bin/$(CTL_NAME) .

test:
	go test $(GO_PACKAGES)

fmt:
	go fmt ./...

tidy:
	go mod tidy

clean:
	rm -rf bin tmp
