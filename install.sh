#!/bin/sh
set -eu

for command in node npm git; do
  if ! command -v "$command" >/dev/null 2>&1; then
    printf 'Sillage nécessite %s dans le PATH.\n' "$command" >&2
    exit 1
  fi
done

if ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)'; then
  printf 'Sillage nécessite Node.js 22 ou plus récent.\n' >&2
  exit 1
fi

npm install -g github:GhosTHaise/social-network-block-cli-rotating
printf '\nSillage installé. Lancez « sillage » depuis votre terminal.\n'
