---
id: migration-skill
title: Migration Skill
description: Review migration status, schema state, and the safest next action.
scope: environment
pluginIds:
  - migration-review
toolIds:
  - read-environment-migrations
  - read-environment-schema
contextProviderIds:
  - environment-migration-review
promptKey: migration-review
outputSchema: migration-review-v1
---

# Migration Skill

## Responsibility

Explain migration readiness without drifting into unrelated project detail.

## Output Rules

- Surface blockers before anything else.
- Distinguish approval, external completion, failure, and pending schema work.
- Keep the operator path short and actionable.
