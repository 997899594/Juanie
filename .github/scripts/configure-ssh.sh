#!/usr/bin/env bash

set -euo pipefail

mkdir -p ~/.ssh
printf '%s\n' "${SSH_PRIVATE_KEY:?SSH_PRIVATE_KEY is required}" > ~/.ssh/id_ed25519
chmod 600 ~/.ssh/id_ed25519
ssh-keyscan -H "${SERVER_HOST:?SERVER_HOST is required}" >> ~/.ssh/known_hosts
