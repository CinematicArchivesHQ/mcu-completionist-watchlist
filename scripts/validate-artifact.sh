#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
index="${project_root}/out/index.html"

[[ -f "${index}" ]] || {
  echo "Missing GitHub Pages static entry: out/index.html" >&2
  exit 66
}

grep -Fq '/mcu-completionist-watchlist/_next/' "${index}" || {
  echo "Static export is missing the GitHub Pages repository base path." >&2
  exit 66
}

[[ -f "${project_root}/out/manifest.webmanifest" ]] || { echo "Missing PWA manifest in static export." >&2; exit 66; }
[[ -f "${project_root}/out/service-worker.js" ]] || { echo "Missing service worker in static export." >&2; exit 66; }

echo "Validated GitHub Pages static export, repository base path, manifest, and service worker."
