#!/usr/bin/env bash
# Copy the Anchor build's IDL + TS types into idl/ (committed) for server/app/sdk.
set -euo pipefail
cd "$(dirname "$0")/.."
cp target/idl/bulbul.json idl/bulbul.json
cp target/types/bulbul.ts idl/bulbul.ts
echo "synced idl/ from target/"
