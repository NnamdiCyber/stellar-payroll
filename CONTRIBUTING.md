# Contributing to StellarPay

First off, thanks for taking the time to contribute! 🚀

## Code of Conduct

This project adheres to the [Contributor Covenant](CODE_OF_CONDUCT.md).
By participating you agree to uphold this code.

## How to Contribute

### 1. Find or Create an Issue

- Look for issues tagged `good first issue` or `help wanted`
- Comment on the issue to let others know you're working on it
- For new features, open an issue first to discuss the design

### 2. Set Up Locally

```bash
git clone https://github.com/your-org/stellar-payroll.git
cd stellar-payroll

# Smart contracts
cd contracts/payroll-manager
cargo build --target wasm32-unknown-unknown --release
cargo test

# Backend
cd ../../backend
cp .env.example .env
npm install
npm run dev

# Frontend
cd ../frontend
npm install
npm run dev
```

### 3. Create a Branch

```
git checkout -b feat/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 4. Make Changes

- Follow existing code style (run linters before committing)
- Keep changes focused — one feature/fix per PR
- Add tests for new functionality
- Update documentation if needed

### 5. Run Checks

```bash
make check       # runs all linters and type checks
make test        # runs all tests (contracts + backend + frontend)
```

### 6. Commit

Use conventional commit messages:

```
feat: add batch payroll CSV export
fix: correct escrow balance check on cancel
docs: update deployment section in README
test: add payroll run approval edge cases
chore: bump soroban-sdk to 21.0.1
```

### 7. Open a Pull Request

- Fill out the PR template completely
- Link the related issue(s)
- Ensure CI passes
- Request review from a maintainer

## Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready, protected |
| `develop` | Integration branch for features |
| `feat/*` | New features (merge to develop) |
| `fix/*` | Bug fixes (merge to develop) |
| `release/*` | Release candidates (merge to main) |

## Code Standards

### Rust
- Run `cargo fmt` and `cargo clippy` before committing
- All public functions must have doc comments
- Tests go in the same file using `#[cfg(test)]`

### TypeScript
- Run `npm run lint` in both backend/ and frontend/
- Use strict TypeScript — avoid `any` where possible
- Use Zod schemas for all API input validation

### General
- No commented-out code
- No console.log in production code (use the logger)
- Keep functions under 50 lines where reasonable
- Use meaningful variable names — avoid abbreviations

## Need Help?

- Open a [Discussion](https://github.com/your-org/stellar-payroll/discussions)
- Join the [Stellar Dev Discord](https://discord.gg/stellardev)
- Check the [SCF Handbook](https://stellar.gitbook.io/scf-handbook)
