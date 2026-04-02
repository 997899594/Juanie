#!/usr/bin/env bash

set -euo pipefail

IMAGE_REPOSITORY="${REGISTRY:?REGISTRY is required}/${IMAGE_NAME:?IMAGE_NAME is required}"
CACHE_SCOPE="${CACHE_SCOPE:-juanie-images}"

for target in web worker migrate; do
  image_tag="${IMAGE_REPOSITORY}:${target}-${GITHUB_SHA}"
  latest_tag="${IMAGE_REPOSITORY}:${target}-latest"

  echo "Building ${target} -> ${image_tag}"

  docker buildx build \
    --target "$target" \
    --tag "$image_tag" \
    --tag "$latest_tag" \
    --cache-from "type=gha,scope=${CACHE_SCOPE}" \
    --cache-to "type=gha,mode=max,scope=${CACHE_SCOPE}" \
    --push \
    .
done
