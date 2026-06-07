.PHONY: all check test build deploy clean

all: check test build

# ─── Smart Contracts ─────────────────────────────────────────────────────────

contract-build:
	cd contracts/payroll-manager && cargo build --target wasm32-unknown-unknown --release
	cd contracts/payment-stream && cargo build --target wasm32-unknown-unknown --release

contract-test:
	cd contracts/payroll-manager && cargo test
	cd contracts/payment-stream && cargo test

contract-lint:
	cd contracts/payroll-manager && cargo fmt -- --check && cargo clippy --all-targets
	cd contracts/payment-stream && cargo fmt -- --check && cargo clippy --all-targets

contract-fix:
	cd contracts/payroll-manager && cargo fmt
	cd contracts/payment-stream && cargo fmt

# ─── Backend ──────────────────────────────────────────────────────────────────

backend-install:
	cd backend && npm install

backend-dev:
	cd backend && npm run dev

backend-build:
	cd backend && npm run build

backend-lint:
	cd backend && npx tsc --noEmit && npx eslint src --ext .ts

backend-test:
	cd backend && npx vitest run

# ─── Frontend ─────────────────────────────────────────────────────────────────

frontend-install:
	cd frontend && npm install

frontend-dev:
	cd frontend && npm run dev

frontend-build:
	cd frontend && npm run build

frontend-lint:
	cd frontend && npx tsc --noEmit && npx eslint src --ext .ts,.tsx

# ─── Combined ─────────────────────────────────────────────────────────────────

install: backend-install frontend-install

dev: backend-dev frontend-dev

build: contract-build backend-build frontend-build

test: contract-test backend-test

lint: contract-lint backend-lint frontend-lint

check: lint test build

# ─── Docker ───────────────────────────────────────────────────────────────────

docker-build:
	docker compose build

docker-up:
	docker compose up -d

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f

# ─── Deployment ───────────────────────────────────────────────────────────────

deploy-contracts:
	cd scripts && npx tsx deploy-payroll.ts && npx tsx deploy-stream.ts

# ─── Clean ────────────────────────────────────────────────────────────────────

clean:
	cd contracts/payroll-manager && cargo clean
	cd contracts/payment-stream && cargo clean
	rm -rf backend/dist frontend/dist
