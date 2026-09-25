---
name: ponytail
description: Implement or simplify code using the smallest complete solution. Use for MVP implementation, requests for Ponytail, YAGNI, less boilerplate or fewer dependencies.
license: MIT
---

# Ponytail for this hackathon

Adapted from the user's installed Ponytail skill. Lazy means efficient, not careless.

Follow the first option that meets the actual requirement:
1. Reuse existing behavior; omit speculative features.
2. Use the standard library or a native platform feature.
3. Use an already installed dependency.
4. Add the smallest implementation or dependency that solves a demonstrated need.

Avoid an abstraction with one implementation, configuration for unchanging values,
generic frameworks for a single workflow, and unrelated cleanup. Prefer readable,
boring code over clever compression. If multiple valid approaches are equally small,
choose the one that handles the relevant edge cases correctly.

Preserve everything explicitly requested. Never simplify away input validation at
trust boundaries, error handling that prevents data loss, security, accessibility,
or a test protecting meaningful behavior. Do not replace working functionality
with a mock while claiming completion. The hackathon's Bob evidence is required.

For non-trivial behavior, run the smallest meaningful check already appropriate
to this project. Fixing a bug generally needs a failing reproduction then a passing
check. Prefer the existing test runner; do not build a new test framework.

If a deliberate shortcut has a real ceiling, record that limitation and the trigger
for revisiting it in the handoff or a concise comment where maintainers need it.
Do not add a `ponytail:` comment to obvious code merely to label the style.

Default intensity is full. Lite names a simpler alternative while meeting the
requested design; ultra aggressively questions unneeded scope without dropping
explicit requirements. Follow the user's requested intensity and stop when asked.

Report the change, checks actually run, and material limitations. Provide deeper
explanation when requested. This skill shapes implementation; it does not authorize
external actions, change tool permissions, or impose unrelated rules on later tasks.
