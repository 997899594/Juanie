# Schema Release Graph Implementation Plan

## Goal

Make Atlas migration chains a first-class staged release primitive and migrate NexusNote from
Drizzle desired-state push to a versioned Atlas bundle.

## Step 1: Contract and control-plane model

- Output: parser schema, release-stage types, specification/run columns, Atlas control-plane
  migration, and immutable run snapshots.
- Verify: parser tests, Atlas migration validation, TypeScript typecheck.

## Step 2: Resolution and orchestration

- Output: graph expansion into ordered pre/post specifications, deterministic phase scheduling,
  target-aware previews, and `--to-version` Atlas execution.
- Verify: resolver, phase progress, runner, and Atlas helper tests.

## Step 3: Release read model

- Output: stage and target-version metadata in release migration cards and timeline descriptions.
- Verify: release view and timeline tests plus typecheck.

## Step 4: NexusNote migration bundle

- Output: `atlas.hcl`, a checksummed migration chain with expand/backfill/verify/contract boundaries,
  and a `juanie.yaml` release graph using `schema.source=atlas`.
- Verify: Atlas directory validation, local migration rehearsal against the current development
  database, NexusNote lint/typecheck/build.

## Step 5: Delivery

- Output: focused commits in Juanie and NexusNote, pushed branches, and resolved CI runs.
- Verify: GitHub Actions quality, image, and Juanie staging release jobs complete successfully.
