#!/usr/bin/env bash
# Local end-to-end stack: validator (bulbul + Metaplex Core) + config bootstrap + emulator port forwards.
# The server is started separately: (cd server && npm run dev) with server/.env.localnet copied to .env.
set -euo pipefail
cd "$(dirname "$0")/.."

SOLANA_BIN="$HOME/.local/share/solana/install/active_release/bin"
ADB="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}/platform-tools/adb"
STATE=".localnet"
mkdir -p "$STATE"

[ -f target/deploy/bulbul.so ] || { echo "run 'anchor build' first"; exit 1; }
[ -f "$STATE/admin.json" ] || "$SOLANA_BIN/solana-keygen" new --no-bip39-passphrase -s -o "$STATE/admin.json" >/dev/null
[ -f "$STATE/attestor.json" ] || "$SOLANA_BIN/solana-keygen" new --no-bip39-passphrase -s -o "$STATE/attestor.json" >/dev/null
ADMIN=$("$SOLANA_BIN/solana-keygen" pubkey "$STATE/admin.json")
ATTESTOR=$("$SOLANA_BIN/solana-keygen" pubkey "$STATE/attestor.json")
PROGRAM_ID=$(node -p "require('./idl/bulbul.json').address")

if ! curl -s -X POST -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' http://127.0.0.1:8899 | grep -q ok; then
  echo "starting validator…"
  nohup "$SOLANA_BIN/solana-test-validator" --reset --quiet --ledger "$STATE/ledger" \
    --mint "$ADMIN" \
    --upgradeable-program "$PROGRAM_ID" target/deploy/bulbul.so "$ADMIN" \
    --bpf-program CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d programs/bulbul/tests/fixtures/mpl_core.so \
    > "$STATE/validator.log" 2>&1 &
  until curl -s -X POST -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' http://127.0.0.1:8899 | grep -q ok; do sleep 1; done
fi

"$SOLANA_BIN/solana" airdrop 10 "$ATTESTOR" -u localhost >/dev/null

(cd server && npx tsx scripts/bootstrap.ts \
  --rpc http://127.0.0.1:8899 --admin "../$STATE/admin.json" --attestor "$ATTESTOR" \
  --uri-base http://127.0.0.1:8787/companion --restricted IN --out "../$STATE/config.json")

if "$ADB" get-state >/dev/null 2>&1; then
  for port in 8899 8900 8787 8081; do "$ADB" reverse "tcp:$port" "tcp:$port" >/dev/null; done
  echo "emulator ports forwarded (8899 rpc, 8900 ws, 8787 server, 8081 metro)"
fi

cat > server/.env.localnet <<EOF
RPC_URL=http://127.0.0.1:8899
ATTESTOR_KEYPAIR_PATH=../$STATE/attestor.json
JWT_SECRET=$(openssl rand -hex 32)
PUBLIC_BASE_URL=http://127.0.0.1:8787
DATABASE_PATH=./data/localnet.db
EOF
echo
echo "localnet ready. Fund a wallet with:"
echo "  (cd server && npx tsx scripts/faucet.ts --admin ../$STATE/admin.json --to <WALLET>)"
