# Flint Makefile

.PHONY: all install build web-build deps check-go check-bun test test-verbose test-cover lint fmt vet clean dev-setup run dev help

# Default target
all: build

# Install all dependencies, build everything, and install to system
install: deps web-build build
	@echo "📦 Installing flint to /usr/local/bin..."
	sudo cp flint /usr/local/bin/
	sudo chmod +x /usr/local/bin/flint
	@echo "✅ Flint installed successfully!"
	@echo "🚀 Run 'flint serve' to get started"

# Install Go dependencies and check for bun
deps: check-go
	@echo "📥 Installing Go dependencies..."
	go mod download
	go mod tidy
	@$(MAKE) check-bun

# Check if Go is installed, install if not
check-go:
	@echo "🔍 Checking for Go..."
	@if ! command -v go >/dev/null 2>&1; then \
		echo "📦 Installing Go 1.25.1..."; \
		$(MAKE) install-go; \
		echo "✅ Go installed successfully"; \
		echo "⚠️  Please restart your shell or run: source ~/.profile"; \
	else \
		echo "✅ Go is already installed ($$(go version))"; \
	fi

# Install Go based on OS and architecture
install-go:
	@echo "🔍 Detecting OS and architecture..."
	@OS=$$(uname -s | tr '[:upper:]' '[:lower:]'); \
	ARCH=$$(uname -m); \
	case $$ARCH in \
		x86_64) ARCH="amd64" ;; \
		aarch64|arm64) ARCH="arm64" ;; \
		*) echo "❌ Unsupported architecture: $$ARCH"; exit 1 ;; \
	esac; \
	case $$OS in \
		linux) \
			echo "🐧 Installing Go for Linux ($$ARCH)..."; \
			wget -q https://go.dev/dl/go1.25.1.linux-$$ARCH.tar.gz -O /tmp/go1.25.1.tar.gz; \
			sudo rm -rf /usr/local/go; \
			sudo tar -C /usr/local -xzf /tmp/go1.25.1.tar.gz; \
			rm /tmp/go1.25.1.tar.gz; \
			echo "export PATH=\$$PATH:/usr/local/go/bin" >> ~/.profile; \
			export PATH=$$PATH:/usr/local/go/bin; \
			echo "🔄 Added Go to PATH in ~/.profile"; \
			;; \
		darwin) \
			echo "🍎 Installing Go for macOS ($$ARCH)..."; \
			curl -L https://go.dev/dl/go1.25.1.darwin-$$ARCH.tar.gz -o /tmp/go1.25.1.tar.gz; \
			sudo rm -rf /usr/local/go; \
			sudo tar -C /usr/local -xzf /tmp/go1.25.1.tar.gz; \
			rm /tmp/go1.25.1.tar.gz; \
			echo "export PATH=\$$PATH:/usr/local/go/bin" >> ~/.profile; \
			export PATH=$$PATH:/usr/local/go/bin; \
			echo "🔄 Added Go to PATH in ~/.profile"; \
			;; \
		*) \
			echo "❌ Unsupported OS: $$OS"; \
			echo "Please install Go manually from https://golang.org/dl/"; \
			exit 1; \
			;; \
	esac

# Check if bun is installed, install if not
check-bun:
	@echo "🔍 Checking for bun..."
	@if ! command -v bun >/dev/null 2>&1; then \
		echo "📦 Installing bun..."; \
		curl -fsSL https://bun.sh/install | bash; \
		echo "✅ Bun installed successfully"; \
		echo "⚠️  Please restart your shell or run: source ~/.bashrc"; \
		echo "🔄 Attempting to use bun from ~/.bun/bin/bun"; \
		export PATH="$$HOME/.bun/bin:$$PATH"; \
	else \
		echo "✅ Bun is already installed"; \
	fi
	@echo "📥 Installing web dependencies..."
	@if command -v bun >/dev/null 2>&1; then \
		cd web && bun install; \
	else \
		echo "🔄 Using bun from ~/.bun/bin/bun"; \
		cd web && ~/.bun/bin/bun install; \
	fi

# Build web assets (required before Go build)
web-build:
	@echo "🌐 Building web assets..."
	@if command -v bun >/dev/null 2>&1; then \
		cd web && bun run build; \
	else \
		echo "🔄 Using bun from ~/.bun/bin/bun"; \
		cd web && ~/.bun/bin/bun run build; \
	fi
	@echo "✅ Web assets built successfully"

# Build the Go binary (requires web assets to be built first)
build: web-build
	@echo "🔨 Building flint binary..."
	go build -o flint .
	@echo "✅ Flint binary built successfully"

# Development build (faster, no web rebuild)
dev:
	@echo "🔨 Building flint binary (development mode)..."
	go build -o flint .
	@echo "✅ Development build complete"

# Clean build artifacts
clean:
	@echo "🧹 Cleaning build artifacts..."
	go clean
	rm -f flint
	rm -rf web/out
	rm -rf web/.next
	@echo "✅ Clean complete"

# Test targets
test:
	go test ./...

test-verbose:
	go test -v ./...

test-cover:
	go test -cover ./...

# Code quality targets
lint:
	golangci-lint run

fmt:
	go fmt ./...

vet:
	go vet ./...

check: fmt vet lint test

# Development helpers
dev-setup:
	go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest

run:
	go run main.go serve

# Alias for backwards compatibility
install-deps: deps

# Help target
help:
	@echo "🌀 Flint Build System"
	@echo ""
	@echo "🚀 One-command install: make install"
	@echo ""
	@echo "Available targets:"
	@echo "  install      - Install Go (if needed), bun (if needed), dependencies, build everything, and install to /usr/local/bin"
	@echo "  build        - Build web assets and Go binary"
	@echo "  web-build    - Build only web assets"
	@echo "  dev          - Quick build (Go binary only, assumes web assets exist)"
	@echo "  deps         - Install Go, bun, and all dependencies"
	@echo "  check-go     - Check for Go installation, install if missing"
	@echo "  check-bun    - Check for bun installation, install if missing"
	@echo "  clean        - Clean build artifacts"
	@echo "  test         - Run tests"
	@echo "  test-verbose - Run tests with verbose output"
	@echo "  test-cover   - Run tests with coverage"
	@echo "  lint         - Run linter"
	@echo "  fmt          - Format code"
	@echo "  vet          - Run go vet"
	@echo "  check        - Run fmt, vet, lint, and test"
	@echo "  dev-setup    - Install development tools"
	@echo "  run          - Run flint serve"
	@echo "  help         - Show this help"
	@echo ""
	@echo "📋 Automatic installations:"
	@echo "  • Go 1.25.1 (Linux amd64/arm64, macOS amd64/arm64)"
	@echo "  • Bun (JavaScript runtime)"
	@echo "  • All Go and web dependencies"
	@echo ""
	@echo "🚀 Quick start: make install"