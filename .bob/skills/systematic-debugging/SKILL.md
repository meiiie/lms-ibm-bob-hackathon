---
name: systematic-debugging
description: Diagnose failing tests, runtime errors or regressions by reproducing the issue, testing a hypothesis and verifying a focused fix. Use when a concrete defect is reported or a check fails.
---

# Debug with evidence

Capture the exact error, command, relevant environment and expected behavior.
Reduce the failure to the smallest reproduction that preserves it. Inspect the
boundary where observed behavior diverges from expectation, including logs,
input data and the relevant call path.

State a concrete hypothesis and a check that could disprove it. Change one causal
factor at a time. After two ineffective changes, gather new evidence or revisit
the hypothesis before continuing. Do not cycle through random dependency upgrades.

Make a focused fix. Re-run the original failing check and the nearby regression
checks justified by the change. For UI defects, reproduce through the actual UI,
not just a successful build or HTTP 200. Use the playwright-cli skill when useful.

Do not silence errors, remove assertions, hardcode fixture outputs, or widen
permissions to make a symptom disappear. Report root cause when supported,
commands and results, and what remains uncertain. Keep unrelated refactors out.
