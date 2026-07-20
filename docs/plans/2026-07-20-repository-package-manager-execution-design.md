# Repository Package Manager Execution Design

## Requirements

- Juanie platform processes continue to run on Bun.
- Imported Drizzle repositories retain Bun, npm, pnpm, or Yarn semantics.
- Package-manager selection and version are authoritative, immutable, and code-driven.
- Schema repair never guesses from lockfile order or falls back to mutable global commands.
- Dependency installation remains inside the short-lived schema-runner Job and keeps lockfiles frozen.

## Architecture

The root `package.json#packageManager` field is the execution identity. A pure contract parser accepts
only supported names with exact semantic versions and optional Corepack integrity hashes. It then
checks the root directory for exactly one matching lockfile. This validation occurs after the source
archive is materialized but before runtime repair artifacts or dependency lifecycle scripts execute.

Validated Bun repositories receive a Bash command array backed by `bun x --package bun@<version>`.
Validated npm, pnpm, and Yarn repositories receive a command array backed by fixed Node 24 LTS and
Corepack in the ephemeral schema image. The same array performs frozen installation and invokes the
repository-installed `drizzle-kit`; no global Drizzle version is introduced. Yarn 1 uses
`--frozen-lockfile`, while modern Yarn uses `--immutable`. Node is foreign-repository tooling and is
not copied into any long-running Juanie image.

The schema-runner image adds only Corepack 0.34.5 to its existing isolated tool dependencies. Image
smoke verifies the Bun, Corepack, and Atlas entry points. Unit contracts cover accepted declarations,
invalid ranges/tags, missing and conflicting locks, launcher rendering, and fail-closed behavior.

## Failure Model

Malformed JSON, a missing declaration, a mutable version, an unsupported manager, a missing lockfile,
or multiple package-manager lockfiles terminates the repair before installation. Package-manager
download, frozen install, Drizzle export, and Atlas diff failures keep the existing schema repair run
failure projection and clipped operator logs. No fallback manager is attempted.

## Non-Functional Requirements

- Security: whitelist package names; exact versions; immutable install; shell-quote repository paths;
  no shell interpolation of unvalidated values.
- Reliability: deterministic selection and fail-closed behavior; existing durable Job retry boundary.
- Maintainability: one shared parser and one pinned dispatcher rather than manager-specific image
  installations.
- Cost: first-use network download per ephemeral Job; no permanently duplicated package-manager
  runtimes.
