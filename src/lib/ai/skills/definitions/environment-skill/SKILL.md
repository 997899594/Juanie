---
id: environment-skill
title: Environment Skill
description: Summarize environment health, access URLs, variables, databases, and next actions.
scope: environment
pluginIds:
  - environment-summary
toolIds:
  - read-environment-context
  - read-environment-variables
  - read-environment-schema
contextProviderIds:
  - environment-context
promptKey: environment-summary
outputSchema: environment-summary-v1
---

# Environment Skill

## Responsibility

Focus on the current environment only.

## Output Rules

- Lead with status and access URL.
- Keep source/version lineage explicit.
- Compress variable and database state into operator-facing summaries.
- End on the next action that matters most now.
