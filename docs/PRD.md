# Hackathon scope — working proposal

Status: LMS is selected; the exact new improvement is NOT yet agreed or implemented.

## Confirmed context

- Team: Neko Core; a teammate has run and understands this repository.
- Base product: existing Maritime LMS (Angular/Spring Boot/PostgreSQL).
- Event objective: improve a concrete developer workflow with IBM Bob IDE.
- Existing LMS features are reused material, disclosed in PREEXISTING.
- Keep the current stack and a small demonstrable scope within the event window.

## Candidate slice to validate with Bob

Reproducible debugging and release verification for ONE existing LMS flow.
Offline learning is a candidate because the repo already contains PWA/offline
functionality and browser tests. No specific defect or measurement is claimed.
If no meaningful reproducible gap is found quickly, choose an evidenced onboarding
or test-execution problem instead of manufacturing an application bug.

Proposed user: an LMS maintainer validating a change before release.
Proposed demo: reproduce a real gap -> Bob investigates and makes a bounded
improvement -> repeat the same check -> show result and remaining limits.
An artificially injected defect, if chosen, must be labeled as a demo fixture.

## Acceptance criteria to agree before implementation

1. Name the current painful step and show a reproducible baseline with permitted data.
2. Implement one improvement with clear input/output and important failure behavior.
3. Use an existing relevant test or add a meaningful regression test; show real results.
4. For UI behavior, verify the selected flow in an actual browser.
5. Record comparable before/after attempts, exact revision/commands and limitations.
6. Preserve working app behavior and collect real Bob evidence from each participant.

## Team decisions still needed

- Exact developer pain point and scenario:
- Selected feature / test path and measurable success criterion:
- Member ownership and integration owner:
- Demo hosting target and permitted public sample data:
- Submission owner:

Out of scope for the proposed slice: rewriting the LMS, replacing its stack,
new payment integrations, new agent orchestration frameworks, or claiming the
entire historical LMS as the team's 48-hour creation. Scope changes require a
deliberate team decision rather than silently expanding this document.
