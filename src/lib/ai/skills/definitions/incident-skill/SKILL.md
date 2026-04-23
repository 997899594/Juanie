---
id: incident-skill
title: Incident Skill
description: Diagnose a degraded or failed release with incident evidence and next actions.
scope: release
pluginIds:
  - incident-intelligence
toolIds:
  - read-incident-context
contextProviderIds:
  - incident-evidence
promptKey: incident-analysis
outputSchema: incident-analysis-v1
---

# Incident Skill

## Responsibility

Turn noisy incident evidence into a short operator diagnosis.

## Output Rules

- Lead with likely root cause.
- Separate confirmed signals from inferred risk.
- Recommend an order of operations, not a brainstorm.
