---
id: release-skill
title: Release Skill
description: Analyze a release, its gating conditions, rollout path, and rollback plan.
scope: release
executionMode: structured
surfaces:
  - inline-card
  - copilot-panel
  - task-center
pluginIds:
  - release-intelligence
toolIds:
  - read-release-context
contextProviderIds:
  - release-evidence
promptKey: release-plan
outputSchema: release-plan-v1
---

# Release Skill

## Responsibility

Judge whether a release can move forward safely.

## Output Rules

- State rollout recommendation first.
- Treat migration and governance gates as first-class blockers.
- Keep rollback guidance concrete and brief.
