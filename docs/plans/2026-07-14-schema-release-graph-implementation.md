# Schema Release Graph Implementation Plan

## Goal

Make Atlas migration chains a first-class staged release primitive in Juanie without requiring
changes in consuming repositories.

## Step 1: Contract and control-plane model

- Output: parser schema, release-stage types, specification/run columns, Atlas control-plane
  migration, and immutable run snapshots.
- Verify: parser tests, Atlas migration validation, TypeScript typecheck.

## Step 2: Resolution and orchestration

- Output: graph expansion into ordered pre/post specifications, deterministic phase scheduling,
  target-aware previews, and `--to-version` Atlas execution.
- Verify: resolver, phase progress, runner, and Atlas helper tests.

## Step 3: Release-level approval boundary

- Output: immutable release migration plan snapshots, canonical digests, one production approval,
  digest verification before execution, and fail-closed content resolution.
- Verify: digest, token scope, unreadable-preview, and four-stage single-approval tests.

## Step 4: Release read model

- Output: stage and target-version metadata in release migration cards and timeline descriptions.
- Verify: release view and timeline tests plus typecheck.

## Step 5: Delivery

- Output: focused commits in Juanie, a pushed branch, and resolved CI runs.
- Verify: GitHub Actions quality, image, and Juanie staging release jobs complete successfully.
