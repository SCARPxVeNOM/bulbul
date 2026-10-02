# bulbul — let's go (shared build plan)

> **Two builders, two coding agents, one repo.** This file is the source of truth for scope, rules, ownership and status. Each agent should read it at the start of every session and update the **Status** checkboxes in the same PR as the work.
>
> **Deadline:** Colosseum Fall 2026 hackathon. Submission closes **2026-11-02**.

---

## 0. What we're building (one paragraph)

bulbul is a companion app where your companion **evolves only from commitments you actually keep, verified on Solana.** Users lock USDC in **goal vaults** (e.g. "iPhone 17 Pro, ₹1,50,000") and stake small amounts on **focus habits** (e.g. "30 min deep focus on 5 of the next 7 days"). Keeping commitments returns your money and earns XP. XP evolves a **soulbound Metaplex Core companion** that only the program can update. Missed stakes follow a rule the user chose: **Soft** (returned), **Charity** (donated) or **Pool** (bonuses for people who succeeded, disabled in restricted regions like India). The pitch: *"a companion whose growth is backed by real commitments."*

---

## 1. Rules for every contributor (human or agent)

### 1.1 The governing rule: ship complete, never thin
Every part ships **complete**: nothing thin, stubbed, mocked, placeholder or "MVP-depth." Build part by part, finishing each before starting the next. If time runs short, **drop a later part whole** and say so in this file. Never quietly thin something down. If something can't be done for real (missing API access, KYC, devnet gaps), **stop and flag it here** instead of faking it.

### 1.2 Definition of Done (a part is done only when all are true)
- [ ] On-chain logic has tests for the happy path, failure cases and unauthorized signers (LiteSVM in `programs/bulbul/tests/`)
- [ ] Runs on devnet (or a cloned-mainnet localnet where explicitly noted)
- [ ] The real UI is wired end to end, with no placeholder data
- [ ] Errors are handled at system boundaries (user input, RPC, external APIs)
- [ ] Demoed on an Android device or emulator, with screenshots in the PR
- [ ] README section written or updated
- [ ] All checks green (see §1.4)

### 1.3 Honesty rules
- **No fake art.** Companion stage art comes from the Blender renders. Until then the app shows an explicit "art hasn't been added yet" state.
- **No fake data or mocks in product code.** Test doubles are fine *inside tests only*.
- **State trust assumptions plainly.** The attestor key can only add focus check-ins. It can't move funds or edit companions. Keep that sentence true.
- **"Savings commitment, not betting"** framing everywhere. Pool mode stays region-gated by the program.

### 1.4 Checks before every PR
```bash
# program
anchor build && ./scripts/sync-idl.sh && cargo test -p bulbul
# server
cd server && npx tsc --noEmit && npm test && npm run test:e2e
# app
cd app && npx tsc --noEmit && npx expo lint && npx jest
```

### 1.5 Git workflow
- `main` is always green. Work on branches: `feat/<area>-<thing>` or `fix/<area>-<thing>`.
- One PR per part. The **other** person reviews and merges.
- **Never commit secrets:** keypairs, `.env`, `.localnet/`, `server/data/`, API keys. `.gitignore` covers these, but check `git status` before committing.
- Rebase on `main` before opening a PR. Resolve IDL conflicts by re-running `anchor build && ./scripts/sync-idl.sh`, never by hand-merging `idl/`.

### 1.6 Ownership (to avoid stepping on each other)
| Area | Owner | Rule |
|---|---|---|
| `programs/bulbul/**`, `idl/**`, devnet deploys, program upgrade authority | **A (Aryan)** | Only A changes the program and IDL. B requests program changes by opening an issue with the exact instruction/account spec. |
| `server/**` (attestor, Blinks Actions API, agent service) | **A** | B may add endpoints after agreeing on the request/response shape in the issue. |
| `sdk/**` | **A** | Shared client; the app consumes it. |
| `app/**` (all screens, wallet, Seeker, dApp Store) | **B (friend)** | A may fix app bugs found while testing program changes, in a separate PR. |
| `README.md`, `planletsgo.md` | both | Update your own sections and checkboxes. |
| Pitch video, deck, Colosseum submission | both | B leads visuals and demo; A leads the technical write-up. |

**Interface contract between A and B:** the **IDL** (`idl/bulbul.json` + `idl/bulbul.ts`) and the **server HTTP API** (§4.2). When A changes either, the PR description lists exactly what changed so B's agent can update the app.

