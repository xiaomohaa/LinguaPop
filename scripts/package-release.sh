#!/usr/bin/env bash
set -euo pipefail

version="${1:-}"
if [[ -z "$version" ]]; then
  version="$(node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('manifest.json', 'utf8')).version)")"
fi

mkdir -p dist
zip -r "dist/linguapop-${version}.zip" manifest.json src -x "*.DS_Store"
