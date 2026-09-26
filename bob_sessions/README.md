# IBM Bob task evidence

This directory belongs at the root of the repository submitted to the IBM Bob
2.0 Hackathon. It records evidence from the Neko Core team; the team name does
not identify a software dependency of this LMS.

Status (26 September 2026, Vietnam UTC+7): the manifest contains the real
`meiiie_dark-offline-sidebar-01_summary.png` IDE checkpoint captured at 08:18,
showing 28.50 Bobcoins. The task continued afterwards and stopped with a quota
error at 08:24:34. This image is not the expanded final consumption-summary panel;
capture that panel before treating this task's evidence as complete. Preserve the
existing image and its numbers as an intermediate checkpoint.

The manifest uses the verified local database task ID
`b3f61aaa13f3e3d94298655249da2d8c`; its notes preserve the historical team label
`dark-offline-sidebar-01`. A recovered local transcript is
Git-ignored pending privacy review. Codex's later ChatGPT implementation is not
additional Bob usage and must not be entered as a Bob session.

## Capture each relevant task

Every participant must capture all relevant Bob IDE task session summaries:

1. In Bob IDE, open **Tasks**.
2. Select the task for the correct workspace; use **All** if needed.
3. Click the task header to open its session consumption summary.
4. Capture a readable screenshot of the actual summary; PNG is preferred.
5. Save it directly in this directory and add one row to `manifest.csv`.

Suggested filename pattern: `<member-handle>_<task-id>_<short-purpose>_summary.png`.
This is a naming example, not an existing screenshot.

## Manifest conventions

- `member_handle`: participant handle, not a personal email address.
- `task_id`: the real Bob task identifier or a consistently recorded local label.
- `task_description`: the actual work performed in that task.
- `completed_at_vietnam`: actual completion time in ISO 8601 with `+07:00`.
  Leave blank when completion is unverified; put checkpoint capture times in notes.
  Vietnam uses UTC+7. Do not replace timestamps with the time of file upload.
- `summary_png`: filename relative to this directory; the file must exist.
- `history_markdown_optional`: optional reviewed history export, if available.
- `bobcoins_used_if_shown`: record only a value visible in the actual summary;
  otherwise leave it blank.
- `related_commit`: the real commit hash, when available; otherwise leave blank.
- `notes`: context needed to understand the evidence or its limitations.

Do not invent screenshots, usage numbers, task IDs, timestamps, or commit links.
Do not attribute Codex research, license changes, or this scaffold to Bob.
Exclude credentials and private/customer data from captures and exports. Optional
history exports supplement the required screenshots; they do not replace them.

Before submission, check every participant and relevant task, verify every listed
image exists and is readable, and commit the evidence to the public submission
repository. Only add screenshots captured from the actual Bob sessions.

[Official event guide](https://lablab-ibm-bob-2-hackathon-guide.s3.us.cloud-object-storage.appdomain.cloud/index.html#upload-bob-task-session-summary)

[Pre-existing material and preparation](../docs/PREEXISTING.md)
