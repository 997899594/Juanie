# ADR-0006: Pin Repository Package Manager Execution

## Status

Accepted

## Context

Juanie itself uses Bun, but imported repositories may use Bun, npm, pnpm, or Yarn. Schema repair
previously guessed the package manager from whichever lockfile it found first and called globally
available commands. The schema-runner image did not provide every guessed command, versions were not
pinned, and ambiguous repositories could execute a different tool than their declared build contract.

Schema repair executes repository dependency lifecycle scripts and therefore crosses a supply-chain
boundary. Selection must be deterministic, reviewable, isolated to the ephemeral Job, and unable to
silently rewrite a lockfile with another package manager.

## Decision

- Keep Bun as the runtime for every Juanie platform component.
- Declare Juanie's own package manager as exact `bun@1.3.14`, aligned with CI and runtime images.
- Require Drizzle repair repositories to declare an exact `packageManager` value in root
  `package.json` using `bun`, `npm`, `pnpm`, or `yarn`.
- Require exactly one matching root lockfile and reject missing or conflicting lockfiles.
- Use fixed Node 24 LTS and Corepack 0.34.5 only inside the ephemeral schema-runner to fetch and
  execute the declared npm, pnpm, or Yarn version. Use `bun x --package bun@<version>` for declared
  Bun versions. Long-running Juanie processes and images remain Bun-only.
- Run immutable/frozen installation and execute the repository-installed Drizzle CLI through the
  same declared package manager.
- Render repository-derived Drizzle config paths as inert shell literals before executing the
  generated repair script.
- Reject ranges, mutable tags, unknown managers, malformed package metadata, and fallback guessing.

## Consequences

### Positive

- Existing repositories keep their own package-manager semantics without expanding Juanie's runtime
  stack.
- Every repair run is tied to an exact package-manager version and one authoritative lockfile.
- The schema-runner image carries one pinned foreign-repository toolchain instead of four mutable
  global CLIs; no Node runtime enters long-running platform images.
- Unsupported repositories fail before dependency installation or lifecycle scripts execute.

### Negative

- Legacy repositories without `packageManager@exact-version` must add it before automatic Drizzle
  repair can run.
- First use of a package-manager version downloads it into the ephemeral Job cache.

### Neutral

- Atlas and non-Drizzle repair paths do not require a JavaScript package-manager contract.
- Normal application builds continue using the package manager recorded during repository analysis.

## Alternatives Considered

**Force every imported repository to use Bun**

Rejected because it changes user lockfiles and conflicts with Juanie's import-first product model.

**Guess from lockfiles and install every CLI globally**

Rejected because selection is ambiguous, versions drift, and the permanent image attack surface grows.

**Run every CLI through `bun x`**

Rejected because cold npm resolution was materially slower, while Corepack is purpose-built for
versioned package-manager dispatch.

## References

- Design: `docs/plans/2026-07-20-repository-package-manager-execution-design.md`
- Runtime artifact generator: `src/lib/schema-management/review-request-helpers.ts`
- Package-manager contract: `src/lib/package-manager/contract.ts`
