# bulbul

A companion that evolves **only** from commitments you actually keep, verified on Solana.

bulbul turns savings goals and focus habits into on-chain commitments. Lock USDC toward a goal, stake a little on a focus habit, and your soulbound companion evolves as the program records what you completed. Built for the Colosseum Fall 2026 hackathon.

## How it works

| Piece | What it does |
| --- | --- |
| **Goal vaults** | USDC held by a program-owned vault until you reach your target *and* the lock date passes. Completing awards XP scaled by amount × lock time. Breaking early returns everything, with no XP. |
| **Habit stakes** | Stake on "N minutes of focus on K of the next D days". Each kept day is recorded as a check-in bit on-chain. Keep it and your stake comes back with XP. |
| **Forfeit modes** | **Soft** (stake returns), **Charity** (donated), **Pool** (funds bonuses for people who succeed). Pool is disabled by the program for restricted regions (India by default). |
| **Companion** | A soulbound Metaplex Core asset whose update authority is a program PDA. Only `evolve_companion` can change it, and only from on-chain XP. Owners can't transfer it or edit its attributes; both are covered by tests. |
| **Reputation** | `Profile` (XP, verified savings, goals completed, streaks kept or missed) is a public account any app can read. |

### Trust assumption (stated plainly)

Focus check-ins are signed by bulbul's **attestor key** after the server verifies a continuous in-app session (server-side timing with heartbeats; leaving the app for more than 90 s breaks the session). The attestor can **only** add check-ins. It cannot move funds, change stake rules, or edit companions, and the program rejects any other signer. Session data stays off-chain; only "day N checked in" goes on-chain. Savings goals need no attestor because the deposits themselves are on-chain.

## Repo layout

```
programs/bulbul/   Anchor 1.2 program (Rust) + LiteSVM integration tests
idl/               IDL + TS types (synced from the build, shared by server and app)
server/            Hono server: Sign-In With Solana, focus sessions, attestor, companion metadata
app/               Expo SDK 57 React Native app (Android-first, Mobile Wallet Adapter)
scripts/           sync-idl.sh, localnet.sh
```

## Program

```bash
anchor build && ./scripts/sync-idl.sh
cargo test -p bulbul        # 46 tests: unit + LiteSVM against real SPL Token and Metaplex Core
```

Instructions: `initialize_config` (program upgrade authority only), `update_config`, `init_profile`, `create_goal`, `deposit_goal`, `complete_goal`, `break_goal`, `create_commitment`, `attest_checkin`, `settle_commitment` (permissionless), `mint_companion`, `evolve_companion` (permissionless).

Notes:
- Anchor 1.2 builds SBPF v3. Tests use LiteSVM 0.17, which needs rustc ≥ 1.97 on the host (pinned in `rust-toolchain.toml`). The on-chain build uses platform-tools' own compiler.
- Metaplex Core is called through a small hand-encoded CPI (`core_cpi.rs`) because the `mpl-core` crate pins Solana 2.x types, which conflict with Anchor 1.2. The layouts come from mpl-core 0.12.1's generated code, and the tests run against the real Core program binary.

## Server

```bash
cd server
npm test                 # 29 unit tests (auth, focus rules, HTTP)
npm run test:e2e         # boots solana-test-validator with the real program; attests on-chain
cp .env.example .env     # then: npm run dev
```

Endpoints: `POST /auth/challenge`, `POST /auth/verify` (SIWS → 7-day JWT), `GET /focus/active`, `POST /focus/start|:id/heartbeat|:id/finish|:id/retry|:id/cancel`, `GET /companion/:stage.json|png`, `GET /health`.

## App

```bash
cd app
cp .env.example .env
npx expo run:android     # dev build (Mobile Wallet Adapter needs native code; Expo Go won't work)
npx tsc --noEmit && npx expo lint
```

## Local end-to-end

```bash
./scripts/localnet.sh                          # validator + config + emulator port forwards
(cd server && npm run localnet)                # attestor server on :8787
(cd server && npm run faucet -- --admin ../.localnet/admin.json --to <WALLET>)
(cd app && npx expo run:android)
```

Install Solana Mobile's test wallet on the emulator: `fakewallet-v1-release.apk` from the official [mobile-wallet-adapter releases](https://github.com/solana-mobile/mobile-wallet-adapter/releases).

## Status

Phase 1 (fusion, Solana as the mechanic, regulatory rails) is in progress. Open items:
- **Companion art** for the four stages is being designed by the author. Until it's added to `server/assets/companion/{curious,focused,evolving,legendary}.png`, the app and `/health` report it as missing rather than showing stand-in art.
- **Devnet deploy** is waiting on devnet SOL for the deployer.
- **Charity destination**: on devnet the charity account is owned by the deployer. A real charity partner's address is required before mainnet.

### Known dependency advisories

`npm audit` reports advisories in transitive dependencies. The app avoids `@solana/spl-token` entirely (its `bigint-buffer` dependency has a buffer-overflow advisory) by hand-writing the three token operations it needs. The remaining high findings are `toml` inside `@anchor-lang/core`'s Node workspace helpers, which the app never calls at runtime. The moderates are in Expo build tooling, where the only fix offered is a forced downgrade.
