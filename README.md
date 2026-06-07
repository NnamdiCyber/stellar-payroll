# StellarPay

**Cross-border B2B Payroll & Contractor Payments on Stellar**

[![CI](https://github.com/your-org/stellar-payroll/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/stellar-payroll/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Stellar](https://img.shields.io/badge/Stellar-Testnet-0c87f2)](https://stellar.org)
[![Soroban](https://img.shields.io/badge/Soroban-21-7c3aed)](https://soroban.stellar.org)
[![SCF](https://img.shields.io/badge/SCF-Build%20Award-00e5a0)](https://communityfund.stellar.org)

---

## Table of Contents

- [Problem](#problem)
- [Solution](#solution)
- [Architecture](#architecture)
- [Smart Contracts](#smart-contracts)
  - [Payroll Manager](#payroll-manager)
  - [Payment Stream](#payment-stream)
- [Backend API](#backend-api)
- [Frontend App](#frontend-app)
- [Quick Start](#quick-start)
- [Running Tests](#running-tests)
- [Docker Deployment](#docker-deployment)
- [Project Structure](#project-structure)
- [How It Works](#how-it-works)
- [SCF Grant Alignment](#scf-grant-alignment)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Problem

Global businesses hiring remote contractors face a broken payment experience:

- **Slow settlement**: International wires take 3–5 business days
- **High fees**: SWIFT fees, FX spreads, intermediary bank charges — often 5–10% of the payment
- **Manual operations**: Every contractor paid individually via separate wire transfers
- **No streaming**: Contractors wait 30+ days for payment with no visibility
- **Compliance overhead**: No built-in multisig approval for company treasuries
- **Poor FX**: No control over exchange rates or ability to hold/draw in stablecoins

**$8T+ flows through cross-border B2B payments annually**, and remote teams waste billions in friction.

## Solution

StellarPay solves this with two Soroban smart contracts on the Stellar network:

1. **Payroll Manager** — batch-pay multiple contractors in one transaction with multisig approval workflow
2. **Payment Stream** — real-time salary streaming where contractors earn per-second and withdraw at will

Built-in features:
- **Multi-currency**: Pay in USDC, EURC, XLM, or any Stellar asset
- **Multisig treasury**: N-of-M signers must approve each payroll run
- **Anchors**: On/off-ramp to local fiat via the Stellar anchor network
- **2–5 second settlement**: Not 3–5 days
- **Near-zero fees**: Fractions of a cent per transaction
- **Audit trail**: Every payment is on-chain and queryable

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (React)                   │
│         Company Dashboard  |  Contractor Portal       │
└──────────────────┬────────────────────────────────────┘
                   │ HTTP/REST
                   ▼
┌─────────────────────────────────────────────────────┐
│               Backend API (Node.js + Stellar SDK)     │
│  ┌───────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Payroll   │  │ Stream   │  │ Anchor/Accounts   │  │
│  │ Routes    │  │ Routes   │  │ Routes            │  │
│  └─────┬─────┘  └────┬─────┘  └────────┬─────────┘  │
│        └──────────────┼─────────────────┘            │
│                       ▼                              │
│             StellarService (SDK)                     │
└───────────────────────┬──────────────────────────────┘
                        │ Soroban RPC
                        ▼
┌─────────────────────────────────────────────────────┐
│                 Stellar Network                       │
│  ┌─────────────────────┐  ┌──────────────────────┐  │
│  │  Payroll Manager    │  │  Payment Stream       │  │
│  │  Soroban Contract   │  │  Soroban Contract     │  │
│  ├─────────────────────┤  ├──────────────────────┤  │
│  │ • register_company  │  │ • create_stream      │  │
│  │ • add_contractor    │  │ • withdraw           │  │
│  │ • create_payroll_run│  │ • cancel_stream      │  │
│  │ • add_payment       │  │ • get_available      │  │
│  │ • approve_payroll   │  │ • get_stream         │  │
│  │ • execute_payroll   │  └──────────────────────┘  │
│  └─────────────────────┘                            │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │            Stellar Anchors                    │   │
│  │  USDC │ EURC │ BRL │ NGN │ Local Fiat        │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## Smart Contracts

### Payroll Manager

**Source**: `contracts/payroll-manager/src/lib.rs`

Manages company registration, contractor onboarding, and batch payroll execution with multisig approval.

#### Data Types

```rust
struct Company {
    admin: Address,        // Company admin
    signers: Vec<Address>, // Multisig signers
    min_signers: u32,      // Threshold required
    token: Address,        // Default payment token
    active: bool,
}

struct Contractor {
    wallet: Address,
    name: String,
    email: String,
    active: bool,
    total_paid: i128,
}

struct PayrollRun {
    id: u64,
    company: Address,
    period_start: u64,
    period_end: u64,
    status: PayrollStatus, // Pending → Approved → Executing → Completed
    total_amount: i128,
    payment_count: u32,
    approvals: Vec<Address>,
}

struct PaymentEntry {
    contractor: Address,
    amount: i128,
    currency: Address,
    memo: String,
    paid: bool,
}
```

#### Functions

| Function | Auth | Description |
|---|---|---|
| `register_company(admin, signers, min_signers, token)` | admin | Register a new company with multisig config |
| `update_company(admin, signers, min_signers, token)` | admin | Update company config |
| `deactivate_company(admin)` | admin | Deactivate company |
| `add_contractor(company, contractor, name, email)` | admin | Add contractor to company roster |
| `remove_contractor(company, contractor)` | admin | Soft-delete contractor |
| `create_payroll_run(company, period_start, period_end)` | admin | Start a new payroll batch |
| `add_payment(company, run_id, contractor, amount, currency, memo)` | admin | Add a payment entry to a run |
| `approve_payroll_run(company, run_id, signer)` | signer | Approve a run (N-of-M threshold) |
| `execute_payroll_run(company, run_id)` | any signer | Execute all payments in approved run |
| `cancel_payroll_run(company, run_id)` | admin | Cancel a pending run |
| `deposit_to_escrow(company, token, amount)` | admin | Pre-fund the escrow pool |

#### Payroll Lifecycle

```
create_payroll_run()
        │
        ▼
     Pending ───── add_payment() ───→ add more payments
        │
   approve_payroll_run()  ←── requires min_signers approvals
        │
        ▼
    Approved
        │
  execute_payroll_run()  ←── transfers tokens to each contractor
        │
        ▼
   Completed
```

### Payment Stream

**Source**: `contracts/payment-stream/src/lib.rs`

Real-time payment streaming — contractors earn per-second, withdraw on demand.

#### Functions

| Function | Auth | Description |
|---|---|---|
| `create_stream(sender, recipient, token, amount/s, max, duration, memo)` | sender | Create a payment stream |
| `withdraw(stream_id, amount)` | recipient | Withdraw earned but unpaid amount |
| `cancel_stream(stream_id)` | sender | Cancel stream, pay out earned balance |
| `get_stream(stream_id)` | public | Query stream details |
| `get_available_amount(stream_id)` | public | How much is available to withdraw |
| `get_recipient_streams(recipient)` | public | List streams for a recipient |
| `get_sender_streams(sender)` | public | List streams created by a sender |

**Streaming math** (computed in contract):

```
earned = rate_per_second × min(now - start, duration)
available_to_withdraw = earned - already_withdrawn
```

---

## Backend API

**Base URL**: `http://localhost:3000/api/v1`

### Payroll

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/payroll/accounts/create` | — | Create and fund a testnet Stellar account |
| `POST` | `/payroll/companies` | admin key | Register company on-chain |
| `GET` | `/payroll/companies/:address` | — | Get company info |
| `POST` | `/payroll/contractors` | admin key | Add a contractor |
| `DELETE` | `/payroll/contractors/:company/:contractor` | admin key | Remove contractor |
| `POST` | `/payroll/runs` | admin key | Create a payroll run |
| `POST` | `/payroll/payments` | admin key | Add payment to a run |
| `POST` | `/payroll/runs/approve` | signer key | Approve a payroll run |
| `POST` | `/payroll/runs/:runId/execute` | signer key | Execute approved run |

### Payment Streams

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/streams` | sender key | Create payment stream |
| `POST` | `/streams/:id/withdraw` | recipient key | Withdraw from stream |
| `POST` | `/streams/:id/cancel` | sender key | Cancel stream |
| `GET` | `/streams/:id` | — | Get stream details |

### Anchor / Onboarding

| Method | Path | Description |
|---|---|---|
| `POST` | `/anchor/create-account` | Create & fund testnet account |
| `GET` | `/anchor/balance/:publicKey` | Get XLM balance |
| `POST` | `/anchor/create-trustline` | Create trustline for an asset |

### Example: Full Payroll Flow

```bash
# 1. Create company account (testnet)
curl -s -X POST http://localhost:3000/api/v1/payroll/accounts/create

# 2. Register company
curl -s -X POST http://localhost:3000/api/v1/payroll/companies \
  -H 'Content-Type: application/json' \
  -d '{
    "adminSecretKey": "YOUR_SECRET_KEY",
    "signers": ["SIGNER_1_PUBLIC", "SIGNER_2_PUBLIC"],
    "minSigners": 2,
    "tokenAddress": "TOKEN_CONTRACT_ID"
  }'

# 3. Add contractor
curl -s -X POST http://localhost:3000/api/v1/payroll/contractors \
  -H 'Content-Type: application/json' \
  -d '{
    "companyAddress": "COMPANY_PUBLIC_KEY",
    "contractorAddress": "CONTRACTOR_PUBLIC_KEY",
    "name": "Jane Doe",
    "email": "jane@example.com"
  }'

# 4. Create payroll run
curl -s -X POST http://localhost:3000/api/v1/payroll/runs \
  -H 'Content-Type: application/json' \
  -d '{
    "companyAddress": "COMPANY_PUBLIC_KEY",
    "periodStart": 1747000000,
    "periodEnd": 1747086400
  }'

# 5. Add payment
curl -s -X POST http://localhost:3000/api/v1/payroll/payments \
  -H 'Content-Type: application/json' \
  -d '{
    "companyAddress": "COMPANY_PUBLIC_KEY",
    "runId": 0,
    "contractorAddress": "CONTRACTOR_PUBLIC",
    "amount": "500000000",
    "currency": "TOKEN_CONTRACT",
    "memo": "May 2026 salary"
  }'

# 6. Approve (requires 2 signers)
curl -s -X POST http://localhost:3000/api/v1/payroll/runs/approve \
  -H 'Content-Type: application/json' \
  -d '{
    "companyAddress": "COMPANY_PUBLIC_KEY",
    "signerSecretKey": "SIGNER_1_SECRET",
    "runId": 0
  }'

# 7. Execute
curl -s -X POST http://localhost:3000/api/v1/payroll/runs/0/execute \
  -H 'Content-Type: application/json' \
  -d '{
    "companyAddress": "COMPANY_PUBLIC_KEY",
    "signerSecretKey": "SIGNER_1_SECRET"
  }'
```

---

## Frontend App

**Stack**: React 18 + TypeScript + Vite + Tailwind CSS + React Router + TanStack Query

### Pages

| Route | Page | Description |
|---|---|---|
| `/` | Dashboard | Overview, quick actions, testnet account creation |
| `/setup` | Company Setup | Register company with multisig config |
| `/contractors` | Contractors | Add/manage contractor roster |
| `/payroll` | Payroll Runs | Create, approve, execute payroll batches |
| `/streams` | Payment Streams | Create and manage real-time payment streams |
| `/portal` | Contractor Portal | Contractor view — payment history and active streams |

### Features
- Dark theme with Stellar brand colors
- Testnet account creation with Friendbot auto-funding
- Keyboard-accessible navigation
- Mobile-responsive sidebar

---

## Quick Start

### Prerequisites

| Tool | Version | Install |
|---|---|---|
| Rust | 1.75+ | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh` |
| wasm target | — | `rustup target add wasm32-unknown-unknown` |
| Node.js | 20+ | `nvm install 20` |
| Docker | 24+ | [docs.docker.com/get-docker](https://docs.docker.com/get-docker) |
| Stellar CLI | latest | `npm install -g @stellar/stellar-cli` |

### One-command start (Docker)

```bash
make docker-build && make docker-up
```

### Manual start

```bash
# 1. Build smart contracts
make contract-build

# 2. Deploy to testnet
cd scripts && npm install
npx tsx deploy-payroll.ts    # → PAYROLL_CONTRACT_ID
npx tsx deploy-stream.ts     # → STREAM_CONTRACT_ID

# 3. Start backend
cd ../backend
cp .env.example .env
# Edit .env: add PAYROLL_CONTRACT_ID and STREAM_CONTRACT_ID
npm install && npm run dev   # → http://localhost:3000

# 4. Start frontend
cd ../frontend
npm install && npm run dev   # → http://localhost:5173
```

### Makefile commands

```bash
make check        # Full CI pipeline (lint → test → build)
make test         # All tests (contracts + backend)
make lint         # All linters (rustfmt, clippy, eslint, tsc)
make build        # Build everything (contracts + backend + frontend)
make dev          # Start dev servers (backend + frontend)
make docker-up    # Full stack via docker-compose
make docker-logs  # Follow container logs
```

---

## Running Tests

```bash
# All tests
make test

# Smart contracts only
cd contracts/payroll-manager && cargo test
cd contracts/payment-stream && cargo test

# Backend only
cd backend && npm test

# With coverage
cd backend && npm run test:coverage
```

---

## Docker Deployment

```bash
# Build images
docker compose build

# Start full stack
docker compose up -d

# Check health
curl http://localhost:3000/health

# View logs
docker compose logs -f

# Stop
docker compose down
```

Environment variables for Docker are set in `docker-compose.yml`. Pass contract IDs:

```bash
PAYROLL_CONTRACT_ID=C... STREAM_CONTRACT_ID=C... docker compose up -d
```

---

## Project Structure

```
stellar-payroll/
│
├── contracts/                        # Soroban smart contracts
│   ├── payroll-manager/              # Batch payroll with multisig
│   │   ├── Cargo.toml
│   │   └── src/lib.rs               # ~400 lines of contract logic + tests
│   └── payment-stream/               # Real-time payment streaming
│       ├── Cargo.toml
│       └── src/lib.rs               # ~280 lines of contract logic + tests
│
├── backend/                          # Node.js API server
│   ├── src/
│   │   ├── index.ts                 # Express app entry point
│   │   ├── config/
│   │   │   ├── index.ts             # Env validation (Zod)
│   │   │   └── schemas.ts           # Request/response schemas
│   │   ├── services/
│   │   │   ├── stellar.ts           # Stellar SDK wrapper
│   │   │   ├── payroll.ts           # Payroll contract client
│   │   │   └── stream.ts            # Stream contract client
│   │   ├── routes/
│   │   │   ├── payroll.ts           # Payroll REST endpoints
│   │   │   ├── stream.ts            # Stream REST endpoints
│   │   │   └── anchor.ts            # Account/trustline endpoints
│   │   └── middleware/
│   │       └── errorHandler.ts      # Global error handler
│   ├── Dockerfile
│   ├── .eslintrc.cjs
│   └── vitest.config.ts
│
├── frontend/                         # React dashboard
│   ├── src/
│   │   ├── main.tsx                 # App entry
│   │   ├── App.tsx                  # Route definitions
│   │   ├── components/
│   │   │   └── Layout.tsx           # Sidebar + header shell
│   │   └── pages/
│   │       ├── Dashboard.tsx        # Overview + quick actions
│   │       ├── CompanySetup.tsx     # Company registration form
│   │       ├── Contractors.tsx      # Contractor CRUD
│   │       ├── Payroll.tsx          # Payroll run management
│   │       ├── PaymentStreams.tsx   # Stream creation + management
│   │       └── ContractorPortal.tsx # Contractor payment view
│   ├── Dockerfile
│   ├── nginx.conf
│   └── .eslintrc.cjs
│
├── scripts/                          # Deployment utilities
│   ├── deploy-payroll.ts            # Upload & instantiate payroll contract
│   └── deploy-stream.ts             # Upload & instantiate stream contract
│
├── .github/                          # GitHub templates
│   ├── workflows/ci.yml             # CI pipeline
│   ├── ISSUE_TEMPLATE/              # Bug + feature templates
│   └── PULL_REQUEST_TEMPLATE.md
│
├── .gitignore
├── .prettierrc
├── rustfmt.toml
├── Makefile
├── docker-compose.yml
├── LICENSE
├── CODE_OF_CONDUCT.md
├── CONTRIBUTING.md
└── README.md
```

---

## How It Works

### Payment Flow (detailed)

```
Company Admin                    Signer 2                    Contractor
     │                              │                           │
     ├─ create_payroll_run() ───────┤                           │
     │                              │                           │
     ├─ add_payment(alice, $5k) ────┤                           │
     ├─ add_payment(bob, $3k) ──────┤                           │
     │                              │                           │
     │                    approve_payroll_run()                 │
     │                              │                           │
     │◄──── (needs 2nd approval) ──┤                           │
     │                              │                           │
     ├── approve_payroll_run() ─────┤                           │
     │                              │                           │
     ├─── execute_payroll_run() ────┤                           │
     │                              │                           │
     │                              │      receives $5k USDC ◄─┤
     │                              │      receives $3k USDC ◄─┤
     │                              │                           │
     ▼                              ▼                           ▼
```

### Streaming Payment Flow

```
Sender (Company)               Payment Stream Contract        Recipient
     │                              │                           │
     ├─ create_stream(──────────────┤                           │
     │   alice, 100/s, max $500k)   │                           │
     │                              │                           │
     │                              │   every second:           │
     │                              │   earned += 100           │
     │                              │                           │
     │                              │◄─── withdraw($50k) ──────┤
     │                              │  transfer($50k) ─────────┤
     │                              │                           │
     ├── cancel_stream() ───────────┤                           │
     │                              │  transfer(remaining) ────┤
     │                              │                           │
     ▼                              ▼                           ▼
```

### Why Stellar?

| Factor | Traditional Banking | StellarPay |
|---|---|---|
| Settlement time | 3–5 business days | 2–5 seconds |
| Cost per payment | $15–$50 SWIFT | < $0.001 |
| Batch payments | Manual per-wire | One atomic transaction |
| Multisig | Separate banking portal | Built into smart contract |
| FX / currency | Bank spread (3–5%) | Stellar anchors (near spot) |
| Audit trail | PDF statements | On-chain, forever |
| Payment streaming | Not possible | Native via Soroban |

---

## SCF Grant Alignment

This project targets the **Stellar Community Fund (SCF) Build Award** — **Open Track**.

### Why SDF will fund this

| Priority | Alignment |
|---|---|
| **Cross-border payments** | SDF's #1 2026 priority — core to mission |
| **$1B asset value growth** | Every payroll run moves real value on Stellar assets |
| **15 enterprise partners** | B2B payroll is an enterprise sales motion |
| **Everyday financial services** | Payroll is the most universal financial service |
| **Soroban smart contracts** | Uses latest tech stack (Protocol 25) |
| **Multisig / compliance** | Enterprise-grade controls from day one |
| **Anchor integration** | Leverages Stellar's fiat on/off ramps |

### SCF Details

| Metric | Value |
|---|---|
| Award track | Open Track |
| Max award | $150K in XLM |
| Next deadline | June 14, 2026 (SCF #44) |
| Build timeline | 3–5 months (milestone-based) |
| Audit support | Free via SCF Audit Bank |

---

## Roadmap

### Phase 1 — MVP (current)
- [x] Payroll Manager contract with multisig approval
- [x] Payment Stream contract with per-second accrual
- [x] Backend API (Express + Stellar SDK)
- [x] Frontend dashboard (company + contractor views)
- [x] Deployment scripts + Docker

### Phase 2 — Production (next 3 months)
- [ ] Anchor integration (USDC, EURC on/off ramps)
- [ ] CSV/API batch contractor import
- [ ] Recurring payroll scheduling
- [ ] Email notifications for payment confirmations
- [ ] PDF pay stub generation
- [ ] Tax withholding calculation

### Phase 3 — Scale (months 4–6)
- [ ] Multi-currency auto-conversion via DEX
- [ ] SOC2-type compliance reporting
- [ ] Oracle integration for FX rates
- [ ] Mobile push notifications
- [ ] Treasury management dashboard
- [ ] Enterprise SSO (SAML/OIDC)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for full guidelines.

Quick summary:
1. Check open issues tagged `good first issue`
2. Branch from `develop`: `git checkout -b feat/your-feature`
3. Run `make check` before committing
4. Open a PR with a completed template

This project follows [Conventional Commits](https://www.conventionalcommits.org/):
```
feat: add batch CSV export for payroll runs
fix: correct escrow balance check on cancellation
docs: update API reference with new endpoints
test: add payment stream overflow edge cases
```

---

## License

MIT — see [LICENSE](LICENSE).

Built on the [Stellar network](https://stellar.org) with [Soroban smart contracts](https://soroban.stellar.org).
