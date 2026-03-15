#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")"; pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.."; pwd)"
CORE_DIR="$(cd "$PROJECT_ROOT/../core"; pwd)"

echo "=== Building Android LSP Extension ==="

LSP_ZIP_PATH="${LSP_ZIP_PATH:-$CORE_DIR/kotlin-lsp-standalone/mac-arm64/kotlin-lsp-262.1817.0-mac-x64.zip}"

if [[ ! -f "$LSP_ZIP_PATH" ]]; then
    echo "Error: LSP zip not found at $LSP_ZIP_PATH"
    exit 1
fi

echo "Using LSP from: $LSP_ZIP_PATH"

cd "$SCRIPT_DIR"

echo "Installing dependencies..."
npm install

echo "Compiling TypeScript..."
npm run compile

echo "Unpacking LSP server..."
export LSP_ZIP_PATH
npm run unpack-server

echo "Build complete!"
echo "Extension is ready at: $SCRIPT_DIR"
