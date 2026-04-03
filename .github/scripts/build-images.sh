#!/usr/bin/env bash

set -euo pipefail

export REGISTRY="${REGISTRY:?REGISTRY is required}"
export IMAGE_NAME="${IMAGE_NAME:?IMAGE_NAME is required}"
export GITHUB_SHA="${GITHUB_SHA:?GITHUB_SHA is required}"
export CACHE_SCOPE="${CACHE_SCOPE:-juanie-images}"
export PLATFORM="${PLATFORM:-linux/amd64}"

echo "Building release images via bake graph..."
docker buildx bake --file docker-bake.hcl --push
