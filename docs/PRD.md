# Hackathon scope — working proposal

Status: the owner selected the offline-safe assistant workstream, then authorized
the optional personal ChatGPT follow-up on 26 September 2026 (Vietnam, UTC+7).
The historical proposal below records the original preparation context.

## Selected slice and observable acceptance

The developer workflow is reproducing and fixing assistant failures around
connectivity, then validating a bounded integration before release. The learner
continues downloaded lessons offline; cloud AI must not block that work or leave
spurious pending-sync items. Bob's first implementation is merged in PR #2.

The follow-up adds an opt-in personal ChatGPT provider to the existing sidebar:

1. Wiii remains usable when ChatGPT is disabled. ChatGPT availability does not
   depend on a working Wiii service when the backend enables the option.
2. An authenticated learner explicitly connects using a device code and performs
   consent on OpenAI's page. This does not replace LMS login.
3. Connected learners can submit one bounded question, read plain answer text,
   and disconnect. No course/student data or prior chat is attached automatically.
4. Tokens stay on the backend, isolated by LMS principal. Expiry, cancellation,
   replaced attempts, rate limits and provider errors cannot leak credentials or
   reconnect a disconnected session.
5. Offline auth/chat operations never enter the synchronization queue or replay
   automatically. Closing/switching the panel stops its polling.
6. Backend/unit and real-browser fixture checks are documented separately from
   live provider validation. Only an actual consent, token exchange and real answer
   establish that the live ChatGPT connection works.

Implementation after Bob's quota stop is Codex work at the owner's request.
See [CHATGPT-SETUP](CHATGPT-SETUP.md) and [WORKSTATE](WORKSTATE.md) for settings,
actual results and outstanding live checks. Public hosting and deployment remain
the separate DevOps workstream; this prototype keeps a single in-memory backend.

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
