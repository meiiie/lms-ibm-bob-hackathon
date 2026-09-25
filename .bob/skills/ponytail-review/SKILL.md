---
name: ponytail-review
description: Review a diff for avoidable complexity, dead flexibility, redundant dependencies and opportunities to use stdlib or native features. Use when asked to simplify or review for over-engineering.
---

# Ponytail review

Adapted from the user's local Ponytail Review instructions.
Inspect the current diff and enough surrounding code to understand its callers.
Find concrete complexity that can be removed while preserving the requirements.

Report each finding as `file:line — category: unnecessary element; simpler replacement`.
Categories: delete, stdlib, native, yagni, shrink. Prioritize substantive maintenance
savings over fewer characters. Do not recommend deletion without checking uses.

This pass reviews complexity, not correctness. Do not remove validation, accessibility,
required hackathon evidence, useful error handling, or the minimal behavior checks.
Do not weaken checks simply to reduce lines. Avoid rewriting unrelated modules.

List suggested changes; apply them only when asked. Estimate line savings only if
you actually inspected enough code to count them. If no substantive issue is found,
say so and stop. A normal correctness review remains necessary for risky changes.
