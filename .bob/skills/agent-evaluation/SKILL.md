---
name: agent-evaluation
description: Design and run small, reproducible evaluations for an AI developer-workflow prototype. Use when comparing baseline versus agent-assisted work, measuring reliability or preparing evidence of impact.
---

# Evaluate observable outcomes

Specify the user task and success conditions before running the agent. Start with
3–5 representative hackathon cases including the critical failure boundary;
this is a local time-budget choice, not a claim of statistical significance.

Use permitted synthetic/public inputs. Keep repo commit, fixture and environment
fixed across baseline and assisted trials. Prefer executable assertions for facts
such as test results, file contents, API output and completed workflow state.
Grade final outcomes, not the agent saying it finished. Use human judgment for
subjective usefulness and design; do not treat an LLM's praise as correctness.

Log actual elapsed time, steps, success/failure, evidence path and Bobcoin usage
when visible in `metrics/experiments.csv`. Keep failed trials. Repeat cases when
feasible and report sample count and variability; do not cherry-pick the best run.
Clearly distinguish unmeasured targets from measured improvements.

For product agents, include a malformed input, unavailable tool/service or another
realistic boundary relevant to the promised workflow. Use timeouts and bounded
retries appropriate to the app. Never access secrets or live customer data to test.

Present a small table of results, limitations and the highest-value next fix.
Use the existing runner or stdlib rather than installing an evaluation platform
solely to support a few cases.
