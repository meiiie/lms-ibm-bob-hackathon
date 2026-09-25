---
name: hackathon-slice
description: Convert an agreed hackathon idea into a small end-to-end slice with acceptance criteria, a verification command and a handoff. Use for MVP planning or resuming a multi-session build.
---

# One demonstrable slice

Read `docs/WORKSTATE.md`, the relevant parts of `docs/PRD.md`, and files needed for the current goal. If the product
is undecided, identify one target user, their painful step, the proposed output,
and a concrete demo scenario. Ask only for missing facts that change the build.
Record agreed scope, architecture and acceptance criteria in PRD; keep changing
progress in WORKSTATE. Do not treat unfilled template fields as approved decisions.

Define a small set of observable acceptance criteria for this slice before editing.
Include inputs, expected behavior, and the important failure case. Choose an
existing test/build command or a concrete browser check. Do not create a large
spec framework or backlog before a first working flow exists.

Inspect current behavior, implement the slice, run its verification, and fix
failures. Keep exploratory mocks visibly labeled and separate from verified
working behavior. Never set a feature to passing solely from reading the code.

At a meaningful handoff, update WORKSTATE with changed files, exact commands and
results, unresolved limitations, and one next step. Refer to commits or artifacts
instead of pasting long logs. A clean context can then resume without the full chat.
Remind the participant to capture the real Bob task summary for this work.

Use the built-in Plan mode for unresolved scope, Build for implementation, and a
fresh Verify task for risky integration. Separate tasks do not require simultaneous
agents; add delegation only when the work is independent and the quota warrants it.
