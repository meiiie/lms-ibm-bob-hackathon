---
name: frontend-craft
description: Build or polish a web UI for a concrete demo flow with clear hierarchy, responsive behavior and accessible states. Use for frontend implementation or visual review, not backend-only tasks.
---

# Make the demo legible

Start with the real user action and result. Choose a coherent visual direction
appropriate to the product: typography, spacing, contrast and one accent color.
Use the existing design system when present. Avoid adding a component framework
for a single control already covered by native HTML/CSS.

Implement the main path and its loading, empty, error and success states where
they can occur. Label inputs; preserve keyboard focus and semantic controls.
Use responsive layout for desktop and a narrow viewport. Do not hide broken
behavior behind decorative cards or replace product content with implementation jargon.

Run the app and inspect screenshots at both sizes. Test the primary action with
the playwright-cli skill and check browser errors. Evaluate hierarchy, readable
text, clipping/overflow, keyboard access and whether the output is understandable.
Make concrete corrections instead of declaring the design polished from source alone.

Use licensed or self-created assets and disclose mock data. Report what was
visually inspected and which interaction was actually verified. A screenshot is
visual evidence; assertions or interaction outcomes establish functional behavior.
