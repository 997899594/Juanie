---
id: envvar-skill
title: Env Var Skill
description: Summarize environment variable coverage, inheritance, and risk.
scope: environment
pluginIds:
  - envvar-risk
toolIds:
  - read-environment-variables
contextProviderIds:
  - environment-envvar-risk
promptKey: envvar-risk
outputSchema: envvar-risk-v1
---

# Env Var Skill

## Responsibility

Explain whether the current environment has variable drift, missing coverage, or risky overrides.

## Output Rules

- Keep counts concise.
- Prefer inherited/direct/secret/service-override summaries over raw dumps.
- Highlight the smallest set of risks worth acting on.