---

## 2. Current architecture (already built)

```
programs/bulbul/   Anchor 1.2 program (Rust), SBPF v3, 46 tests (LiteSVM vs real SPL Token + Metaplex Core)
idl/               IDL + TS types, synced from the build by scripts/sync-idl.sh
server/            Hono + SQLite: Sign-In With Solana, focus sessions, attestor, companion metadata
                   29 unit tests + 3 e2e tests against a real solana-test-validator
app/               Expo SDK 57, React Native 0.86, expo-router, Mobile Wallet Adapter (@wallet-ui/react-native-web3js)
                   23 unit tests
scripts/           sync-idl.sh, localnet.sh (validator + config bootstrap + emulator port forwards)
```

**Program ID:** `5c7PXFMxkMc3kKsNHoafJb3phNhZoz6jt5qm57heRpGF` (the keypair is held by A; it's not in the repo).

### 2.1 On-chain accounts (PDAs)
| Account | Seeds | Purpose |
|---|---|---|
| `Config` | `["config"]` | admin, attestor, USDC mint, charity token account, pool vault, restricted regions, companion URI base, paused |
| `Profile` | `["profile", owner]` | **public reputation:** region (fixed at creation), xp, verified_saved_total, goals created/completed/broken, commitments created/succeeded/failed, companion asset, companion_stage |
| `GoalVault` | `["goal", owner, id_u32_le]` | name, target, deposited, created_at, unlock_at. Token vault at `["goal_vault", goal]` |
| `Commitment` | `["commitment", owner, id_u32_le]` | stake, focus_minutes, required_checkins, period_days (≤64), checkin_bitmap, mode. Escrow at `["escrow", commitment]` |
| Pool vault | `["pool"]` | USDC token account owned by the config PDA |
| Companion authority | `["companion_auth"]` | update authority of every companion asset |

### 2.2 Instructions
`initialize_config` (upgrade authority only) · `update_config` · `init_profile` · `create_goal` · `deposit_goal` · `complete_goal` (target reached + unlocked → payout + XP) · `break_goal` (always allowed, no XP) · `create_commitment` · `attest_checkin` (attestor only, one bit per day, no future days) · `settle_commitment` (permissionless; success refunds + XP + Pool bonus; failure routes by mode) · `mint_companion` · `evolve_companion` (permissionless sync of attributes + per-stage URI)

### 2.3 XP and stages
- Goal XP = `50 + min(target_usdc, 1000) × min(lock_days, 180) / 180`
- Commitment XP = `20 + 10 × checkins`
- Stages: Curious 0 · Focused 100 · Evolving 500 · Legendary 2000 (mirrored in `app/src/lib/stages.ts`)
- Pool bonus = `min(10% of pool, 20% of own stake)`

### 2.4 Hard-won gotchas (read before touching these areas)
- **Metaplex Core CPI is hand-encoded** in `core_cpi.rs`, because `mpl-core` pins Solana 2.x types that conflict with Anchor 1.2. Layouts come from mpl-core 0.12.1. Test against `tests/fixtures/mpl_core.so` (dumped from devnet).
- **LiteSVM must be ≥ 0.17** to load SBPF v3, which needs host rustc ≥ 1.97 (pinned in `rust-toolchain.toml`).
- **Hermes Buffer bug:** `subarray()` returns a plain `Uint8Array` on Hermes. `app/polyfill.js` patches both Buffer implementations. Don't remove it, or Anchor account decoding breaks.
- **MWA:** concurrent wallet associations cancel each other; `signIn` is de-duplicated. A signed message payload = message ‖ 64-byte signature.
- **Wallet cache hydration:** `WalletHydration` awaits the cached authorization before routing.
- **TypeScript 6** no longer auto-includes `@types/*`, so `app/tsconfig.json` lists `"types": ["jest"]`.
- **npm 11 blocks install scripts.** Approve only what's needed (`better-sqlite3`, `esbuild`); deny `bigint-buffer`, `bufferutil` and `utf-8-validate`. The app avoids `@solana/spl-token` entirely (see `app/src/lib/token.ts`).
- **React compiler lint rules:** no `Date.now()` in render. Use `useNow()` and pass `now` explicitly.

---

## 3. Local setup (each person)

```bash
# toolchains: rustup, Solana CLI (Anza installer), Anchor 1.2 via avm, Node 24, JDK 17, Android SDK + emulator
git clone https://github.com/SCARPxVeNOM/bulbul.git && cd bulbul
anchor build && ./scripts/sync-idl.sh
(cd server && npm install && cp .env.example .env)
(cd app && npm install && cp .env.example .env)

./scripts/localnet.sh                       # validator + config + adb reverse for 8899/8900/8787/8081
(cd server && npm run localnet)             # attestor server on :8787
(cd server && npm run faucet -- --admin ../.localnet/admin.json --to <WALLET>)
(cd app && npx expo run:android)            # dev build; Expo Go won't work (native MWA)
```
Test wallet on the emulator: `fakewallet-v1-release.apk` from the official `solana-mobile/mobile-wallet-adapter` GitHub releases. Inspect a wallet's on-chain state with `(cd server && npm run inspect -- --wallet <PUBKEY>)`.

---

## 4. Phase 1: core loop (#1 fusion, #2 Solana as the mechanic, #7 regulatory rails)

### 4.1 Status
- [x] Program: config, profile, goal vaults, commitments, forfeit modes, region gate, soulbound companion (46 tests)
- [x] Server: SIWS auth, focus sessions (server-timed, heartbeats, 90 s grace), attestor, metadata (29 + 3 e2e tests)
- [x] App: welcome, onboarding (region, terms, one-tx hatch), home, goals, goal detail, focus stakes, live session, evolution, profile, terms
- [x] On device: connect, hatch, create vault, deposit, create stake, **30-min focus session attested on-chain**
- [x] On device: settle the kept stake → 10 USDC refunded, +30 XP, `commitments_succeeded = 1`
- [x] On device: sync companion → asset attributes on-chain read `xp 30 · streaks_completed 1`
- [x] On device: break a vault → 300 USDC returned, vault closed, `goals_broken = 1`, no XP
- [x] **Devnet deploy:** program live on devnet (upgrade authority `4RPUao6SKAgbiidXaquzMqDSi37EbckVNfmzHUnSZeMM`), config bootstrapped with Circle devnet USDC `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`, devnet attestor `AmzESE3oRQB1ckWGJiCS8ckiBVDgawxaP69DGs7iPcfK`, restricted regions `IN`
- [x] Devnet on device (wallet signs **and sends**): hatch with region IN, Pool shown as unavailable
- [ ] Devnet on device: vault + stake + focus + settle (needs devnet USDC from faucet.circle.com) (A/B)
- [ ] `update_config` the companion URI base to the public server URL once it's hosted (A)
- [ ] **Deploy the server publicly over https on Railway** with a persistent volume for SQLite; set `PUBLIC_BASE_URL`; the app's `.env` points to it (A). Decided: Railway. Tested locally against devnet first (`npm run devnet` in `server/`).
- [ ] **Companion art:** 4 Blender renders → `server/assets/companion/{curious,focused,evolving,legendary}.png` (transparent, ≥1024 px). Also the app icon and splash, replacing Expo defaults (both)
- [ ] **Charity destination:** pick a real charity with a Solana USDC address (e.g. via Endaoment or The Giving Block) and set it with `update_config`. Devnet currently uses a deployer-owned account; disclose that in the README (A)
- [ ] Full Phase 1 demo recording on device (B)

### 4.2 Server HTTP API (the A↔B contract)
| Method & path | Auth | Body → Response |
|---|---|---|
| `POST /auth/challenge` | – | `{wallet}` → `{nonce, message}` |
| `POST /auth/verify` | – | `{wallet, nonce, signature(b58)}` → `{token, wallet}` (7-day JWT) |
| `GET /focus/active` | Bearer | → `{session \| null}` |
| `POST /focus/start` | Bearer | `{commitment}` → `{session}` 201 |
| `POST /focus/:id/heartbeat \| finish \| retry \| cancel` | Bearer | → `{session}` |
| `GET /companion/:stage.json \| .png` | – | Metaplex JSON / art (404 with a clear message if art is missing) |
| `GET /health` | – | `{ok, attestor, attestor_balance_sol, missing_art}` |

Session statuses: `active · broken · cancelled · too_short · attest_failed · attested`.

---

## 5. Phase 2: growth & money (#10 yield, #8 Blinks, #3 Seeker)

### 5.1 #10 Real yield on goal vaults (owner: A for program/server, B for UI)
**Goal:** idle vault USDC earns real lending yield, shown live on the Goal screen.
1. **Spike first (½ day):** which lending protocol (Kamino lend, MarginFi, Solend/Save) has a usable devnet deployment and a CPI-friendly interface? Write the findings in this section.
2. If none is usable on devnet: test against **mainnet state cloned into localnet** (`solana-test-validator --clone-upgradeable-program <lending program> --clone <reserve accounts> --url mainnet-beta`). That's real code paths, not a mock. Devnet then runs without yield, and the README says so.
3. Program: `GoalVault` gains `yield_enabled: bool` and `collateral` fields. New instructions `enable_yield(goal)` (moves vault USDC into the reserve via CPI; the vault PDA holds the receipt tokens) and an internal redeem path used by `complete_goal` and `break_goal`. **XP and verified savings count principal only**; yield goes to the user on payout.
4. Tests: deposit → yield on → time passes (warp) → complete returns principal + interest; break also redeems; a wrong reserve account is rejected.
5. App: an "Earn yield on this vault" toggle with an honest APY source label, accrued yield shown, and risk copy (smart-contract risk of the lending protocol).

### 5.2 #8 Blinks: viral challenges (owner: A for program/server, B for UI/sharing)
**Goal:** friends join a challenge or cheer a goal straight from X/Telegram via a Blink, with no app install.
1. Program additions:
   - `Challenge` PDA `["challenge", creator, id]`: focus_minutes, required_checkins, period_days, stake per member, max members (≤16), mode (Soft/Charity/Pool, with the region gate checked **per member**), start time.
   - `join_challenge` creates the member's `Commitment` linked to the challenge (stake escrowed as today).
   - `settle_challenge`: kept members get their stake back, and missed stakes are split equally among members who kept it (Pool semantics; members in restricted regions can only join Soft/Charity challenges).
   - `cheer_goal(goal, amount)`: anyone can add USDC to someone's vault. Tracked as `gifted` on `GoalVault`, **not** counted in the owner's `verified_saved_total` or XP.
2. Server: Solana Actions API: `GET /actions.json` (domain root), `GET|POST /api/actions/challenge/:pubkey` (join), `GET|POST /api/actions/cheer/:goal` (amount options + custom). The POST returns a base64 transaction for the user's wallet to sign. CORS headers per the Actions spec.
3. Tests: program tests for join/settle/cheer, including the restricted-region case; server tests for Action metadata and transaction building; manual check on **dial.to** and on X.
4. App: a "Create challenge" flow, "Share as Blink" (copies the link), challenge detail with member progress, and "Cheered by friends" on goals.

### 5.3 #3 Solana Mobile / Seeker (owner: B)
**Goal:** a Seeker-native app, published on the Solana dApp Store.
1. **Domain + Digital Asset Links:** serve `/.well-known/assetlinks.json` from the app's https domain so wallets show bulbul as **verified** (currently "Verification failed"). Change `EXPO_PUBLIC_APP_URL` from `bulbul://app` to the https domain.
2. Production `.env`: `EXPO_PUBLIC_TX_SUBMIT=wallet` (the wallet signs and sends; MWA best practice). Test with the Seed Vault wallet on a Seeker if one is available, otherwise Phantom/Solflare on Android.
3. A signed release APK via EAS or a local Gradle `assembleRelease`, with the keystore stored outside the repo.
4. dApp Store: `@solana-mobile/dapp-store-cli`: publisher NFT, app NFT, release NFT, listing assets (icon, banner, ≥4 screenshots, description, privacy policy URL).
5. Done when: installed from the dApp Store on a real device, and the wallet shows the app as verified.

---

## 6. Phase 3: differentiators (#4 AI agent, #5 composability, #6 India, #9 SDK)

### 6.1 #4 AI forecasting agent with bounded on-chain power (owner: A, UI by B)
**Goal:** an agent that *acts*, not just chats: it forecasts goal dates from spending and can auto-top-up a vault within limits the user set on-chain.
1. Program: `AgentPolicy` PDA `["agent", owner]`: agent pubkey, daily limit (USDC), allowed goals, expiry, revoked flag. `set_agent_policy`, `revoke_agent`. `agent_deposit(goal, amount)`: signed by the agent key; moves USDC from the owner's token account using an SPL `approve` delegation the owner granted; enforces the daily limit (rolling window stored on the PDA) and the goal allowlist.
2. Tests: within limit ✓; over the daily limit ✗; revoked ✗; expired ✗; a goal not on the allowlist ✗; a non-agent signer ✗.
3. Server agent: reads the user's recent outgoing USDC/SOL transfers (Solana Pay and plain transfers), categorizes spending, projects the goal completion date, and proposes or executes top-ups. LLM provider and model are the owner's choice; prompts and responses are logged server-side for debugging and never written on-chain.
4. App: an "Insights" screen in the mockup style ("Higher food spending might delay your goal by 4 days"), an agent permissions screen (limit, goals, revoke), and an activity log of agent actions with tx links.

### 6.2 #5 Composable reputation (owner: A)
1. `Profile` is already public. Document its byte layout in the README.
2. SDK `getReputation(connection, wallet)` → `{xp, stage, verifiedSaved, goalsCompleted, streaksKept, streaksMissed}`.
3. A **working third-party consumer**: a "Verified Saver" Blink challenge that only allows joining when `verified_saved_total ≥ X`, enforced in the program by reading the joiner's `Profile`.

### 6.3 #6 India Gen-Z segment (owner: B, Pyth reads by A if on-chain)
1. ₹ display alongside USDC via a **Pyth USD/INR** price feed (Hermes pull API in the app; label the rate source and time).
2. Goal templates: iPhone (₹1,50,000), laptop, course fees, trip. These are template amounts only; users can edit them.
3. **INR onramp spike:** Onramp.money, Transak or similar. Needs partner or KYC access. **If access isn't obtainable before 2026-10-25, flag it here and drop it**; don't fake an onramp screen.
4. Copy review for Indian users (₹ formatting `1,50,000`, lakh/crore display).

### 6.4 #9 `@bulbul/sdk` (owner: A)
1. `sdk/` package: PDAs, typed account fetchers, instruction builders (move `app/src/lib/program.ts` + `actions.ts` + `token.ts` here; the app and server import from the SDK).
2. `getReputation`, Actions helpers, docs (`sdk/README.md`), and `examples/` (a Node script that reads a profile and builds a cheer transaction).
3. Tests: unit tests plus one e2e test against localnet.

---

## 7. Timeline (today is 2026-10-02)

| Dates | A (program / server / sdk) | B (app / mobile / design) |
|---|---|---|
| **Oct 2–5** | Devnet deploy, public server + https, charity decision | Finish Phase 1 device tests (settle, evolve, break), integrate art when ready, app icon |
| **Oct 6–12** | #10 yield spike + program + tests; #8 program (challenge, cheer) + tests | #3 domain + assetlinks, release build, dApp Store prep; #10 UI |
| **Oct 13–19** | #8 Actions API; #9 SDK extraction | #8 UI + sharing; Phase 2 device demo |
| **Oct 20–26** | #4 AgentPolicy program + tests; agent service; #5 reputation gate | #6 ₹ + templates + onramp spike (decide by Oct 25); #4 Insights + permissions UI |
| **Oct 27–31** | Hardening, devnet redeploy, README/tech write-up | dApp Store submission, demo video, screenshots, deck |
| **Nov 1–2** | Final checks, submit | Final checks, submit |

If a phase slips, **drop the last item of Phase 3 whole** (in order: #6 onramp → #9 examples → #5 gate → #4 auto-execute), and record the decision here.

---

## 8. Submission checklist (both)
- [ ] Pitch video (2–3 min): lead with the vault → stake → check-in → evolve loop, all on-chain
- [ ] Product demo video (≤3 min) recorded on a device
- [ ] Devnet program ID, server URL, dApp Store link (if live)
- [ ] README: architecture, the attestor trust assumption, the regulatory framing, known limitations
- [ ] Deck: problem, why Solana (cheap daily settlement, cNFT-scale companions, Seeker distribution), traction/demo, roadmap
- [ ] Submitted on Colosseum before 2026-11-02

---

## 9. Open decisions (record answers here)
- [x] Hosting provider for the server: **Railway** (persistent volume for SQLite)
- [ ] Domain name (needed for #3 asset links and #8 Blinks)
- [ ] Charity partner and its Solana USDC address
- [ ] Lending protocol for #10 (after the spike)
- [ ] INR onramp provider (after the spike, by Oct 25)
- [ ] LLM provider and model for #4
